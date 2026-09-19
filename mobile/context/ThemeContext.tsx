import React, { createContext, useContext, useState } from "react";
import Colors from "@/constants/Colors";

type Scheme = "light" | "dark";

interface ThemeContextValue {
  scheme: Scheme;
  toggle: () => void;
  colors: (typeof Colors)["dark"];
}

// Jidoka ships dark by default regardless of the OS setting — light mode is
// an explicit opt-in from Settings, not something that silently follows the
// phone's system theme.
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setScheme] = useState<Scheme>("dark");
  const value: ThemeContextValue = {
    scheme,
    toggle: () => setScheme((s) => (s === "dark" ? "light" : "dark")),
    colors: Colors[scheme],
  };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used within ThemeProvider");
  return ctx;
}
