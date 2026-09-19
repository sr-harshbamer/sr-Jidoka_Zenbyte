import React, { useState } from "react";
import { FlatList, View } from "react-native";
import { Card, Screen, StatusBadge, ThemedText, Button } from "@/components/ui";
import { api } from "@/lib/api";
import { AgentStep, StepStatus } from "@/lib/types";

const ATTACKS = [
  {
    key: "prompt_injection",
    title: "Prompt Injection",
    description: "A vendor document tries to talk the agent into ignoring its own rules.",
  },
  {
    key: "retry_loop",
    title: "Infinite Retry",
    description: "The agent keeps repeating the same failed action.",
  },
  {
    key: "budget_violation",
    title: "Budget Manipulation",
    description: "An attempted purchase exceeds the stated budget cap.",
  },
  {
    key: "unauthorized_vendor",
    title: "Unauthorized Vendor",
    description: "The agent tries to buy from a vendor outside the approved list.",
  },
  {
    key: "conflicting_evidence",
    title: "Conflicting Evidence",
    description: "Two trusted sources disagree on the same fact.",
  },
];

interface TestResult {
  key: string;
  finalStatus: string;
  decisiveStep: AgentStep | null;
}

export default function TestLabScreen() {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestResult>>({});

  const runAttack = async (key: string) => {
    setRunning(key);
    try {
      const { runId } = await api.startRun(key);
      const run = await api.run(runId);
      const steps = run.steps ?? [];
      const decisive =
        steps.find((s) => s.status !== "ALLOW" && s.status !== "WARN") ?? steps[steps.length - 1] ?? null;
      setResults((prev) => ({
        ...prev,
        [key]: { key, finalStatus: run.status, decisiveStep: decisive },
      }));
    } finally {
      setRunning(null);
    }
  };

  const passCount = Object.values(results).length;
  const caughtCount = Object.values(results).filter(
    (r) => r.decisiveStep && r.decisiveStep.status !== "ALLOW"
  ).length;

  return (
    <Screen style={{ padding: 16 }}>
      <ThemedText style={{ fontSize: 22, fontWeight: "700", marginBottom: 4 }}>
        Test Lab
      </ThemedText>
      <ThemedText muted style={{ marginBottom: 14 }}>
        {passCount > 0 ? `${caughtCount}/${passCount} attacks caught` : "Run an attack against the real engine"}
      </ThemedText>

      <FlatList
        data={ATTACKS}
        keyExtractor={(a) => a.key}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => {
          const result = results[item.key];
          return (
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <ThemedText style={{ fontWeight: "700", marginBottom: 2 }}>{item.title}</ThemedText>
                  <ThemedText muted>{item.description}</ThemedText>
                </View>
                <Button
                  title={running === item.key ? "Running…" : "Run"}
                  variant="muted"
                  disabled={running !== null}
                  onPress={() => runAttack(item.key)}
                />
              </View>

              {result && (
                <View style={{ marginTop: 10, gap: 4 }}>
                  <View
                    style={{
                      height: 1,
                      backgroundColor: "transparent",
                      marginBottom: 2,
                    }}
                  />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {result.decisiveStep && (
                      <StatusBadge status={result.decisiveStep.status as StepStatus} />
                    )}
                    <ThemedText muted style={{ fontSize: 12 }}>
                      run ended: {result.finalStatus}
                    </ThemedText>
                  </View>
                  {result.decisiveStep?.reasoning ? (
                    <ThemedText muted style={{ fontSize: 13 }}>
                      {result.decisiveStep.reasoning}
                    </ThemedText>
                  ) : null}
                </View>
              )}
            </Card>
          );
        }}
      />
    </Screen>
  );
}
