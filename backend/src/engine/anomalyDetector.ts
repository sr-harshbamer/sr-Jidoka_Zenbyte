import { AnomalyResult, StepContext } from "./types";

const LOOP_RETRY_THRESHOLD = 3;

/**
 * Looks at the run's history for this exact action+tool combination having
 * failed repeatedly. Catches an agent stuck retrying the same broken thing,
 * or being nudged into a loop by manipulated tool output.
 */
export function detectAnomaly(step: StepContext): AnomalyResult {
  const sameActionFailures = step.history.filter(
    (h) => h.action === step.action && h.tool === step.tool && h.failed
  ).length;

  const retryCount = step.failed ? sameActionFailures + 1 : sameActionFailures;

  if (retryCount >= LOOP_RETRY_THRESHOLD) {
    return {
      isLooping: true,
      retryCount,
      reason: `Action "${step.action}" has failed ${retryCount} times in this run without a change in approach.`,
    };
  }

  return { isLooping: false, retryCount };
}
