import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { Card, Screen, ThemedText, Button } from "@/components/ui";
import { useAppTheme } from "@/context/ThemeContext";
import { api } from "@/lib/api";
import { useGateEvents } from "@/lib/socket";
import { HumanIntervention } from "@/lib/types";

interface ParsedContext {
  explanation: string;
  riskScore: number;
  riskFactors: { name: string; points: number; reason: string }[];
  policyViolations: { name: string; reason: string }[];
  evidenceConflicts: string[];
}

export default function ApprovalsScreen() {
  const { colors } = useAppTheme();
  const [pending, setPending] = useState<HumanIntervention[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    const rows = await api.pendingInterventions();
    setPending(rows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useGateEvents((event) => {
    if (event.type === "intervention_requested" || event.type === "intervention_resolved") {
      load();
    }
  });

  const resolve = async (id: string, decision: "APPROVE" | "REJECT" | "APPROVE_ONCE") => {
    setResolving(true);
    try {
      await api.resolveIntervention(id, decision, "you");
      setExpandedId(null);
      await load();
    } finally {
      setResolving(false);
    }
  };

  return (
    <Screen style={{ padding: 16 }}>
      <ThemedText style={{ fontSize: 22, fontWeight: "700", marginBottom: 4 }}>
        Approvals
      </ThemedText>
      <ThemedText muted style={{ marginBottom: 14 }}>
        {pending.length} pending
      </ThemedText>

      <FlatList
        data={pending}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        ListEmptyComponent={<ThemedText muted>Nothing waiting on you right now.</ThemedText>}
        renderItem={({ item }) => {
          const ctx: ParsedContext = JSON.parse(item.context);
          const action = JSON.parse(item.requestedAction);
          const expanded = expandedId === item.id;

          return (
            <Card>
              <Pressable onPress={() => setExpandedId(expanded ? null : item.id)}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                  <ThemedText style={{ fontWeight: "700" }}>What the agent wants to do</ThemedText>
                  <ThemedText muted style={{ fontSize: 12 }}>
                    risk {ctx.riskScore}
                  </ThemedText>
                </View>
                <ThemedText style={{ marginBottom: 6 }}>
                  {action.action}
                  {action.vendor ? ` — ${action.vendor}` : ""}
                  {action.amount ? ` (Rs.${Number(action.amount).toLocaleString("en-IN")})` : ""}
                </ThemedText>
                <ThemedText muted>{ctx.explanation}</ThemedText>
              </Pressable>

              {expanded && (
                <View style={{ marginTop: 12, gap: 10 }}>
                  <View style={{ height: 1, backgroundColor: colors.border }} />

                  {ctx.policyViolations.length > 0 && (
                    <View>
                      <ThemedText style={{ fontWeight: "600", marginBottom: 2 }}>Policy</ThemedText>
                      {ctx.policyViolations.map((p, i) => (
                        <ThemedText key={i} muted>
                          {p.name}: {p.reason}
                        </ThemedText>
                      ))}
                    </View>
                  )}

                  {ctx.evidenceConflicts.length > 0 && (
                    <View>
                      <ThemedText style={{ fontWeight: "600", marginBottom: 2 }}>Evidence</ThemedText>
                      {ctx.evidenceConflicts.map((e, i) => (
                        <ThemedText key={i} muted>
                          {e}
                        </ThemedText>
                      ))}
                    </View>
                  )}

                  <View>
                    <ThemedText style={{ fontWeight: "600", marginBottom: 2 }}>
                      Risk breakdown ({ctx.riskScore}/100)
                    </ThemedText>
                    {ctx.riskFactors.map((f, i) => (
                      <ThemedText key={i} muted>
                        {f.name} (+{f.points}) — {f.reason}
                      </ThemedText>
                    ))}
                  </View>

                  <View>
                    <ThemedText style={{ fontWeight: "600", marginBottom: 2 }}>
                      If you approve
                    </ThemedText>
                    <ThemedText muted>
                      The agent proceeds with this exact action and it becomes part of the
                      permanent audit trail under your name.
                    </ThemedText>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Reject"
                        variant="danger"
                        disabled={resolving}
                        onPress={() => resolve(item.id, "REJECT")}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Approve"
                        variant="primary"
                        disabled={resolving}
                        onPress={() => resolve(item.id, "APPROVE")}
                      />
                    </View>
                  </View>
                </View>
              )}
            </Card>
          );
        }}
      />
    </Screen>
  );
}
