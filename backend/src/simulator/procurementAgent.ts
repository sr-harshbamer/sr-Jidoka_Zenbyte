import { prisma } from "../db/client";
import { appendAuditEvent } from "../audit/auditLog";
import { evaluateStep } from "../gate/actionGate";
import { PolicyDef, StepContext } from "../engine/types";
import { ScenarioScript, ScriptedStep, SCENARIO_SCRIPTS } from "./scripts";

export type GateEmitter = (event: {
  type: "step" | "run_status" | "intervention_requested" | "intervention_resolved";
  runId: string;
  payload: unknown;
}) => void;

const noopEmitter: GateEmitter = () => {};

async function loadPolicies(): Promise<PolicyDef[]> {
  const rows = await prisma.policy.findMany({ where: { enabled: true } });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    condition: JSON.parse(r.condition),
    severity: r.severity as PolicyDef["severity"],
    action: r.action as PolicyDef["action"],
    enabled: r.enabled,
  }));
}

async function getOrCreateAgent() {
  const existing = await prisma.agent.findFirst({ where: { type: "procurement" } });
  if (existing) return existing;
  return prisma.agent.create({
    data: {
      name: "Procurement Agent",
      type: "procurement",
      description: "Handles purchase requests: searches vendors, compares prices, executes approved purchases.",
    },
  });
}

/** Runs a scripted step through the real gate, persists everything, emits it live. */
async function executeStep(
  runId: string,
  stepNumber: number,
  scripted: ScriptedStep,
  history: StepContext[],
  policies: PolicyDef[],
  emit: GateEmitter
) {
  const context: StepContext = {
    runId,
    stepNumber,
    action: scripted.action,
    tool: scripted.tool,
    input: scripted.input,
    amount: scripted.amount,
    vendor: scripted.vendor,
    toolSensitivity: scripted.toolSensitivity,
    irreversible: scripted.irreversible,
    evidence: scripted.evidence,
    history,
    failed: scripted.simulateFailure,
  };

  const verdict = evaluateStep(context, policies);

  const step = await prisma.agentStep.create({
    data: {
      runId,
      stepNumber,
      action: scripted.action,
      tool: scripted.tool,
      input: JSON.stringify(scripted.input),
      reasoning: scripted.reasoning,
      riskScore: verdict.riskScore,
      riskFactors: JSON.stringify(verdict.riskFactors),
      status: verdict.status,
    },
  });

  for (const ev of scripted.evidence) {
    await prisma.evidence.create({
      data: {
        stepId: step.id,
        source: ev.source,
        sourceType: ev.sourceType,
        content: ev.content,
      },
    });
  }

  for (const violation of verdict.policyViolations) {
    await prisma.riskEvent.create({
      data: {
        runId,
        stepId: step.id,
        type: "POLICY_VIOLATION",
        severity: violation.policy.severity,
        description: violation.reason,
        riskScoreContribution:
          verdict.riskFactors.find((f) => f.name === "Policy violation")?.points ?? 0,
      },
    });
  }
  if (verdict.evidenceConflicts.length > 0) {
    await prisma.riskEvent.create({
      data: {
        runId,
        stepId: step.id,
        type: "EVIDENCE_CONFLICT",
        severity: "MEDIUM",
        description: verdict.evidenceConflicts[0].reason,
        riskScoreContribution: verdict.riskFactors.find((f) => f.name === "Evidence conflict")?.points ?? 0,
      },
    });
  }
  if (verdict.anomaly.isLooping) {
    await prisma.riskEvent.create({
      data: {
        runId,
        stepId: step.id,
        type: "ANOMALY",
        severity: "MEDIUM",
        description: verdict.anomaly.reason ?? "Repeated failed action.",
        riskScoreContribution: verdict.riskFactors.find((f) => f.name === "Repeated failures")?.points ?? 0,
      },
    });
  }
  if (verdict.injectionMatches.length > 0) {
    await prisma.riskEvent.create({
      data: {
        runId,
        stepId: step.id,
        type: "PROMPT_INJECTION",
        severity: "CRITICAL",
        description: `Matched: "${verdict.injectionMatches[0].matchedPhrase}"`,
        riskScoreContribution:
          verdict.riskFactors.find((f) => f.name === "Prompt injection detected")?.points ?? 0,
      },
    });
  }

  await prisma.decision.create({
    data: {
      stepId: step.id,
      type: "RISK_EVAL",
      outcome: verdict.status,
      reasoning: verdict.explanation,
      decidedBy: "system",
    },
  });

  await appendAuditEvent({
    runId,
    eventType: `STEP_${verdict.status}`,
    actor: "agent",
    summary: `Step ${stepNumber} (${scripted.action}): ${verdict.explanation}`,
    payload: { step: scripted, verdict },
  });

  emit({
    type: "step",
    runId,
    payload: { step, verdict, reasoning: scripted.reasoning },
  });

  history.push(context);
  return { step, verdict };
}

