import { Pressable, Text, ViewStyle, TextStyle, Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";

type Variant = "primary" | "dark" | "soft" | "outline";

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: Variant;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export function ModernButton({
  title,
  onPress,
  disabled = false,
  variant = "primary",
  style,
  textStyle,
}: Props) {
  const colors = useColors();

  const base: ViewStyle = {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    opacity: disabled ? 0.6 : 1,
    ...(Platform.OS === "web"
      ? { outlineStyle: "none", outlineWidth: 0 }
      : null),
  };

  const variants: Record<Variant, ViewStyle> = {
    primary: {
      backgroundColor: "#2563eb",
      shadowColor: "#2563eb",
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    dark: {
      backgroundColor: "#0f172a",
      shadowColor: "#0f172a",
      shadowOpacity: 0.16,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    soft: {
      backgroundColor: "rgba(15,23,42,0.06)",
      borderWidth: 1,
      borderColor: colors.border,
    },
    outline: {
      backgroundColor: "rgba(255,255,255,0.8)",
      borderWidth: 1,
      borderColor: colors.border,
    },
  };

  const labelColors: Record<Variant, string> = {
    primary: "#fff",
    dark: "#fff",
    soft: colors.text,
    outline: colors.text,
  };

  return (
    <Pressable onPress={onPress} disabled={disabled} style={[base, variants[variant], style]}>
      <Text style={[{ color: labelColors[variant], fontWeight: "800", fontSize: 13 }, textStyle]}>{title}</Text>
    </Pressable>
  );
}
