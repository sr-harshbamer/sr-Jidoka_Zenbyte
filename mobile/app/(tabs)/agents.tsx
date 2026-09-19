import React, { useEffect, useState } from "react";
import { FlatList, Pressable, View } from "react-native";
import { Card, Screen, ThemedText } from "@/components/ui";
import { useAppTheme } from "@/context/ThemeContext";
import { api } from "@/lib/api";
import { AgentHealth } from "@/lib/types";

interface AgentRow {
  id: string;
  name: string;
  type: string;
  description: string;
  status: string;
}

export default function AgentsScreen() {
  const { colors } = useAppTheme();
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [health, setHealth] = useState<Record<string, AgentHealth>>({});

  useEffect(() => {
    api.agents().then(setAgents);
  }, []);

  const toggle = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!health[id]) {
      const h = await api.agentHealth(id);
      setHealth((prev) => ({ ...prev, [id]: h }));
    }
  };

  return (
    <Screen style={{ padding: 16 }}>
      <ThemedText style={{ fontSize: 22, fontWeight: "700", marginBottom: 14 }}>Agents</ThemedText>

      <FlatList
        data={agents}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => {
          const h = health[item.id];
          const expanded = expandedId === item.id;
          return (
            <Card>
              <Pressable onPress={() => toggle(item.id)}>
                <ThemedText style={{ fontWeight: "700" }}>{item.name}</ThemedText>
                <ThemedText muted>{item.description}</ThemedText>
              </Pressable>

              {expanded && h && (
                <View style={{ marginTop: 12, gap: 6 }}>
                  <View style={{ height: 1, backgroundColor: colors.border, marginBottom: 4 }} />
                  <Row label="Total runs" value={String(h.totalRuns)} />
                  <Row label="Total steps" value={String(h.totalSteps)} />
                  <Row label="Policy compliance" value={`${Math.round(h.policyComplianceRate * 100)}%`} />
                  <Row label="Blocked steps" value={String(h.blockedSteps)} />
                  <Row label="Human interventions" value={String(h.humanInterventions)} />
                  <Row label="Average risk score" value={`${h.averageRiskScore}/100`} />
                  {Object.entries(h.toolUsage).map(([tool, count]) => (
                    <Row key={tool} label={`Tool: ${tool}`} value={String(count)} />
                  ))}
                </View>
              )}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <ThemedText muted>{label}</ThemedText>
      <ThemedText style={{ fontWeight: "600" }}>{value}</ThemedText>
    </View>
  );
}