async function setRunStatus(runId: string, status: string, emit: GateEmitter, endedAt = false) {
  await prisma.agentRun.update({
    where: { id: runId },
    data: { status, ...(endedAt ? { endedAt: new Date() } : {}) },
  });
  emit({ type: "run_status", runId, payload: { status } });
}

async function runRecovery(
  runId: string,
  script: ScenarioScript,
  startStepNumber: number,
  history: StepContext[],
  policies: PolicyDef[],
  emit: GateEmitter
) {
  if (!script.recovery || script.recovery.length === 0) {
    await setRunStatus(runId, "BLOCKED", emit, true);
    return;
  }
  let stepNumber = startStepNumber;
  for (const scripted of script.recovery) {
    const { verdict } = await executeStep(runId, stepNumber, scripted, history, policies, emit);
    stepNumber++;
    if (verdict.status === "BLOCK" || verdict.status === "TERMINATE") {
      await setRunStatus(runId, "BLOCKED", emit, true);
      return;
    }
  }
  await setRunStatus(runId, "COMPLETED", emit, true);
}

export async function startScenarioRun(scenarioKey: string, emit: GateEmitter = noopEmitter) {
  const script = SCENARIO_SCRIPTS[scenarioKey];
  if (!script) throw new Error(`Unknown scenario: ${scenarioKey}`);

  const agent = await getOrCreateAgent();
  const policies = await loadPolicies();

  const run = await prisma.agentRun.create({
    data: { agentId: agent.id, task: script.task, scenarioKey, status: "RUNNING" },
  });

  await appendAuditEvent({
    runId: run.id,
    eventType: "RUN_STARTED",
    actor: "system",
    summary: `Run started for scenario "${scenarioKey}": ${script.task}`,
    payload: { scenarioKey, task: script.task },
  });
  emit({ type: "run_status", runId: run.id, payload: { status: "RUNNING" } });

  const history: StepContext[] = [];
  let stepNumber = 1;

  for (const scripted of script.steps) {
    const { step, verdict } = await executeStep(run.id, stepNumber, scripted, history, policies, emit);
    stepNumber++;

    if (verdict.status === "REQUIRE_APPROVAL") {
      const intervention = await prisma.humanIntervention.create({
        data: {
          runId: run.id,
          stepId: step.id,
          requestedAction: JSON.stringify({ action: scripted.action, vendor: scripted.vendor, amount: scripted.amount }),
          context: JSON.stringify({
            explanation: verdict.explanation,
            riskScore: verdict.riskScore,
            riskFactors: verdict.riskFactors,
            policyViolations: verdict.policyViolations.map((v) => ({ name: v.policy.name, reason: v.reason })),
            evidenceConflicts: verdict.evidenceConflicts.map((c) => c.reason),
          }),
        },
      });
      await setRunStatus(run.id, "AWAITING_APPROVAL", emit);
      emit({ type: "intervention_requested", runId: run.id, payload: intervention });
      return { run, awaitingInterventionId: intervention.id, nextStepNumber: stepNumber };
    }

    if (verdict.status === "BLOCK" || verdict.status === "TERMINATE") {
      if (verdict.status === "TERMINATE") {
        await setRunStatus(run.id, "TERMINATED", emit, true);
        return { run };
      }
      await runRecovery(run.id, script, stepNumber, history, policies, emit);
      return { run };
    }

    if (verdict.status === "PAUSE") {
      await setRunStatus(run.id, "PAUSED", emit, true);
      return { run };
    }
    // ALLOW / WARN — continue to next scripted step
  }

  await setRunStatus(run.id, "COMPLETED", emit, true);
  return { run };
}

