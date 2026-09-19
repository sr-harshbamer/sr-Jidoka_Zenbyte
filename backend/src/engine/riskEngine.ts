import {
  AnomalyResult,
  EvidenceConflict,
  InjectionMatch,
  PolicyViolation,
  RiskBreakdown,
  RiskFactor,
  StepContext,
} from "./types";

const SEVERITY_POINTS: Record<string, number> = {
  LOW: 12,
  MEDIUM: 22,
  HIGH: 32,
  CRITICAL: 40,
};

const TOOL_SENSITIVITY_POINTS: Record<string, number> = {
  LOW: 0,
  MEDIUM: 8,
  HIGH: 15,
};

/**
 * Every number here is a plain, named, additive factor — deliberately not a
 * single opaque ML score. Anyone can ask "why did this get a 78?" and be
 * shown exactly which lines added up to it.
 */
export function computeRisk(
  step: StepContext,
  policyViolations: PolicyViolation[],
  anomaly: AnomalyResult,
  evidenceConflicts: EvidenceConflict[],
  injectionMatches: InjectionMatch[]
): RiskBreakdown {
  const factors: RiskFactor[] = [];

  // 1. Policy violation — up to 40, take the worst one rather than stacking
  if (policyViolations.length > 0) {
    const worst = policyViolations.reduce((max, v) =>
      SEVERITY_POINTS[v.policy.severity] > SEVERITY_POINTS[max.policy.severity] ? v : max
    );
    factors.push({
      name: "Policy violation",
      points: SEVERITY_POINTS[worst.policy.severity],
      reason: worst.reason,
    });
  }

  // 2. Tool sensitivity — 0-15 (also stands in for privilege level: a tool
  // that executes a real purchase inherently needs higher trust than one
  // that only searches)
  const toolPoints = TOOL_SENSITIVITY_POINTS[step.toolSensitivity] ?? 0;
  if (toolPoints > 0) {
    factors.push({
      name: "Tool sensitivity",
      points: toolPoints,
      reason: `"${step.action}" uses a ${step.toolSensitivity.toLowerCase()}-sensitivity tool.`,
    });
  }

  // 3. Evidence conflict — 0-20 (10 per conflicting pair, capped)
  if (evidenceConflicts.length > 0) {
    const points = Math.min(20, evidenceConflicts.length * 10);
    factors.push({
      name: "Evidence conflict",
      points,
      reason: evidenceConflicts[0].reason,
    });
  }

  // 4. Anomaly / repeated failures — 0-20, superlinear past the loop threshold
  if (anomaly.isLooping) {
    const points = Math.min(20, 8 + (anomaly.retryCount - 3) * 4);
    factors.push({
      name: "Repeated failures",
      points,
      reason: anomaly.reason ?? "Agent is repeating a failed action.",
    });
  }

  // 5. Prompt injection — treated as a severe, near-fixed penalty since it
  // implies the input itself is actively hostile, not just risky
  if (injectionMatches.length > 0) {
    factors.push({
      name: "Prompt injection detected",
      points: 35,
      reason: `Untrusted content contained a manipulation attempt: "${injectionMatches[0].matchedPhrase}"`,
    });
  }

  // 6. Action impact — 0-15, based on irreversibility and monetary size
  let impactPoints = 0;
  const impactReasons: string[] = [];
  if (step.irreversible) {
    impactPoints += 10;
    impactReasons.push("this action cannot be undone once taken");
  }
  if (typeof step.amount === "number" && step.amount > 0) {
    // scaled loosely against a reference ceiling of 10 lakh for demo purposes
    const scaled = Math.min(5, Math.round((step.amount / 1_000_000) * 5));
    if (scaled > 0) {
      impactPoints += scaled;
      impactReasons.push(`amount involved is Rs.${step.amount.toLocaleString("en-IN")}`);
    }
  }
  if (impactPoints > 0) {
    factors.push({
      name: "Action impact",
      points: Math.min(15, impactPoints),
      reason: impactReasons.join(" and "),
    });
  }

  const rawScore = factors.reduce((sum, f) => sum + f.points, 0);
  const score = Math.min(100, rawScore);

  return { score, factors };
}
