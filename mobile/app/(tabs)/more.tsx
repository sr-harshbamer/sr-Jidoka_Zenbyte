import React, { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { Card, Screen, ThemedText, Button } from "@/components/ui";
import { useAppTheme } from "@/context/ThemeContext";
import { api } from "@/lib/api";

interface PolicyRow {
  id: string;
  name: string;
  description: string;
  severity: string;
  action: string;
  enabled: boolean;
}

export default function MoreScreen() {
  const { scheme, toggle } = useAppTheme();
  const [policies, setPolicies] = useState<PolicyRow[]>([]);

  useEffect(() => {
    api.policies().then(setPolicies);
  }, []);

  return (
    <Screen style={{ padding: 16 }}>
      <ThemedText style={{ fontSize: 22, fontWeight: "700", marginBottom: 14 }}>More</ThemedText>

      <Card style={{ marginBottom: 16 }}>
        <ThemedText style={{ fontWeight: "700", marginBottom: 8 }}>Appearance</ThemedText>
        <Button title={scheme === "dark" ? "Switch to light" : "Switch to dark"} variant="muted" onPress={toggle} />
      </Card>

      <ThemedText style={{ fontWeight: "700", marginBottom: 8 }}>Policies</ThemedText>
      <FlatList
        data={policies}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
              <ThemedText style={{ fontWeight: "700" }}>{item.name}</ThemedText>
              <ThemedText muted style={{ fontSize: 12 }}>
                {item.severity} · {item.action}
              </ThemedText>
            </View>
            <ThemedText muted>{item.description}</ThemedText>
          </Card>
        )}
      />
    </Screen>
  );
}