export async function resolveApproval(
  interventionId: string,
  decision: "APPROVE" | "REJECT" | "APPROVE_ONCE" | "ALWAYS_ALLOW",
  respondedBy: string,
  emit: GateEmitter = noopEmitter
) {
  const intervention = await prisma.humanIntervention.findUniqueOrThrow({
    where: { id: interventionId },
  });
  const run = await prisma.agentRun.findUniqueOrThrow({ where: { id: intervention.runId } });
  const script = SCENARIO_SCRIPTS[run.scenarioKey ?? ""];
  if (!script) throw new Error(`Run ${run.id} has no known scenario script`);

  await prisma.humanIntervention.update({
    where: { id: interventionId },
    data: { decision, respondedAt: new Date(), respondedBy },
  });

  await prisma.decision.create({
    data: {
      stepId: intervention.stepId ?? "",
      type: "HUMAN_APPROVAL",
      outcome: decision,
      reasoning: `Resolved by ${respondedBy}`,
      decidedBy: `human:${respondedBy}`,
    },
  });

  await appendAuditEvent({
    runId: run.id,
    eventType: `INTERVENTION_${decision}`,
    actor: "human",
    summary: `${respondedBy} ${decision.toLowerCase()}d the pending action.`,
    payload: { interventionId, decision, respondedBy },
  });
  emit({ type: "intervention_resolved", runId: run.id, payload: { interventionId, decision } });

  // Rebuild history from persisted steps so we can continue the run correctly.
  const priorSteps = await prisma.agentStep.findMany({
    where: { runId: run.id },
    orderBy: { stepNumber: "asc" },
  });
  const history: StepContext[] = priorSteps.map((s) => ({
    runId: run.id,
    stepNumber: s.stepNumber,
    action: s.action,
    tool: s.tool ?? undefined,
    input: JSON.parse(s.input),
    toolSensitivity: "LOW",
    irreversible: false,
    evidence: [],
    history: [],
  }));
  const policies = await loadPolicies();
  const nextStepNumber = priorSteps.length + 1;

  if (decision === "APPROVE" || decision === "APPROVE_ONCE" || decision === "ALWAYS_ALLOW") {
    await setRunStatus(run.id, "RUNNING", emit);
    const alreadyRunSteps = priorSteps.length;
    const remaining = script.steps.slice(alreadyRunSteps);
    let stepNumber = nextStepNumber;
    for (const scripted of remaining) {
      const { verdict } = await executeStep(run.id, stepNumber, scripted, history, policies, emit);
      stepNumber++;
      if (verdict.status === "BLOCK" || verdict.status === "TERMINATE") {
        await runRecovery(run.id, script, stepNumber, history, policies, emit);
        return;
      }
      if (verdict.status === "REQUIRE_APPROVAL" || verdict.status === "PAUSE") {
        return; // waits again
      }
    }
    await setRunStatus(run.id, "COMPLETED", emit, true);
  } else {
    // REJECT — the agent tries a compliant alternative
    await setRunStatus(run.id, "RUNNING", emit);
    await runRecovery(run.id, script, nextStepNumber, history, policies, emit);
  }
}
