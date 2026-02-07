// clinica-crm-mobile/app/whatsapp-setup.tsx
import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { apiCall } from "@/lib/_core/api";
import { ModernButton } from "@/components/modern-button";
import { kvGet, kvSet } from "@/lib/_core/storage";

const KEY_ONBOARDING = "clinica_crm_onboarding_v1";

export default function WhatsappSetupScreen() {
  const colors = useColors();
  const router = useRouter();

  const [wabaId, setWabaId] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiCall<any>("/admin/whatsapp");
        const cfg = res?.whatsapp;
        if (cfg) {
          setWabaId(String(cfg.waba_id || ""));
          setPhoneNumberId(String(cfg.phone_number_id || ""));
          setDisplayPhone(String(cfg.display_phone_number || ""));
          setAccessToken(String(cfg.access_token || ""));
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  async function onSave() {
    if (!phoneNumberId.trim() || !wabaId.trim() || !accessToken.trim()) {
      Alert.alert("Campos obrigatórios", "Informe WABA ID, Phone Number ID e Access Token.");
      return;
    }

    try {
      setLoading(true);
      await apiCall("/admin/whatsapp", {
        method: "POST",
        body: {
          waba_id: wabaId.trim(),
          phone_number_id: phoneNumberId.trim(),
          display_phone_number: displayPhone.trim(),
          access_token: accessToken.trim(),
        },
      });
      Alert.alert("Salvo", "Configuração do WhatsApp salva com sucesso.");
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onValidate() {
    if (!phoneNumberId.trim()) {
      Alert.alert("Campos obrigatórios", "Informe o Phone Number ID.");
      return;
    }
    try {
      setValidating(true);
      const res = await apiCall<any>("/admin/whatsapp/validate", {
        method: "POST",
        body: { phone_number_id: phoneNumberId.trim() },
      });
      if (res?.validated) {
        try {
          const saved = await kvGet(KEY_ONBOARDING);
          const parsed = saved ? JSON.parse(saved) : {};
          const next = { ...parsed, whatsapp: true };
          await kvSet(KEY_ONBOARDING, JSON.stringify(next));
        } catch {
          // ignore
        }
        Alert.alert("Validado", "Número conectado com sucesso.");
      } else {
        Alert.alert("Aviso", "Não foi possível validar. Verifique token e IDs.");
      }
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? String(e));
    } finally {
      setValidating(false);
    }
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ width: "100%", maxWidth: 720, alignSelf: "center" }}>
          <View className="flex-row items-center mb-3" style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Pressable
              className="mr-3 px-3 py-2 rounded-xl bg-white/90 dark:bg-neutral-900/70"
              style={{ borderWidth: 1, borderColor: colors.border }}
              onPress={() => router.back()}
            >
              <Text style={{ color: colors.text }}>Voltar</Text>
            </Pressable>

            <Text className="text-[22px] font-extrabold flex-1" style={{ color: colors.text }}>
              Conectar WhatsApp
            </Text>
          </View>

          <View
            className="mx-4 rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
            style={{ borderWidth: 1, borderColor: colors.border }}
          >
            <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
              Dados do WhatsApp Cloud
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
              Use os dados do Meta Business Manager (WABA / Phone Number / Token).
            </Text>

            <TextInput
              value={wabaId}
              onChangeText={setWabaId}
              placeholder="WABA ID"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />

            <TextInput
              value={phoneNumberId}
              onChangeText={setPhoneNumberId}
              placeholder="Phone Number ID"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />

            <TextInput
              value={displayPhone}
              onChangeText={setDisplayPhone}
              placeholder="Número exibido (opcional)"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />

            <TextInput
              value={accessToken}
              onChangeText={setAccessToken}
              placeholder="Access Token"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />

            <View className="flex-row mt-4 gap-10">
              <View className="flex-1">
                <ModernButton
                  title={validating ? "Validando..." : "Validar conexão"}
                  variant="soft"
                  onPress={onValidate}
                  disabled={validating}
                />
              </View>
              <View className="flex-1">
                <ModernButton
                  title={loading ? "Salvando..." : "Salvar"}
                  variant="primary"
                  onPress={onSave}
                  disabled={loading}
                />
              </View>
            </View>

            {(loading || validating) && (
              <View className="flex-row items-center justify-center mt-3">
                <ActivityIndicator />
                <Text className="ml-2" style={{ color: colors.muted }}>
                  Processando…
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

