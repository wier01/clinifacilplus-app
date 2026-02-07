// clinica-crm-mobile/app/index.tsx
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";

export default function RootRedirect() {
  const router = useRouter();
  const colors = useColors();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (isAuthenticated) {
      router.replace("/(tabs)/inbox");
    } else {
      router.replace("/login");
    }
  }, [isAuthenticated, loading, router]);

  return (
    <ScreenContainer className="p-6">
      <View style={{ alignItems: "center", justifyContent: "center", flex: 1 }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 10, color: colors.muted, fontSize: 12 }}>Carregando sua sessão…</Text>
      </View>
    </ScreenContainer>
  );
}

