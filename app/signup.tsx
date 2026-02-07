// clinica-crm-mobile/app/signup.tsx
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { apiCall, setAuthToken } from "@/lib/_core/api";
import { useAuth } from "@/hooks/use-auth";
import { SPECIALTIES, type SpecialtyValue } from "@/lib/specialties";
import { ModernButton } from "@/components/modern-button";

export default function SignupScreen() {
  const colors = useColors();
  const router = useRouter();
  const auth = useAuth();
  const containerStyle = { width: "100%", maxWidth: 720, alignSelf: "center" as const };
  const primary = colors.primary;

  const [clinicName, setClinicName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [specialty, setSpecialty] = useState<SpecialtyValue | "">("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSignup() {
    if (!clinicName.trim() || !adminName.trim() || !email.trim() || !password.trim()) {
      Alert.alert("Campos obrigatórios", "Informe nome da clínica, seu nome, email e senha.");
      return;
    }

    try {
      setLoading(true);
      const res = await apiCall<any>("/auth/signup", {
        method: "POST",
        body: {
          clinic_name: clinicName.trim(),
          admin_name: adminName.trim(),
          email: email.trim(),
          password: password.trim(),
          phone: phone.trim(),
          cnpj: cnpj.trim(),
          address: address.trim(),
          city: city.trim(),
          state: state.trim(),
          postal_code: postalCode.trim(),
          description: description.trim(),
          specialty: specialty || undefined,
        },
      });

      if (res?.token) {
        await setAuthToken(res.token);
        await auth.refresh();
      }

      Alert.alert("Conta criada", "Sua clínica foi criada com sucesso.");
      router.replace("/onboarding");
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 48, paddingTop: 12 }}>
        <View style={containerStyle}>
          <View
            className="mx-4 rounded-3xl p-5 mb-4"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <View className="flex-row items-center mb-3">
              <Pressable
                className="mr-3 px-3 py-2 rounded-xl"
                style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(79,139,255,0.08)" }}
                onPress={() => router.back()}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar</Text>
              </Pressable>

              <Text className="text-[22px] font-extrabold flex-1" style={{ color: colors.text }}>
                Criar conta
              </Text>
            </View>

            <View
              className="self-start px-3 py-1 rounded-full"
              style={{ backgroundColor: "rgba(16,185,129,0.12)", borderWidth: 1, borderColor: "rgba(16,185,129,0.35)" }}
            >
              <Text style={{ color: "#0F766E", fontWeight: "700", fontSize: 12 }}>Cadastro rápido</Text>
            </View>

            <Text className="mt-3 text-[13px]" style={{ color: colors.muted }}>
              Preencha os dados para criar sua clínica e começar a testar.
            </Text>
          </View>

          <View className="mx-4 rounded-3xl p-5 mb-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Text className="text-[15px] font-bold" style={{ color: colors.text }}>
              Dados da clínica
            </Text>

            <TextInput
              value={clinicName}
              onChangeText={setClinicName}
              placeholder="Nome da clínica"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />

            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Telefone"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
              keyboardType="phone-pad"
            />

            <TextInput
              value={cnpj}
              onChangeText={setCnpj}
              placeholder="CNPJ (opcional)"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />
          </View>

          <View className="mx-4 rounded-3xl p-5 mb-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Text className="text-[15px] font-bold" style={{ color: colors.text }}>
              Especialidade principal
            </Text>

            <Text className="text-[12px] mt-1" style={{ color: colors.muted }}>
              Ajuda na personalização inicial do atendimento.
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
              {SPECIALTIES.map((item) => {
                const active = specialty === item.value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setSpecialty(item.value)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? primary : colors.border,
                      backgroundColor: active ? "rgba(79,139,255,0.14)" : "rgba(0,0,0,0.02)",
                    }}
                  >
                    <Text style={{ fontWeight: "800", color: active ? primary : colors.text }}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="mx-4 rounded-3xl p-5 mb-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Text className="text-[15px] font-bold" style={{ color: colors.text }}>
              Endereço
            </Text>

            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Rua, número, bairro"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />

            <View className="flex-row mt-3">
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="Cidade"
                placeholderTextColor={colors.muted}
                className="flex-1 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10 mr-2"
                style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
              />
              <TextInput
                value={state}
                onChangeText={setState}
                placeholder="UF"
                placeholderTextColor={colors.muted}
                className="w-20 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
                style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
              />
            </View>

            <TextInput
              value={postalCode}
              onChangeText={setPostalCode}
              placeholder="CEP"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />
          </View>

          <View className="mx-4 rounded-3xl p-5 mb-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Text className="text-[15px] font-bold" style={{ color: colors.text }}>
              Sobre a clínica
            </Text>

            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Breve descrição (opcional)"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 90 }}
              multiline
            />
          </View>

          <View className="mx-4 rounded-3xl p-5 mb-4" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Text className="text-[15px] font-bold" style={{ color: colors.text }}>
              Dados do administrador
            </Text>

            <TextInput
              value={adminName}
              onChangeText={setAdminName}
              placeholder="Seu nome"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />

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
          </View>

          <View className="mx-4">
            <ModernButton
              title={loading ? "Criando..." : "Criar conta"}
              variant="primary"
              onPress={onSignup}
              disabled={loading}
              style={{ paddingVertical: 14 }}
              textStyle={{ fontSize: 15 }}
            />
          </View>

          <View className="mt-4 mx-4">
            <Pressable onPress={() => router.push("/login")}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>
                Já tem conta? <Text style={{ color: primary }}>Entrar</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

