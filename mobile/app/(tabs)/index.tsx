import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { Card, Screen, StatusBadge, ThemedText, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { useGateEvents } from "@/lib/socket";
import { AgentStep, GateEventPayload, StepStatus } from "@/lib/types";

const SCENARIOS = [
  { key: "unauthorized_vendor", label: "Unauthorized Vendor" },
  { key: "budget_violation", label: "Budget Violation" },
  { key: "conflicting_evidence", label: "Conflicting Evidence" },
];

export default function HomeScreen() {
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string>("—");
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [starting, setStarting] = useState<string | null>(null);

  const loadLatestRun = useCallback(async () => {
    const runs = await api.runs();
    if (runs.length > 0) {
      const latest = runs[0];
      setRunId(latest.id);
      setRunStatus(latest.status);
      const full = await api.run(latest.id);
      setSteps(full.steps ?? []);
    }
  }, []);

  useEffect(() => {
    loadLatestRun();
  }, [loadLatestRun]);

  useGateEvents((event: GateEventPayload) => {
    if (event.type === "step") {
      const { step } = event.payload as { step: AgentStep };
      setRunId((current) => {
        if (step.runId !== current) {
          setSteps([step]);
          return step.runId;
        }
        setSteps((prev) => [...prev.filter((s) => s.id !== step.id), step]);
        return current;
      });
    } else if (event.type === "run_status") {
      setRunStatus((event.payload as { status: string }).status);
    }
  });

  const startScenario = async (key: string) => {
    setStarting(key);
    setSteps([]);
    setRunStatus("RUNNING");
    try {
      const { runId: newRunId } = await api.startRun(key);
      setRunId(newRunId);
    } finally {
      setStarting(null);
    }
  };

  return (
    <Screen style={{ padding: 16 }}>
      <ThemedText style={{ fontSize: 22, fontWeight: "700", marginBottom: 4 }}>
        Live Run
      </ThemedText>
      <ThemedText muted style={{ marginBottom: 14 }}>
        Status: {runStatus}
      </ThemedText>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {SCENARIOS.map((s) => (
          <Button
            key={s.key}
            title={starting === s.key ? "Starting…" : s.label}
            variant="muted"
            disabled={starting !== null}
            onPress={() => startScenario(s.key)}
          />
        ))}
      </View>

      <FlatList
        data={steps}
        keyExtractor={(s) => s.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadLatestRun} />}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        ListEmptyComponent={<ThemedText muted>No steps yet — start a scenario above.</ThemedText>}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <ThemedText muted style={{ fontSize: 12 }}>
                Step {item.stepNumber}
              </ThemedText>
              <StatusBadge status={item.status as StepStatus} />
            </View>
            <ThemedText style={{ fontWeight: "600", marginBottom: 2 }}>{item.action}</ThemedText>
            {item.reasoning ? <ThemedText muted>{item.reasoning}</ThemedText> : null}
            <ThemedText muted style={{ fontSize: 12, marginTop: 6 }}>
              Risk: {item.riskScore}/100
            </ThemedText>
          </Card>
        )}
      />
    </Screen>
  );
}
