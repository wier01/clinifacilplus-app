// clinica-crm-mobile/app/(tabs)/prontuarios.tsx
import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { apiCall } from "@/lib/_core/api";
import { useFeatures } from "@/hooks/use-features";
import { PlanLockedCard } from "@/components/plan-locked-card";

type Patient = {
  id: string;
  name?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  sex?: string | null;
  created_at?: string | null;
};

type Doctor = {
  id: string;
  name?: string | null;
  email?: string | null;
  specialty?: string | null;
};

function safeWhen(dateStr?: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

function normalizeText(value: string) {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function initialsFromName(s?: string | null) {
  const parts = String(s || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "PA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function avatarColor(label: string) {
  const palette = ["#2563EB", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#64748B"];
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export default function RecordsScreen() {
  const colors = useColors();
  const router = useRouter();
  const features = useFeatures();
  const hasRecords = features.has("PRONTUARIO");
  const [q, setQ] = useState("");
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [filterStatus, setFilterStatus] = useState<"ALL" | "NEW">("ALL");
  const [filterPayment, setFilterPayment] = useState<"ALL" | "PARTICULAR" | "CONVENIO">("ALL");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formBirth, setFormBirth] = useState("");
  const [formSex, setFormSex] = useState<"M" | "F" | "O" | "">("");
  const [formError, setFormError] = useState<string | null>(null);

  const patientsQ = useQuery({
    queryKey: ["patients", q],
    enabled: hasRecords,
    queryFn: async () => {
      const data = await apiCall<any>(`/patients?search=${encodeURIComponent(q)}`);
      const list: Patient[] = Array.isArray(data) ? data : (data?.patients ?? data?.data ?? []);
      return (list || []).map((p: any) => ({ ...p, id: String(p.id) }));
    },
  });

  const doctorsQ = useQuery({
    queryKey: ["doctors"],
    enabled: hasRecords,
    queryFn: async () => {
      const data = await apiCall<any>("/doctors");
      const list: Doctor[] = Array.isArray(data) ? data : (data?.data ?? []);
      return (list || []).filter(Boolean).map((d: any) => ({
        id: String(d.id),
        name: d.name ?? null,
        email: d.email ?? null,
        specialty: d.specialty ?? null,
      }));
    },
  });

  const patients = useMemo(() => {
    const list = (patientsQ.data ?? []) as Patient[];
    const query = normalizeText(q);

    const filtered = query
      ? list.filter((p) => {
          const name = normalizeText(String(p.name || ""));
          const phone = normalizeText(String(p.phone || ""));
          if (!name && !phone) return false;
          if (phone.includes(query)) return true;
          if (name.includes(query)) return true;
          const words = name.split(/\s+/).filter(Boolean);
          return words.some((w) => w.includes(query));
        })
      : list;

    const filteredByStatus =
      filterStatus === "NEW"
        ? filtered.filter((p) => {
            if (!p.created_at) return false;
            const dt = new Date(p.created_at);
            if (Number.isNaN(dt.getTime())) return false;
            return Date.now() - dt.getTime() <= 1000 * 60 * 60 * 24 * 30;
          })
        : filtered;

    return filteredByStatus.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", { sensitivity: "base" })
    );
  }, [patientsQ.data, q, filterStatus]);

  async function createPatient() {
    setFormError(null);
    const name = formName.trim();
    const phone = formPhone.trim();
    if (name.length < 2) return setFormError("Informe o nome.");
    if (!phone) return setFormError("Informe o telefone.");
    try {
      await apiCall("/patients", {
        method: "POST",
        body: {
          name,
          phone,
          birth_date: formBirth ? formBirth.trim() : undefined,
          sex: formSex || undefined,
        },
      });
      setFormName("");
      setFormPhone("");
      setFormBirth("");
      setFormSex("");
      setNewOpen(false);
      await patientsQ.refetch();
    } catch (e: any) {
      setFormError(String(e?.message ?? e));
    }
  }

  return (
    <ScreenContainer className="bg-[#F4F6F8]">
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -200,
          left: -120,
          right: -120,
          height: 320,
          backgroundColor: "rgba(37,99,235,0.10)",
          borderBottomLeftRadius: 260,
          borderBottomRightRadius: 260,
        }}
      />

      <View style={{ padding: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontSize: 24, fontWeight: "900", color: colors.text }}>Prontuários</Text>
            <Text style={{ marginTop: 2, color: colors.muted, fontSize: 12 }}>
              {patients.length} pacientes • histórico clínico
            </Text>
          </View>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: "rgba(37,99,235,0.12)",
              borderWidth: 1,
              borderColor: "rgba(37,99,235,0.2)",
            }}
          >
            <Text style={{ color: "#1E3A8A", fontSize: 11, fontWeight: "800" }}>Visão geral</Text>
          </View>
        </View>

        <View
          style={{
            marginTop: 14,
            borderWidth: 1,
            borderColor: "rgba(15,23,42,0.10)",
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: "white",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Digite nome, telefone ou CPF..."
              placeholderTextColor={colors.muted}
              style={{ color: colors.text, flex: 1 }}
            />
          </View>
        </View>

        <View style={{ marginTop: 10, flexDirection: "row", gap: 10 }}>
          <Pressable
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "rgba(15,23,42,0.08)",
              borderRadius: 14,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: "white",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
            onPress={() => setDoctorOpen(true)}
          >
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              {selectedDoctor?.name || selectedDoctor?.email || "Todos os profissionais"}
            </Text>
            <Ionicons name="chevron-down" size={16} color={colors.muted} />
          </Pressable>

          <Pressable
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "rgba(15,23,42,0.10)",
              backgroundColor: "white",
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={() => setFilterOpen(true)}
          >
            <Ionicons name="options-outline" size={16} color={colors.muted} />
          </Pressable>
        </View>

        <View style={{ marginTop: 12, flexDirection: "row", gap: 10 }}>
          <Pressable
            style={{
              flex: 1,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "rgba(37,99,235,0.45)",
              backgroundColor: "rgba(37,99,235,0.12)",
              alignItems: "center",
            }}
            onPress={() => setNewOpen(true)}
          >
            <Text style={{ fontWeight: "900", color: "#1E3A8A" }}>Novo paciente</Text>
          </Pressable>
          <Pressable
            style={{
              flex: 1,
              paddingHorizontal: 14,
              paddingVertical: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: "rgba(15,23,42,0.10)",
              backgroundColor: "white",
              alignItems: "center",
            }}
            onPress={() => setFilterOpen(true)}
          >
            <Text style={{ fontWeight: "800", color: colors.text }}>Filtros</Text>
          </Pressable>
        </View>
      </View>

      {!hasRecords ? (
        <PlanLockedCard featureName="Prontuários" />
      ) : patientsQ.isLoading ? (
        <View style={{ padding: 16 }}>
          <ActivityIndicator />
        </View>
      ) : patientsQ.isError ? (
        <View
          style={{
            margin: 16,
            backgroundColor: "#FEF2F2",
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: "#FECACA",
          }}
        >
          <Text style={{ color: "#991B1B", fontWeight: "800" }}>Erro ao carregar pacientes.</Text>
          <Text style={{ color: "#7F1D1D", marginTop: 6, lineHeight: 18 }}>
            {String((patientsQ.error as any)?.message ?? "Erro desconhecido")}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 6, paddingBottom: 40 }}>
          {patients.length === 0 ? (
            <View
              style={{
                padding: 20,
                borderRadius: 16,
                backgroundColor: "white",
                borderWidth: 1,
                borderColor: "rgba(15,23,42,0.08)",
              }}
            >
              <Text style={{ color: colors.muted, textAlign: "center" }}>Nenhum paciente encontrado.</Text>
            </View>
          ) : (
            <View
              style={{
                backgroundColor: "white",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: "rgba(15,23,42,0.08)",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  backgroundColor: "rgba(15,23,42,0.04)",
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(15,23,42,0.08)",
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: colors.muted, flex: 1 }}>NOME</Text>
                <Text style={{ fontSize: 11, fontWeight: "800", color: colors.muted, width: 120, textAlign: "right" }}>
                  CADASTRO
                </Text>
              </View>

              {patients.map((p, idx) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push({ pathname: "/patients/[id]", params: { id: p.id } } as any)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    borderBottomWidth: idx === patients.length - 1 ? 0 : 1,
                    borderBottomColor: "rgba(15,23,42,0.08)",
                  }}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 999,
                      backgroundColor: avatarColor(String(p.name || p.id)),
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    <Text style={{ color: "white", fontWeight: "900", fontSize: 11 }}>
                      {initialsFromName(p.name)}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "900", color: colors.text }} numberOfLines={1}>
                      {p.name || p.id}
                    </Text>
                    <Text style={{ color: colors.muted, marginTop: 2 }} numberOfLines={1}>
                      {p.phone || "Sem telefone"}
                    </Text>
                  </View>

                  <View style={{ width: 120, alignItems: "flex-end" }}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{safeWhen(p.created_at)}</Text>
                    <View
                      style={{
                        marginTop: 6,
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: "rgba(15,23,42,0.12)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="create-outline" size={14} color={colors.muted} />
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <Modal visible={doctorOpen} animationType="slide" transparent onRequestClose={() => setDoctorOpen(false)}>
        <Pressable
          onPress={() => setDoctorOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", padding: 18, justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.10)",
              maxHeight: "70%",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Profissionais</Text>
            <View style={{ height: 12 }} />

            {doctorsQ.isLoading ? (
              <View style={{ paddingVertical: 18 }}>
                <ActivityIndicator />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <Pressable
                  onPress={() => {
                    setSelectedDoctor(null);
                    setDoctorOpen(false);
                  }}
                  style={{
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.10)",
                    backgroundColor: "rgba(0,0,0,0.02)",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: colors.text }}>Todos os profissionais</Text>
                </Pressable>

                {(doctorsQ.data ?? []).map((d) => {
                  const label = String(d.name ?? d.email ?? d.id);
                  return (
                    <Pressable
                      key={d.id}
                      onPress={() => {
                        setSelectedDoctor(d);
                        setDoctorOpen(false);
                      }}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: "rgba(0,0,0,0.10)",
                        backgroundColor: "rgba(0,0,0,0.02)",
                      }}
                    >
                      <Text style={{ fontWeight: "900", color: colors.text }}>{label}</Text>
                      {d.specialty ? (
                        <Text style={{ color: colors.muted, fontSize: 12 }}>{d.specialty}</Text>
                      ) : null}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            <View style={{ height: 12 }} />
            <Pressable
              onPress={() => setDoctorOpen(false)}
              style={{
                paddingVertical: 12,
                borderRadius: 12,
                paddingHorizontal: 12,
                backgroundColor: "rgba(0,0,0,0.02)",
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.10)",
              }}
            >
              <Text style={{ fontWeight: "900", color: colors.text }}>Cancelar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={filterOpen} animationType="slide" transparent onRequestClose={() => setFilterOpen(false)}>
        <Pressable
          onPress={() => setFilterOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", padding: 18, justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.10)",
              maxHeight: "70%",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Filtros</Text>

            <Text style={{ marginTop: 10, color: colors.muted, fontSize: 12 }}>Status</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              {(["ALL", "NEW"] as const).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setFilterStatus(s)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: filterStatus === s ? "rgba(59,130,246,0.45)" : "rgba(0,0,0,0.10)",
                    backgroundColor: filterStatus === s ? "rgba(59,130,246,0.12)" : "rgba(0,0,0,0.02)",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "900", color: filterStatus === s ? "#1E3A8A" : colors.text }}>
                    {s === "ALL" ? "Todos" : "Novos (30d)"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={{ marginTop: 12, color: colors.muted, fontSize: 12 }}>Convênio</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
              {(["ALL", "PARTICULAR", "CONVENIO"] as const).map((s) => (
                <Pressable
                  key={s}
                  onPress={() => setFilterPayment(s)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: filterPayment === s ? "rgba(16,185,129,0.45)" : "rgba(0,0,0,0.10)",
                    backgroundColor: filterPayment === s ? "rgba(16,185,129,0.12)" : "rgba(0,0,0,0.02)",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "900", color: filterPayment === s ? "#065F46" : colors.text }}>
                    {s === "ALL" ? "Todos" : s === "PARTICULAR" ? "Particular" : "Convênio"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={{ height: 12 }} />
            <Pressable
              onPress={() => setFilterOpen(false)}
              style={{
                paddingVertical: 12,
                borderRadius: 12,
                paddingHorizontal: 12,
                backgroundColor: "rgba(0,0,0,0.02)",
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.10)",
              }}
            >
              <Text style={{ fontWeight: "900", color: colors.text }}>Concluir</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={newOpen} animationType="slide" transparent onRequestClose={() => setNewOpen(false)}>
        <Pressable
          onPress={() => setNewOpen(false)}
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", padding: 18, justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: 14,
              borderWidth: 1,
              borderColor: "rgba(0,0,0,0.10)",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Novo paciente</Text>

            <TextInput
              value={formName}
              onChangeText={setFormName}
              placeholder="Nome completo"
              placeholderTextColor={colors.muted}
              style={{
                marginTop: 10,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.text,
                backgroundColor: "rgba(0,0,0,0.03)",
              }}
            />
            <TextInput
              value={formPhone}
              onChangeText={setFormPhone}
              placeholder="Telefone"
              placeholderTextColor={colors.muted}
              style={{
                marginTop: 8,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
                color: colors.text,
                backgroundColor: "rgba(0,0,0,0.03)",
              }}
            />
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              <TextInput
                value={formBirth}
                onChangeText={setFormBirth}
                placeholder="Nascimento (YYYY-MM-DD)"
                placeholderTextColor={colors.muted}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.text,
                  backgroundColor: "rgba(0,0,0,0.03)",
                }}
              />
              <TextInput
                value={formSex}
                onChangeText={(v) => setFormSex((v || "").toUpperCase() as any)}
                placeholder="Sexo (M/F/O)"
                placeholderTextColor={colors.muted}
                style={{
                  width: 120,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  color: colors.text,
                  backgroundColor: "rgba(0,0,0,0.03)",
                }}
              />
            </View>

            {formError ? (
              <Text style={{ marginTop: 6, color: "#991B1B", fontSize: 12 }}>{formError}</Text>
            ) : null}

            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={() => setNewOpen(false)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  backgroundColor: "rgba(0,0,0,0.02)",
                  borderWidth: 1,
                  borderColor: "rgba(0,0,0,0.10)",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: colors.text }}>Cancelar</Text>
              </Pressable>

              <Pressable
                onPress={createPatient}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  backgroundColor: "rgba(37,99,235,0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(37,99,235,0.45)",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "900", color: "#1E3A8A" }}>Salvar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}


