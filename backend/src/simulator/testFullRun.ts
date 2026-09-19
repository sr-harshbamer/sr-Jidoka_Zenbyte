import { prisma } from "../db/client";
import { startScenarioRun, resolveApproval, GateEmitter } from "./procurementAgent";

const log: GateEmitter = (event) => {
  if (event.type === "step") {
    const { step, reasoning } = event.payload as any;
    console.log(`   step ${step.stepNumber} [${step.status}] ${step.action} — ${reasoning}`);
  } else if (event.type === "run_status") {
    console.log(`   run status -> ${(event.payload as any).status}`);
  } else if (event.type === "intervention_requested") {
    console.log(`   >> human approval requested`);
  } else if (event.type === "intervention_resolved") {
    console.log(`   >> human resolved: ${(event.payload as any).decision}`);
  }
};

async function run() {
  console.log("=== unauthorized_vendor (expect: pause for approval, human REJECTS, agent recovers) ===");
  const r1 = await startScenarioRun("unauthorized_vendor", log);
  if (r1.awaitingInterventionId) {
    await resolveApproval(r1.awaitingInterventionId, "REJECT", "demo-juror", log);
  }
  const run1 = await prisma.agentRun.findUniqueOrThrow({ where: { id: r1.run.id } });
  console.log(`   FINAL STATUS: ${run1.status}\n`);

  console.log("=== budget_violation (expect: BLOCK then recovery -> COMPLETED) ===");
  const r2 = await startScenarioRun("budget_violation", log);
  const run2 = await prisma.agentRun.findUniqueOrThrow({ where: { id: r2.run.id } });
  console.log(`   FINAL STATUS: ${run2.status}\n`);

  console.log("=== conflicting_evidence (expect: pause for approval, human APPROVES, agent continues) ===");
  const r3 = await startScenarioRun("conflicting_evidence", log);
  if (r3.awaitingInterventionId) {
    await resolveApproval(r3.awaitingInterventionId, "APPROVE", "demo-juror", log);
  }
  const run3 = await prisma.agentRun.findUniqueOrThrow({ where: { id: r3.run.id } });
  console.log(`   FINAL STATUS: ${run3.status}\n`);

  console.log("=== prompt_injection (expect: BLOCK then recovery -> COMPLETED) ===");
  const r4 = await startScenarioRun("prompt_injection", log);
  const run4 = await prisma.agentRun.findUniqueOrThrow({ where: { id: r4.run.id } });
  console.log(`   FINAL STATUS: ${run4.status}\n`);

  console.log("=== retry_loop (expect: PAUSED, no recovery) ===");
  const r5 = await startScenarioRun("retry_loop", log);
  const run5 = await prisma.agentRun.findUniqueOrThrow({ where: { id: r5.run.id } });
  console.log(`   FINAL STATUS: ${run5.status}\n`);

  const auditCount = await prisma.auditEvent.count();
  console.log(`Total audit events recorded across all runs: ${auditCount}`);
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
