import React from "react";
import { Pressable, StyleSheet, Text, View, ViewProps } from "react-native";
import { useAppTheme } from "@/context/ThemeContext";
import { StepStatus } from "@/lib/types";

export function Screen({ style, ...rest }: ViewProps) {
  const { colors } = useAppTheme();
  return <View style={[{ flex: 1, backgroundColor: colors.background }, style]} {...rest} />;
}

export function Card({ style, ...rest }: ViewProps) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: 10,
          padding: 14,
        },
        style,
      ]}
      {...rest}
    />
  );
}

export function ThemedText({
  style,
  muted,
  ...rest
}: React.ComponentProps<typeof Text> & { muted?: boolean }) {
  const { colors } = useAppTheme();
  return (
    <Text style={[{ color: muted ? colors.textMuted : colors.text }, style]} {...rest} />
  );
}

const STATUS_LABEL: Record<StepStatus, string> = {
  ALLOW: "Allowed",
  WARN: "Flagged",
  PAUSE: "Paused",
  REQUIRE_APPROVAL: "Needs approval",
  BLOCK: "Blocked",
  TERMINATE: "Terminated",
};

export function StatusBadge({ status }: { status: StepStatus }) {
  const { colors } = useAppTheme();
  const colorKey = {
    ALLOW: "allow",
    WARN: "warn",
    PAUSE: "pause",
    REQUIRE_APPROVAL: "requireApproval",
    BLOCK: "block",
    TERMINATE: "terminate",
  }[status] as keyof typeof colors.status;
  const color = colors.status[colorKey];

  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderColor: color,
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}>
      <Text style={{ color, fontSize: 11, fontWeight: "600", letterSpacing: 0.3 }}>
        {STATUS_LABEL[status]}
      </Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "danger" | "muted";
  disabled?: boolean;
}) {
  const { colors } = useAppTheme();
  const bg =
    variant === "primary" ? colors.accent : variant === "danger" ? colors.status.block : colors.surfaceAlt;
  const textColor = variant === "muted" ? colors.text : "#1a1208";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}>
      <Text style={{ color: textColor, fontWeight: "700", fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
