import { API_BASE_URL } from "./config";
import { AgentHealth, AgentRun, HumanIntervention } from "./types";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

export const api = {
  agents: () => get<{ id: string; name: string; type: string; description: string; status: string }[]>(
    "/api/agents"
  ),
  scenarios: () => get<{ key: string; title: string; task: string }[]>("/api/scenarios"),
  startRun: (scenarioKey: string) =>
    post<{ runId: string; awaitingInterventionId: string | null }>("/api/runs/start", {
      scenarioKey,
    }),
  runs: () => get<AgentRun[]>("/api/runs"),
  run: (id: string) => get<AgentRun>(`/api/runs/${id}`),
  pendingInterventions: () => get<HumanIntervention[]>("/api/interventions/pending"),
  resolveIntervention: (id: string, decision: string, respondedBy: string) =>
    post<{ ok: boolean }>(`/api/interventions/${id}/resolve`, { decision, respondedBy }),
  policies: () => get<any[]>("/api/policies"),
  agentHealth: (agentId: string) => get<AgentHealth>(`/api/agents/${agentId}/health`),
  audit: (runId: string) => get<any[]>(`/api/audit/${runId}`),
};
