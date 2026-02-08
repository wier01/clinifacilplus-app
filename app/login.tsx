// clinica-crm-mobile/app/login.tsx
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { apiCall, setAuthToken } from "@/lib/_core/api";
import { useAuth } from "@/hooks/use-auth";
import { ModernButton } from "@/components/modern-button";

export default function LoginScreen() {
  const colors = useColors();
  const router = useRouter();
  const auth = useAuth();
  const containerStyle = { width: "100%", maxWidth: 720, alignSelf: "center" as const };

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Campos obrigatórios", "Informe email e senha.");
      return;
    }

    try {
      setLoading(true);
      const res = await apiCall<any>("/auth/login", {
        method: "POST",
        body: { email: email.trim(), password: password.trim() },
      });

      if (res?.token) {
        await setAuthToken(res.token);
        await auth.refresh();
      }

      router.replace("/(tabs)/inbox");
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 200, paddingTop: 64, paddingHorizontal: 8 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={containerStyle}>
          <View className="mx-6 rounded-3xl p-10 mb-10" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
              <View className="flex-row items-center mb-4">
                <Text className="text-[44px] font-extrabold flex-1" style={{ color: colors.text, lineHeight: 62, fontWeight: "800" }}>
                  Entrar
                </Text>
              </View>

              <Text className="text-[26px] leading-[52px]" style={{ color: colors.muted }}>
                Acesse sua clínica
              </Text>

              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={colors.muted}
                className="mt-7 rounded-xl px-6 py-[22px] text-[26px] bg-black/5 dark:bg-white/10"
                style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, lineHeight: 40 }}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Senha"
                placeholderTextColor={colors.muted}
                className="mt-7 rounded-xl px-6 py-[22px] text-[26px] bg-black/5 dark:bg-white/10"
                style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, lineHeight: 40 }}
                secureTextEntry
              />

              <View className="mt-8">
                <ModernButton
                  title={loading ? "Entrando..." : "Entrar"}
                  variant="primary"
                  onPress={onLogin}
                  disabled={loading}
                  style={{ paddingVertical: 22 }}
                  textStyle={{ fontSize: 26 }}
                />
              </View>

              <View className="mt-8">
                <Pressable onPress={() => router.push("/signup")}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 24, lineHeight: 44 }}>
                    Não tem conta? <Text style={{ color: "#2563eb" }}>Criar agora</Text>
                  </Text>
                </Pressable>
              </View>
            </View>

          {loading && (
            <View className="flex-row items-center justify-center">
              <ActivityIndicator />
              <Text className="ml-3 text-[24px]" style={{ color: colors.muted }}>
                Validando credenciais…
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

