export type StepStatus = "ALLOW" | "WARN" | "PAUSE" | "REQUIRE_APPROVAL" | "BLOCK" | "TERMINATE";

export interface RiskFactor {
  name: string;
  points: number;
  reason: string;
}

export interface AgentStep {
  id: string;
  runId: string;
  stepNumber: number;
  timestamp: string;
  action: string;
  tool?: string | null;
  input: string;
  reasoning?: string | null;
  riskScore: number;
  riskFactors: string;
  status: StepStatus;
}

export interface AgentRun {
  id: string;
  agentId: string;
  task: string;
  scenarioKey?: string | null;
  status: string;
  startedAt: string;
  endedAt?: string | null;
  steps?: AgentStep[];
}

export interface HumanIntervention {
  id: string;
  runId: string;
  stepId?: string | null;
  requestedAt: string;
  respondedAt?: string | null;
  requestedAction: string;
  context: string;
  decision: string;
  respondedBy?: string | null;
  run?: AgentRun;
}

export interface GateEventPayload {
  type: "step" | "run_status" | "intervention_requested" | "intervention_resolved";
  runId: string;
  payload: unknown;
}

export interface AgentHealth {
  agentId: string;
  totalRuns: number;
  totalSteps: number;
  policyComplianceRate: number;
  blockedSteps: number;
  humanInterventions: number;
  averageRiskScore: number;
  toolUsage: Record<string, number>;
}
