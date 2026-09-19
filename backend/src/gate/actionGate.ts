import { evaluatePolicies } from "../engine/policyEngine";
import { computeRisk } from "../engine/riskEngine";
import { detectAnomaly } from "../engine/anomalyDetector";
import { checkEvidenceConflicts } from "../engine/evidenceChecker";
import { detectInjection } from "../engine/injectionDetector";
import { GateVerdict, PolicyDef, StepContext, StepStatus } from "../engine/types";

const TERMINATE_RETRY_THRESHOLD = 6;

/**
 * The single choke point every proposed agent action passes through. Nothing
 * downstream (a "real" tool call) should ever be reachable except through
 * the status this function returns.
 *
 * Precedence (highest severity wins, most specific reason first):
 *   1. Runaway retries          -> TERMINATE  (whole run stops)
 *   2. Prompt injection         -> BLOCK      (hostile input, not just risky)
 *   3. Policy says BLOCK        -> BLOCK
 *   4. Behavioral loop detected -> PAUSE      (agent may attempt self-recovery)
 *   5. Policy says REQUIRE_APPROVAL -> REQUIRE_APPROVAL
 *   6. Conflicting evidence     -> REQUIRE_APPROVAL (genuine uncertainty)
 *   7. Risk score thresholds    -> BLOCK / REQUIRE_APPROVAL / WARN / ALLOW
 */
export function evaluateStep(step: StepContext, policies: PolicyDef[]): GateVerdict {
  const policyViolations = evaluatePolicies(step, policies);
  const anomaly = detectAnomaly(step);
  const evidenceConflicts = checkEvidenceConflicts(step.evidence);
  const injectionMatches = detectInjection(step.evidence);
  const { score, factors } = computeRisk(
    step,
    policyViolations,
    anomaly,
    evidenceConflicts,
    injectionMatches
  );

  let status: StepStatus;
  let explanation: string;

  if (anomaly.retryCount >= TERMINATE_RETRY_THRESHOLD) {
    status = "TERMINATE";
    explanation = `Run terminated: "${step.action}" has failed ${anomaly.retryCount} times with no change in approach.`;
  } else if (injectionMatches.length > 0) {
    status = "BLOCK";
    explanation = `Blocked: untrusted content attempted to manipulate the agent ("${injectionMatches[0].matchedPhrase}").`;
  } else if (policyViolations.some((v) => v.policy.action === "BLOCK")) {
    const v = policyViolations.find((v) => v.policy.action === "BLOCK")!;
    status = "BLOCK";
    explanation = `Blocked by policy "${v.policy.name}": ${v.reason}`;
  } else if (anomaly.isLooping) {
    status = "PAUSE";
    explanation = `Paused: ${anomaly.reason}`;
  } else if (policyViolations.some((v) => v.policy.action === "REQUIRE_APPROVAL")) {
    const v = policyViolations.find((v) => v.policy.action === "REQUIRE_APPROVAL")!;
    status = "REQUIRE_APPROVAL";
    explanation = `Human approval required by policy "${v.policy.name}": ${v.reason}`;
  } else if (evidenceConflicts.length > 0) {
    status = "REQUIRE_APPROVAL";
    explanation = `Human review requested: ${evidenceConflicts[0].reason}`;
  } else if (score >= 76) {
    status = "BLOCK";
    explanation = `Blocked: risk score ${score}/100 exceeds the automatic block threshold.`;
  } else if (score >= 51) {
    status = "REQUIRE_APPROVAL";
    explanation = `Human approval required: risk score ${score}/100.`;
  } else if (score >= 26 || policyViolations.some((v) => v.policy.action === "WARN")) {
    status = "WARN";
    explanation = `Flagged for review: risk score ${score}/100.`;
  } else {
    status = "ALLOW";
    explanation = `Allowed: risk score ${score}/100, no policy or behavioral concerns.`;
  }

  return {
    status,
    riskScore: score,
    riskFactors: factors,
    policyViolations,
    anomaly,
    evidenceConflicts,
    injectionMatches,
    explanation,
  };
}
