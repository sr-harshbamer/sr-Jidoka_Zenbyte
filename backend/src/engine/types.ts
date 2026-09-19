export type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type PolicyActionKind = "WARN" | "BLOCK" | "REQUIRE_APPROVAL";
export type StepStatus =
  | "ALLOW"
  | "WARN"
  | "PAUSE"
  | "REQUIRE_APPROVAL"
  | "BLOCK"
  | "TERMINATE";

export interface EvidenceItem {
  source: string;
  sourceType: "trusted" | "untrusted";
  content: string;
  /** Numeric claim this evidence makes, if any (e.g. a quoted price) — used for conflict detection. */
  claimValue?: number;
  claimLabel?: string;
}

export type PolicyCondition =
  | { type: "budget_limit"; maxAmount: number }
  | { type: "approved_vendors"; vendors: string[] }
  | { type: "requires_approval_for_action"; actions: string[] }
  | { type: "irreversible_action"; actions: string[] };

export interface PolicyDef {
  id: string;
  name: string;
  description: string;
  condition: PolicyCondition;
  severity: Severity;
  action: PolicyActionKind;
  enabled: boolean;
}

export interface PolicyViolation {
  policy: PolicyDef;
  reason: string;
}

export interface AnomalyResult {
  isLooping: boolean;
  retryCount: number;
  reason?: string;
}

export interface EvidenceConflict {
  a: EvidenceItem;
  b: EvidenceItem;
  reason: string;
}

export interface InjectionMatch {
  evidence: EvidenceItem;
  matchedPhrase: string;
}

export interface StepContext {
  runId: string;
  stepNumber: number;
  action: string;
  tool?: string;
  input: Record<string, unknown>;
  /** Amount of money involved in this action, if any (for budget/impact checks). */
  amount?: number;
  vendor?: string;
  /** Sensitivity tier of the tool being called: higher = riskier by nature. */
  toolSensitivity: "LOW" | "MEDIUM" | "HIGH";
  /** Whether this action, once taken, cannot be undone. */
  irreversible: boolean;
  evidence: EvidenceItem[];
  /** Prior steps in this run, oldest first — used for loop/anomaly detection. */
  history: StepContext[];
  /** True if this exact step is a retry of a previously failed action. */
  failed?: boolean;
}

export interface RiskFactor {
  name: string;
  points: number;
  reason: string;
}

export interface RiskBreakdown {
  score: number;
  factors: RiskFactor[];
}

export interface GateVerdict {
  status: StepStatus;
  riskScore: number;
  riskFactors: RiskFactor[];
  policyViolations: PolicyViolation[];
  anomaly: AnomalyResult;
  evidenceConflicts: EvidenceConflict[];
  injectionMatches: InjectionMatch[];
  explanation: string;
}
