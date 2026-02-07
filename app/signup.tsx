// clinica-crm-mobile/app/signup.tsx
import { useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { apiCall, setAuthToken } from "@/lib/_core/api";
import { useAuth } from "@/hooks/use-auth";
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
  const [specialty, setSpecialty] = useState("");
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
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -120,
            right: -140,
            width: 320,
            height: 320,
            borderRadius: 999,
            backgroundColor: "rgba(79,139,255,0.10)",
          }}
        />
        <Text
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 140,
            right: -40,
            fontSize: 125,
            fontWeight: "800",
            color: "rgba(79,139,255,0.07)",
            transform: [{ rotate: "-8deg" }],
          }}
        >
          Clinifácil Plus
        </Text>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: 40,
            left: -120,
            width: 260,
            height: 260,
            borderRadius: 999,
            backgroundColor: "rgba(16,185,129,0.08)",
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: 120,
            left: "20%",
            width: 220,
            height: 220,
            borderRadius: 999,
            borderWidth: 2,
            borderColor: "rgba(79,139,255,0.12)",
          }}
        />

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 140, paddingTop: 48 }}
        >
          <View style={containerStyle}>
          <View
            className="mx-6 rounded-3xl p-8 mb-8"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}
          >
            <View className="flex-row items-center mb-3">
              <Pressable
                className="mr-3 px-4 py-3 rounded-xl"
                style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(79,139,255,0.08)" }}
                onPress={() => router.back()}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar</Text>
              </Pressable>

              <Text className="text-[48px] font-extrabold flex-1" style={{ color: colors.text, lineHeight: 66 }}>
                Criar conta
              </Text>
            </View>

            <View
              className="self-start px-3 py-1.5 rounded-full"
              style={{ backgroundColor: "rgba(16,185,129,0.12)", borderWidth: 1, borderColor: "rgba(16,185,129,0.35)" }}
            >
              <Text style={{ color: "#0F766E", fontWeight: "700", fontSize: 22 }}>Cadastro rápido</Text>
            </View>

            <Text className="mt-5 text-[30px] leading-[55px]" style={{ color: colors.muted }}>
              Preencha os dados para criar sua clínica e começar a testar.
            </Text>
          </View>

          <View className="mx-6 rounded-3xl p-8 mb-10" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Text className="text-[33px] font-bold leading-[60px]" style={{ color: colors.text }}>
              Dados da clínica
            </Text>

            <TextInput
              value={clinicName}
              onChangeText={setClinicName}
              placeholder="Nome da clínica"
              placeholderTextColor={colors.muted}
              className="mt-7 rounded-xl px-6 py-[24px] text-[31px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, lineHeight: 48 }}
            />

            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Telefone"
              placeholderTextColor={colors.muted}
              className="mt-7 rounded-xl px-6 py-[24px] text-[31px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, lineHeight: 48 }}
              keyboardType="phone-pad"
            />

            <TextInput
              value={cnpj}
              onChangeText={setCnpj}
              placeholder="CNPJ (opcional)"
              placeholderTextColor={colors.muted}
              className="mt-7 rounded-xl px-6 py-[24px] text-[31px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, lineHeight: 48 }}
            />
          </View>

          <View className="mx-6 rounded-3xl p-8 mb-10" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Text className="text-[33px] font-bold leading-[60px]" style={{ color: colors.text }}>
              Especialidade principal
            </Text>

            <Text className="text-[28px] mt-5 leading-[55px]" style={{ color: colors.muted }}>
              Informe a principal área de atuação (ex.: Fisioterapia, Ortopedia, Pediatria).
            </Text>

            <TextInput
              value={specialty}
              onChangeText={setSpecialty}
              placeholder="Digite a especialidade"
              placeholderTextColor={colors.muted}
              className="mt-7 rounded-xl px-6 py-[24px] text-[31px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, lineHeight: 48 }}
            />
          </View>

          <View className="mx-6 rounded-3xl p-8 mb-10" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Text className="text-[33px] font-bold leading-[60px]" style={{ color: colors.text }}>
              Endereço
            </Text>

            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Rua, número, bairro"
              placeholderTextColor={colors.muted}
              className="mt-7 rounded-xl px-6 py-[24px] text-[31px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, lineHeight: 48 }}
            />

            <View className="flex-row mt-7">
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="Cidade"
                placeholderTextColor={colors.muted}
                className="flex-1 rounded-xl px-6 py-[24px] text-[31px] bg-black/5 dark:bg-white/10 mr-2"
                style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, lineHeight: 48 }}
              />
              <TextInput
                value={state}
                onChangeText={setState}
                placeholder="UF"
                placeholderTextColor={colors.muted}
                className="w-24 rounded-xl px-5 py-[24px] text-[31px] bg-black/5 dark:bg-white/10"
                style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, lineHeight: 48 }}
              />
            </View>

            <TextInput
              value={postalCode}
              onChangeText={setPostalCode}
              placeholder="CEP"
              placeholderTextColor={colors.muted}
              className="mt-7 rounded-xl px-6 py-[24px] text-[31px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, lineHeight: 48 }}
            />
          </View>

          <View className="mx-6 rounded-3xl p-8 mb-10" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Text className="text-[33px] font-bold leading-[60px]" style={{ color: colors.text }}>
              Sobre a clínica
            </Text>

            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Breve descrição (opcional)"
              placeholderTextColor={colors.muted}
              className="mt-7 rounded-xl px-6 py-[24px] text-[31px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 190, lineHeight: 48 }}
              multiline
            />
          </View>

          <View className="mx-6 rounded-3xl p-8 mb-10" style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }}>
            <Text className="text-[33px] font-bold leading-[60px]" style={{ color: colors.text }}>
              Dados do administrador
            </Text>

            <TextInput
              value={adminName}
              onChangeText={setAdminName}
              placeholder="Seu nome"
              placeholderTextColor={colors.muted}
              className="mt-7 rounded-xl px-6 py-[24px] text-[31px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, lineHeight: 48 }}
            />

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              className="mt-7 rounded-xl px-6 py-[24px] text-[31px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, lineHeight: 48 }}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Senha"
              placeholderTextColor={colors.muted}
              className="mt-7 rounded-xl px-6 py-[24px] text-[31px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, lineHeight: 48 }}
              secureTextEntry
            />
          </View>

          <View className="mx-6">
            <ModernButton
              title={loading ? "Criando..." : "Criar conta"}
              variant="primary"
              onPress={onSignup}
              disabled={loading}
              style={{ paddingVertical: 24 }}
              textStyle={{ fontSize: 31 }}
            />
          </View>

          <View className="mt-8 mx-6">
            <Pressable onPress={() => router.push("/login")}>
              <Text style={{ color: colors.text, fontWeight: "700", lineHeight: 55, fontSize: 30 }}>
                Já tem conta? <Text style={{ color: primary }}>Entrar</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
    </ScreenContainer>
  );
}

