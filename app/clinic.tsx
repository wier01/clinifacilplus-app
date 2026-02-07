// clinica-crm-mobile/app/clinic.tsx
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { apiCall } from "@/lib/_core/api";
import { useAuth } from "@/hooks/use-auth";
import { SPECIALTIES, type SpecialtyValue } from "@/lib/specialties";
import { ModernButton } from "@/components/modern-button";

type Clinic = {
  id: string;
  name: string;
  phone?: string | null;
  cnpj?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  description?: string | null;
  active?: number | null;
};

type Staff = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "SECRETARIA" | "MEDICO";
  active: number;
  doctor_id?: string | null;
  specialty?: string | null;
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  SECRETARIA: "Secretaria",
  MEDICO: "Profissional",
};

export default function ClinicScreen() {
  const colors = useColors();
  const router = useRouter();
  const auth = useAuth();

  const isAdmin = auth.user?.role === "ADMIN";

  const [loading, setLoading] = useState(false);
  const [clinic, setClinic] = useState<Clinic | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);

  const [clinicForm, setClinicForm] = useState({
    name: "",
    phone: "",
    cnpj: "",
    address: "",
    city: "",
    state: "",
    postal_code: "",
    description: "",
  });

  const [staffForm, setStaffForm] = useState({
    id: "",
    name: "",
    email: "",
    role: "MEDICO" as Staff["role"],
    password: "",
    specialty: "" as SpecialtyValue | "",
  });

  const isEditing = !!staffForm.id;

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        setLoading(true);
        const clinicRes = await apiCall<any>("/clinic");
        const staffRes = await apiCall<any>("/staff");
        const c = clinicRes?.clinic ?? null;
        setClinic(c);
        if (c) {
          setClinicForm({
            name: c.name || "",
            phone: c.phone || "",
            cnpj: c.cnpj || "",
            address: c.address || "",
            city: c.city || "",
            state: c.state || "",
            postal_code: c.postal_code || "",
            description: c.description || "",
          });
        }
        setStaff(staffRes?.items ?? []);
      } catch (e: any) {
        Alert.alert("Erro", e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [isAdmin]);

  async function refreshStaff() {
    const staffRes = await apiCall<any>("/staff");
    setStaff(staffRes?.items ?? []);
  }

  async function onSaveClinic() {
    try {
      setLoading(true);
      await apiCall("/clinic", {
        method: "PATCH",
        body: {
          name: clinicForm.name.trim(),
          phone: clinicForm.phone.trim(),
          cnpj: clinicForm.cnpj.trim(),
          address: clinicForm.address.trim(),
          city: clinicForm.city.trim(),
          state: clinicForm.state.trim(),
          postal_code: clinicForm.postal_code.trim(),
          description: clinicForm.description.trim(),
        },
      });
      Alert.alert("OK", "Dados da clínica atualizados.");
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onDeactivateClinic() {
    Alert.alert("Desativar clínica", "Tem certeza? Isso desativa todos os usuários.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Desativar",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);
            await apiCall("/clinic", { method: "DELETE" });
            Alert.alert("OK", "Clínica desativada.");
            await auth.logout();
            router.replace("/(tabs)/inbox");
          } catch (e: any) {
            Alert.alert("Erro", e?.message ?? String(e));
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }

  async function onSaveStaff() {
    try {
      if (staffForm.role === "MEDICO" && !staffForm.specialty) {
        Alert.alert("Especialidade obrigatória", "Selecione a especialidade do profissional.");
        return;
      }
      setLoading(true);
      if (isEditing) {
        await apiCall(`/staff/${staffForm.id}`, {
          method: "PATCH",
          body: {
            name: staffForm.name.trim(),
            email: staffForm.email.trim(),
            role: staffForm.role,
            password: staffForm.password.trim() ? staffForm.password.trim() : undefined,
            specialty: staffForm.specialty,
          },
        });
        Alert.alert("OK", "Pessoa atualizada.");
      } else {
        await apiCall(`/staff`, {
          method: "POST",
          body: {
            name: staffForm.name.trim(),
            email: staffForm.email.trim(),
            role: staffForm.role,
            password: staffForm.password.trim(),
            specialty: staffForm.specialty,
          },
        });
        Alert.alert("OK", "Pessoa adicionada.");
      }

      setStaffForm({ id: "", name: "", email: "", role: "MEDICO", password: "", specialty: "" });
      await refreshStaff();
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onDeactivateStaff(userId: string) {
    Alert.alert("Desativar pessoa", "Tem certeza?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Desativar",
        style: "destructive",
        onPress: async () => {
          try {
            setLoading(true);
            await apiCall(`/staff/${userId}`, { method: "DELETE" });
            await refreshStaff();
          } catch (e: any) {
            Alert.alert("Erro", e?.message ?? String(e));
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  }

  const roleButtons = useMemo(
    () => (
      <View className="flex-row mt-2">
        {(["ADMIN", "SECRETARIA", "MEDICO"] as Staff["role"][]).map((r) => (
          <Pressable
            key={r}
            className="mr-2 px-3 py-2 rounded-xl"
            style={{
              backgroundColor: staffForm.role === r ? "#2563eb" : "transparent",
              borderWidth: 1,
              borderColor: colors.border,
            }}
            onPress={() => setStaffForm((prev) => ({ ...prev, role: r }))}
          >
            <Text style={{ color: staffForm.role === r ? "#fff" : colors.text, fontWeight: "700" }}>
              {ROLE_LABEL[r]}
            </Text>
          </Pressable>
        ))}
      </View>
    ),
    [colors.border, colors.text, staffForm.role]
  );

  if (!isAdmin) {
    return (
      <ScreenContainer className="p-4">
        <Text className="text-[18px] font-extrabold" style={{ color: colors.text }}>
          Administração da clínica
        </Text>
        <Text className="mt-2 text-[13px]" style={{ color: colors.muted }}>
          Apenas administradores podem acessar esta área.
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-row items-center mb-3">
          <Pressable
            className="mr-3 px-3 py-2 rounded-xl bg-white/90 dark:bg-neutral-900/70"
            style={{ borderWidth: 1, borderColor: colors.border }}
            onPress={() => router.back()}
          >
            <Text style={{ color: colors.text }}>Voltar</Text>
          </Pressable>

          <Text className="text-[22px] font-extrabold flex-1" style={{ color: colors.text }}>
            Minha clínica
          </Text>
        </View>

        <View
          className="rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
          style={{ borderWidth: 1, borderColor: colors.border }}
        >
          <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
            Perfil da clínica
          </Text>

          <TextInput
            value={clinicForm.name}
            onChangeText={(v) => setClinicForm((s) => ({ ...s, name: v }))}
            placeholder="Nome da clínica"
            placeholderTextColor={colors.muted}
            className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
            style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
          />

          <TextInput
            value={clinicForm.phone}
            onChangeText={(v) => setClinicForm((s) => ({ ...s, phone: v }))}
            placeholder="Telefone"
            placeholderTextColor={colors.muted}
            className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
            style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
          />

          <TextInput
            value={clinicForm.cnpj}
            onChangeText={(v) => setClinicForm((s) => ({ ...s, cnpj: v }))}
            placeholder="CNPJ"
            placeholderTextColor={colors.muted}
            className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
            style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
          />

          <TextInput
            value={clinicForm.address}
            onChangeText={(v) => setClinicForm((s) => ({ ...s, address: v }))}
            placeholder="Endereço"
            placeholderTextColor={colors.muted}
            className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
            style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
          />

          <View className="flex-row mt-3">
            <TextInput
              value={clinicForm.city}
              onChangeText={(v) => setClinicForm((s) => ({ ...s, city: v }))}
              placeholder="Cidade"
              placeholderTextColor={colors.muted}
              className="flex-1 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10 mr-2"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />
            <TextInput
              value={clinicForm.state}
              onChangeText={(v) => setClinicForm((s) => ({ ...s, state: v }))}
              placeholder="UF"
              placeholderTextColor={colors.muted}
              className="w-20 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />
          </View>

          <TextInput
            value={clinicForm.postal_code}
            onChangeText={(v) => setClinicForm((s) => ({ ...s, postal_code: v }))}
            placeholder="CEP"
            placeholderTextColor={colors.muted}
            className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
            style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
          />

          <TextInput
            value={clinicForm.description}
            onChangeText={(v) => setClinicForm((s) => ({ ...s, description: v }))}
            placeholder="Descrição (opcional)"
            placeholderTextColor={colors.muted}
            className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
            style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 80 }}
            multiline
          />

          <View className="flex-row mt-3">
            <View className="flex-1">
              <ModernButton title="Salvar clínica" variant="primary" onPress={onSaveClinic} />
            </View>
          </View>

          <View className="flex-row mt-3">
            <View className="flex-1">
              <ModernButton title="Desativar clínica" variant="dark" onPress={onDeactivateClinic} />
            </View>
          </View>
        </View>

        <View
          className="rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
          style={{ borderWidth: 1, borderColor: colors.border }}
        >
          <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
            Equipe
          </Text>

          <Text className="text-[12px] mt-1" style={{ color: colors.muted }}>
            Adicione e gerencie quem trabalha na clínica.
          </Text>

          <TextInput
            value={staffForm.name}
            onChangeText={(v) => setStaffForm((s) => ({ ...s, name: v }))}
            placeholder="Nome"
            placeholderTextColor={colors.muted}
            className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
            style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
          />

          <TextInput
            value={staffForm.email}
            onChangeText={(v) => setStaffForm((s) => ({ ...s, email: v }))}
            placeholder="Email"
            placeholderTextColor={colors.muted}
            className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
            style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            autoCapitalize="none"
          />

          {roleButtons}

          <TextInput
            value={staffForm.password}
            onChangeText={(v) => setStaffForm((s) => ({ ...s, password: v }))}
            placeholder={isEditing ? "Senha (opcional para alterar)" : "Senha"}
            placeholderTextColor={colors.muted}
            className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
            style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            secureTextEntry
          />

          {staffForm.role === "MEDICO" && (
            <View style={{ marginTop: 12 }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 12 }}>Especialidade</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {SPECIALTIES.map((item) => {
                  const active = staffForm.specialty === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => setStaffForm((s) => ({ ...s, specialty: item.value }))}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: active ? "#2563eb" : colors.border,
                        backgroundColor: active ? "rgba(37,99,235,0.12)" : "rgba(0,0,0,0.02)",
                      }}
                    >
                      <Text style={{ fontWeight: "800", color: active ? "#1E3A8A" : colors.text }}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          <View className="flex-row mt-3">
            <View className="flex-1">
              <ModernButton
                title="Limpar"
                variant="dark"
                onPress={() =>
                  setStaffForm({ id: "", name: "", email: "", role: "MEDICO", password: "", specialty: "" })
                }
              />
            </View>
            <View className="flex-1 ml-2">
              <ModernButton title={isEditing ? "Salvar alterações" : "Adicionar"} variant="primary" onPress={onSaveStaff} />
            </View>
          </View>

          {staff.length > 0 && (
            <View className="mt-4">
              {staff.map((p) => (
                <View
                  key={p.id}
                  className="rounded-xl p-3 mb-2 bg-black/5 dark:bg-white/10"
                  style={{ borderWidth: 1, borderColor: colors.border }}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>{p.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{p.email}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {ROLE_LABEL[p.role]} {p.specialty ? `• ${p.specialty}` : ""} {p.active ? "" : "• Inativo"}
                  </Text>

                  <View className="flex-row mt-2">
                    <View className="flex-1 mr-2">
                      <ModernButton
                        title="Editar"
                        variant="dark"
                        onPress={() =>
                          setStaffForm({
                            id: p.id,
                            name: p.name,
                            email: p.email,
                            role: p.role,
                            password: "",
                            specialty: p.specialty || "",
                          })
                        }
                        style={{ paddingVertical: 10, borderRadius: 12 }}
                        textStyle={{ fontSize: 12 }}
                      />
                    </View>

                    <View className="flex-1">
                      <ModernButton
                        title="Desativar"
                        variant="dark"
                        onPress={() => onDeactivateStaff(p.id)}
                        style={{ paddingVertical: 10, borderRadius: 12, backgroundColor: "#ef4444" }}
                        textStyle={{ fontSize: 12 }}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {loading && (
          <View className="flex-row items-center justify-center">
            <ActivityIndicator color={colors.text} />
            <Text className="ml-2" style={{ color: colors.text }}>
              Processando...
            </Text>
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
