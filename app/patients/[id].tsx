// clinica-crm-mobile/app/patients/[id].tsx
import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { apiCall } from "@/lib/_core/api";
import { useAuth } from "@/hooks/use-auth";
import { ModernButton } from "@/components/modern-button";
import { useFeatures } from "@/hooks/use-features";
import { PlanLockedCard } from "@/components/plan-locked-card";

type Patient = {
  id: string;
  name?: string | null;
  phone?: string | null;
  birth_date?: string | null;
  sex?: string | null;
};

type Doctor = {
  id: string;
  name?: string | null;
  email?: string | null;
  specialty?: string | null;
};

type TimelineItem = {
  type: "ENCOUNTER" | "DOCUMENT" | "ATTACHMENT";
  created_at?: string | null;
  payload?: any;
};

function safeWhen(dateStr?: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function initialsFromName(name?: string | null) {
  const parts = String(name || "")
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

function ageFromBirth(dateStr?: string | null) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
  return years;
}

export default function PatientDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const auth = useAuth();
  const features = useFeatures();
  const hasRecords = features.has("PRONTUARIO");

  const params = useLocalSearchParams<{ id?: string }>();
  const id = String(params.id || "");
  const role = String(auth.user?.role || "").toUpperCase();
  const canStartEncounter = role === "MEDICO" || role === "ADMIN";
  const [doctorPickerOpen, setDoctorPickerOpen] = useState(false);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);

  const patientQ = useQuery({
    queryKey: ["patient", id],
    enabled: hasRecords && !!id,
    queryFn: async () => {
      const data = await apiCall<any>(`/patients/${id}`);
      return (data?.patient ?? data) as Patient;
    },
  });

  const timelineQ = useQuery({
    queryKey: ["patient-timeline", id],
    enabled: hasRecords && !!id,
    queryFn: async () => {
      const data = await apiCall<any>(`/patients/${id}/timeline`);
      return (data?.timeline ?? []) as TimelineItem[];
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

  const doctors = useMemo(() => doctorsQ.data ?? [], [doctorsQ.data]);
  const selectedDoctor = doctors.find((d) => d.id === selectedDoctorId) ?? null;

  const startEncounterM = useMutation({
    mutationFn: async () => {
      const doctorId = selectedDoctorId || doctors[0]?.id || null;
      if (!doctorId) throw new Error("Selecione um médico.");
      const data = await apiCall<any>(`/encounters`, {
        method: "POST",
        body: { patient_id: id, doctor_id: doctorId },
      });
      return data?.encounter ?? data;
    },
    onSuccess: async (encounter) => {
      await qc.invalidateQueries({ queryKey: ["patient-timeline", id] });
      if (encounter?.id) router.push({ pathname: "/encounters/[id]", params: { id: encounter.id } } as any);
    },
  });

  const patient = patientQ.data as Patient | undefined;
  const timeline = useMemo(() => timelineQ.data ?? [], [timelineQ.data]);
  const age = ageFromBirth(patient?.birth_date);

  return (
    <ScreenContainer className="bg-[#F4F6F8]">
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -160,
          left: -80,
          right: -80,
          height: 280,
          backgroundColor: "rgba(37,99,235,0.10)",
          borderBottomLeftRadius: 260,
          borderBottomRightRadius: 260,
        }}
      />

      <View
        style={{
          padding: 16,
          paddingBottom: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Pressable
          onPress={() => router.back()}
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.10)",
            backgroundColor: "white",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="arrow-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>Prontuário</Text>
        <View style={{ width: 36 }} />
      </View>

      {!hasRecords ? (
        <PlanLockedCard featureName="Prontuários" />
      ) : patientQ.isLoading || timelineQ.isLoading ? (
        <View style={{ padding: 16 }}>
          <ActivityIndicator />
        </View>
      ) : patientQ.isError || timelineQ.isError ? (
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
          <Text style={{ color: "#991B1B", fontWeight: "800" }}>Erro ao carregar paciente.</Text>
          <Text style={{ color: "#7F1D1D", marginTop: 6, lineHeight: 18 }}>
            {String((patientQ.error as any)?.message ?? (timelineQ.error as any)?.message ?? "Erro desconhecido")}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 40 }}>
          <Pressable
            style={{
              alignSelf: "flex-start",
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: "rgba(37,99,235,0.45)",
              backgroundColor: "rgba(37,99,235,0.10)",
              marginBottom: 10,
            }}
          >
            <Text style={{ fontWeight: "800", color: "#1E3A8A" }}>Adicionar tag</Text>
          </Pressable>

          <View
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: 16,
              borderWidth: 1,
              borderColor: "rgba(15,23,42,0.08)",
            }}
          >
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 999,
                  backgroundColor: avatarColor(String(patient?.name || patient?.id || "")),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "900", fontSize: 16 }}>
                  {initialsFromName(patient?.name)}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "900", color: colors.text, fontSize: 16 }} numberOfLines={2}>
                  {patient?.name || "Paciente"}
                </Text>
                <Text style={{ color: colors.muted, marginTop: 4 }}>{patient?.phone || "Sem telefone"}</Text>
                <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>
                  {age ? `Idade: ${age} anos` : "Idade não informada"}
                </Text>
                <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>Convênio: Particular</Text>
                <Text style={{ color: colors.muted, marginTop: 2, fontSize: 12 }}>Primeira consulta: —</Text>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 14, marginTop: 12 }}>
              <Pressable style={{ alignItems: "center" }}>
                <Ionicons name="call-outline" size={18} color={colors.muted} />
                <Text style={{ fontSize: 10, color: colors.muted }}>Ligar</Text>
              </Pressable>
              <Pressable style={{ alignItems: "center" }}>
                <Ionicons name="logo-whatsapp" size={18} color={colors.muted} />
                <Text style={{ fontSize: 10, color: colors.muted }}>WhatsApp</Text>
              </Pressable>
              <Pressable style={{ alignItems: "center" }}>
                <Ionicons name="mail-outline" size={18} color={colors.muted} />
                <Text style={{ fontSize: 10, color: colors.muted }}>Email</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <ModernButton
              title={startEncounterM.isPending ? "Iniciando..." : "Iniciar atendimento"}
              variant="primary"
              onPress={() => startEncounterM.mutate()}
              disabled={startEncounterM.isPending || !canStartEncounter}
            />

            <Pressable
              onPress={() => setDoctorPickerOpen(true)}
              style={{
                marginTop: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "rgba(0,0,0,0.10)",
                backgroundColor: "white",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>
                {selectedDoctor ? selectedDoctor.name || selectedDoctor.email : "Escolher médico"}
              </Text>
            </Pressable>

            {!canStartEncounter && (
              <Text style={{ marginTop: 8, color: colors.muted, fontSize: 12 }}>
                Apenas médico ou admin pode iniciar atendimentos.
              </Text>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 10 }}
            style={{ marginTop: 4 }}
          >
            {[
              { label: "Resumo", icon: "sparkles-outline" },
              { label: "Novo documento", icon: "document-text-outline" },
              { label: "Novo anexo", icon: "attach-outline" },
              { label: "Prescrição", icon: "medkit-outline" },
            ].map((item) => (
              <Pressable
                key={item.label}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: "rgba(15,23,42,0.10)",
                  backgroundColor: "white",
                }}
              >
                <Ionicons name={item.icon as any} size={14} color={colors.muted} />
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text }}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={{ marginTop: 14, gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: "rgba(15,23,42,0.08)",
                  borderRadius: 12,
                  backgroundColor: "white",
                  padding: 12,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>Antecedentes clínicos</Text>
                <Text style={{ color: colors.muted, marginTop: 6 }}>Inserir informação</Text>
              </View>
              <View
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: "rgba(15,23,42,0.08)",
                  borderRadius: 12,
                  backgroundColor: "white",
                  padding: 12,
                }}
              >
                <Text style={{ color: colors.text, fontWeight: "900" }}>Antecedentes cirúrgicos</Text>
                <Text style={{ color: colors.muted, marginTop: 6 }}>Inserir informação</Text>
              </View>
            </View>

            <View
              style={{
                borderWidth: 1,
                borderColor: "rgba(15,23,42,0.08)",
                borderRadius: 12,
                backgroundColor: "white",
                paddingHorizontal: 12,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "900" }}>Últimos diagnósticos</Text>
              <Ionicons name="chevron-down" size={16} color={colors.muted} />
            </View>

            <View
              style={{
                borderWidth: 1,
                borderColor: "rgba(15,23,42,0.08)",
                borderRadius: 12,
                backgroundColor: "white",
                paddingHorizontal: 12,
                paddingVertical: 10,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: colors.muted }}>Filtrar</Text>
              <Ionicons name="chevron-down" size={16} color={colors.muted} />
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "rgba(15,23,42,0.10)",
                  backgroundColor: "white",
                  alignItems: "center",
                }}
              >
                <Ionicons name="download-outline" size={16} color={colors.muted} />
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Baixar PDF</Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "rgba(15,23,42,0.10)",
                  backgroundColor: "white",
                  alignItems: "center",
                }}
              >
                <Ionicons name="print-outline" size={16} color={colors.muted} />
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Imprimir</Text>
              </Pressable>
              <Pressable
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "rgba(15,23,42,0.10)",
                  backgroundColor: "white",
                  alignItems: "center",
                }}
              >
                <Ionicons name="share-social-outline" size={16} color={colors.muted} />
                <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>Compartilhar</Text>
              </Pressable>
            </View>
          </View>

          <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text, marginTop: 14 }}>
            Histórico
          </Text>

          <View style={{ marginTop: 10 }}>
            {timeline.length === 0 ? (
              <Text style={{ color: colors.muted }}>Sem eventos ainda.</Text>
            ) : (
              <View style={{ position: "relative", paddingLeft: 16, gap: 12 }}>
                <View
                  style={{
                    position: "absolute",
                    left: 7,
                    top: 6,
                    bottom: 6,
                    width: 2,
                    backgroundColor: "rgba(59,130,246,0.25)",
                    borderRadius: 999,
                  }}
                />

                {timeline.map((t, idx) => {
                  const label = t.type === "ENCOUNTER" ? "Atendimento" : t.type === "DOCUMENT" ? "Documento" : "Anexo";
                  const icon =
                    t.type === "ENCOUNTER"
                      ? "time-outline"
                      : t.type === "DOCUMENT"
                        ? "document-text-outline"
                        : "attach-outline";
                  return (
                    <View key={`${t.type}-${idx}`} style={{ flexDirection: "row", gap: 10 }}>
                      <View
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 999,
                          backgroundColor: "#3B82F6",
                          marginTop: 6,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <View
                          style={{
                            alignSelf: "flex-start",
                            paddingHorizontal: 10,
                            paddingVertical: 4,
                            borderRadius: 999,
                            backgroundColor: "rgba(37,99,235,0.12)",
                            borderWidth: 1,
                            borderColor: "rgba(37,99,235,0.25)",
                            marginBottom: 6,
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "800", color: "#1E3A8A" }}>
                            {safeWhen(t.created_at)}
                          </Text>
                        </View>
                        <View
                          style={{
                            flex: 1,
                            borderWidth: 1,
                            borderColor: "rgba(15,23,42,0.08)",
                            backgroundColor: "white",
                            borderRadius: 12,
                            padding: 12,
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                            <Ionicons name={icon as any} size={14} color={colors.muted} />
                            <Text style={{ fontSize: 12, fontWeight: "900", color: colors.text }}>{label}</Text>
                          </View>
                          <Text style={{ marginTop: 6, color: colors.text }} numberOfLines={3}>
                            {t.payload?.title || t.payload?.type || t.payload?.status || "Detalhe"}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      )}

      <Modal visible={doctorPickerOpen} animationType="slide" transparent onRequestClose={() => setDoctorPickerOpen(false)}>
        <Pressable
          onPress={() => setDoctorPickerOpen(false)}
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
            <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Selecionar médico</Text>
            <View style={{ height: 12 }} />

            {doctorsQ.isLoading ? (
              <View style={{ paddingVertical: 18 }}>
                <ActivityIndicator />
              </View>
            ) : doctors.length === 0 ? (
              <Text style={{ color: colors.muted }}>Nenhum médico encontrado.</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {doctors.map((d) => {
                  const label = String(d.name ?? d.email ?? d.id);
                  const isCurrent = d.id === selectedDoctorId;
                  return (
                    <Pressable
                      key={d.id}
                      onPress={() => {
                        setSelectedDoctorId(d.id);
                        setDoctorPickerOpen(false);
                      }}
                      style={{
                        paddingVertical: 12,
                        paddingHorizontal: 12,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: isCurrent ? "rgba(16,185,129,0.45)" : "rgba(0,0,0,0.10)",
                        backgroundColor: isCurrent ? "rgba(16,185,129,0.12)" : "rgba(0,0,0,0.02)",
                      }}
                    >
                      <Text style={{ fontWeight: "900", color: isCurrent ? "#065F46" : colors.text }}>
                        {label}
                      </Text>
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
              onPress={() => setDoctorPickerOpen(false)}
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
    </ScreenContainer>
  );
}

