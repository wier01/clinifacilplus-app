// clinica-crm-mobile/app/oauth/callback.tsx
import { Text, View } from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

/**
 * This route existed in the original template (cookie-based OAuth).
 * Clínica CRM uses JWT pasted in Settings (Mais → Configurações).
 */
export default function OAuthCallback() {
  const colors = useColors();

  return (
    <ScreenContainer className="p-4">
      <Text className="text-[20px] font-extrabold" style={{ color: colors.text }}>
        OAuth desativado
      </Text>

      <View
        className="mt-4 rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70"
        style={{ borderWidth: 1, borderColor: colors.border }}
      >
        <Text style={{ color: colors.muted, lineHeight: 18 }}>
          Este app está usando autenticação via JWT.
          {"\n"}Vá em <Text style={{ fontWeight: "800", color: colors.text }}>Mais → Configurações</Text> e cole o token.
        </Text>
      </View>
    </ScreenContainer>
  );
}
