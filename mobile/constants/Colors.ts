// Jidoka design tokens — deliberately restrained: flat colors, no gradients,
// no glassmorphism, near-black (not purple-tinted) dark background. Amber is
// the single brand accent, doubling as the WARN status color (ties into the
// Andon signal-light story).

const amber = "#c9822e";
const amberLight = "#a8631a";

export default {
  light: {
    background: "#f7f6f3",
    surface: "#ffffff",
    surfaceAlt: "#f0eee9",
    border: "#e2ddd3",
    text: "#1c1c1a",
    textMuted: "#6b6b64",
    accent: amberLight,
    tint: amberLight,
    tabIconDefault: "#a3a099",
    tabIconSelected: amberLight,
    status: {
      allow: "#2f7a4f",
      warn: amberLight,
      pause: "#8a6a1f",
      requireApproval: "#b5591f",
      block: "#a83f34",
      terminate: "#7a2c24",
    },
  },
  dark: {
    background: "#15171b",
    surface: "#1d2025",
    surfaceAlt: "#23262c",
    border: "#2c2f36",
    text: "#eae8e3",
    textMuted: "#9a9da6",
    accent: amber,
    tint: amber,
    tabIconDefault: "#6b6e76",
    tabIconSelected: amber,
    status: {
      allow: "#4f9d6e",
      warn: amber,
      pause: "#c9a23a",
      requireApproval: "#d17a35",
      block: "#c9503f",
      terminate: "#a83f34",
    },
  },
};
