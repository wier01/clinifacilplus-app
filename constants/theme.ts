export type ColorScheme = "light" | "dark";

export type ThemeColorPalette = {
  background: string;
  surface: string;
  card: string;
  foreground: string;
  text: string;
  muted: string;
  primary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  danger: string;
};

export const Colors: Record<ColorScheme, ThemeColorPalette> = {
  light: {
    background: "#F7FAFC",
    surface: "#FFFFFF",
    card: "#FFFFFF",
    foreground: "#0F172A",
    text: "#0F172A",
    muted: "#64748B",
    primary: "#2563EB",
    border: "#E2E8F0",
    success: "#16A34A",
    warning: "#F59E0B",
    error: "#DC2626",
    danger: "#DC2626",
  },
  dark: {
    background: "#0B1220",
    surface: "#111827",
    card: "#111827",
    foreground: "#E2E8F0",
    text: "#E2E8F0",
    muted: "#94A3B8",
    primary: "#60A5FA",
    border: "#1F2937",
    success: "#22C55E",
    warning: "#FBBF24",
    error: "#F87171",
    danger: "#F87171",
  },
};

export const SchemeColors = Colors;
