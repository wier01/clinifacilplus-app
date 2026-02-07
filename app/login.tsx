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
  const containerStyle = { width: "100%", maxWidth: 560, alignSelf: "center" as const };

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
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={containerStyle}>
          <View className="flex-row items-center mb-3" style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Text className="text-[22px] font-extrabold flex-1" style={{ color: colors.text }}>
              Entrar
            </Text>
          </View>

          <View
            className="mx-4 rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
            style={{ borderWidth: 1, borderColor: colors.border }}
          >
            <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
              Acesse sua clínica
            </Text>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Senha"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
              secureTextEntry
            />

            <View className="mt-4">
              <ModernButton
                title={loading ? "Entrando..." : "Entrar"}
                variant="primary"
                onPress={onLogin}
                disabled={loading}
                style={{ paddingVertical: 14 }}
                textStyle={{ fontSize: 15 }}
              />
            </View>

            <View className="mt-4">
              <Pressable onPress={() => router.push("/signup")}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  Não tem conta? <Text style={{ color: "#2563eb" }}>Criar agora</Text>
                </Text>
              </Pressable>
            </View>
          </View>

          {loading && (
            <View className="flex-row items-center justify-center">
              <ActivityIndicator />
              <Text className="ml-2" style={{ color: colors.muted }}>
                Validando credenciais…
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

