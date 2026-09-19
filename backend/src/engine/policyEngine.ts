import { PolicyDef, PolicyViolation, StepContext } from "./types";

/**
 * Evaluates a step against every enabled policy and returns the ones it violates.
 * Deterministic, no LLM involved — this is the layer that has to be trustworthy
 * even if everything else in the system is being manipulated.
 */
export function evaluatePolicies(
  step: StepContext,
  policies: PolicyDef[]
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  for (const policy of policies) {
    if (!policy.enabled) continue;

    switch (policy.condition.type) {
      case "budget_limit": {
        if (
          typeof step.amount === "number" &&
          step.amount > policy.condition.maxAmount
        ) {
          violations.push({
            policy,
            reason: `Action amount Rs.${step.amount.toLocaleString(
              "en-IN"
            )} exceeds the policy limit of Rs.${policy.condition.maxAmount.toLocaleString(
              "en-IN"
            )}.`,
          });
        }
        break;
      }

      case "approved_vendors": {
        if (
          step.vendor &&
          !policy.condition.vendors.some(
            (v) => v.toLowerCase() === step.vendor!.toLowerCase()
          )
        ) {
          violations.push({
            policy,
            reason: `Vendor "${step.vendor}" is not on the approved vendor list.`,
          });
        }
        break;
      }

      case "requires_approval_for_action": {
        if (policy.condition.actions.includes(step.action)) {
          violations.push({
            policy,
            reason: `Action "${step.action}" is configured to always require human approval.`,
          });
        }
        break;
      }

      case "irreversible_action": {
        if (step.irreversible && policy.condition.actions.includes(step.action)) {
          violations.push({
            policy,
            reason: `Action "${step.action}" is irreversible and is covered by this policy.`,
          });
        }
        break;
      }
    }
  }

  return violations;
}
