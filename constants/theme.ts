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
    background: "#F1FAFF",
    surface: "#FFFFFF",
    card: "#FFFFFF",
    foreground: "#0F172A",
    text: "#0F172A",
    muted: "#5B728A",
    primary: "#2563EB",
    border: "#DCEAF5",
    success: "#10B981",
    warning: "#F59E0B",
    error: "#DC2626",
    danger: "#DC2626",
  },
  dark: {
    background: "#0A1526",
    surface: "#0F1F33",
    card: "#0F1F33",
    foreground: "#E2E8F0",
    text: "#E2E8F0",
    muted: "#8AA4BF",
    primary: "#4F8BFF",
    border: "#13304B",
    success: "#34D399",
    warning: "#FBBF24",
    error: "#F87171",
    danger: "#F87171",
  },
};

export const SchemeColors = Colors;
