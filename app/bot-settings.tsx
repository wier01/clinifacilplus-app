import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { apiCall } from "@/lib/_core/api";

type BotSettings = {
  enabled: number;
  tone: "FORMAL" | "NEUTRAL" | "AMIGAVEL";
  collect_insurance: number;
  collect_visit_type: number;
  collect_date: number;
  collect_time: number;
  fallback_to_human: number;
};

type BotService = {
  id: string;
  code: string;
  name: string;
  active: number;
  duration_min?: number | null;
  order_index?: number | null;
};

type BotMessage = {
  id: string;
  key: string;
  content: string;
  active: number;
};

type StaffRow = {
  id: string;
  name: string;
  role: string;
  doctor_id?: string | null;
  specialty?: string | null;
};

type InsurancePlan = {
  id: string;
  name: string;
};

type InsuranceDay = {
  weekday: number;
  insurance_plan_id?: string | null;
  insurance_name?: string | null;
};

const messageDefaults = [
  { key: "GREETING", label: "Saudação" },
  { key: "ASK_PAYMENT", label: "Pergunta de pagamento" },
  { key: "ASK_VISIT", label: "Primeira / Retorno" },
  { key: "ASK_DATE", label: "Pergunta de data" },
  { key: "ASK_SLOT", label: "Lista de horários" },
  { key: "ASK_PATIENT_NAME", label: "Nome do paciente" },
  { key: "ASK_PATIENT_NAME_MIN", label: "Nome mínimo" },
  { key: "SUMMARY", label: "Resumo" },
  { key: "CONFIRMED", label: "Confirmado" },
];

const weekdays = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

export default function BotSettingsScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();

  const settingsQ = useQuery({
    queryKey: ["bot-settings"],
    queryFn: async () => {
      const data = await apiCall<any>("/bot/settings");
      return data?.settings as BotSettings;
    },
  });

  const servicesQ = useQuery({
    queryKey: ["bot-services"],
    queryFn: async () => {
      const data = await apiCall<any>("/bot/services");
      return (data?.services ?? []) as BotService[];
    },
  });

  const messagesQ = useQuery({
    queryKey: ["bot-messages"],
    queryFn: async () => {
      const data = await apiCall<any>("/bot/messages");
      return (data?.messages ?? []) as BotMessage[];
    },
  });

  const staffQ = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const data = await apiCall<any>("/staff");
      return (data?.staff ?? data ?? []) as StaffRow[];
    },
  });

  const plansQ = useQuery({
    queryKey: ["insurance-plans"],
    queryFn: async () => {
      const data = await apiCall<any>("/insurance-plans");
      return (data?.plans ?? data ?? []) as InsurancePlan[];
    },
  });

  const [settingsDraft, setSettingsDraft] = useState<BotSettings | null>(null);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [serviceCode, setServiceCode] = useState("");
  const [serviceName, setServiceName] = useState("");
  const [serviceDuration, setServiceDuration] = useState("");

  const [messagesDraft, setMessagesDraft] = useState<Record<string, string>>({});

  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedWeekday, setSelectedWeekday] = useState<number>(1);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const daysQ = useQuery({
    queryKey: ["doctor-insurance-days", selectedDoctorId],
    enabled: !!selectedDoctorId,
    queryFn: async () => {
      const data = await apiCall<any>(`/doctor-insurance-days?doctor_id=${selectedDoctorId}`);
      return (data?.days ?? data ?? []) as InsuranceDay[];
    },
  });

  const settings = settingsDraft ?? settingsQ.data;

  const doctors = useMemo(() => {
    const list = staffQ.data ?? [];
    return list.filter((s) => s.doctor_id);
  }, [staffQ.data]);

  const mergedMessages = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of messagesQ.data ?? []) map.set(String(m.key).toUpperCase(), String(m.content || ""));
    for (const def of messageDefaults) {
      if (!map.has(def.key)) map.set(def.key, "");
    }
    return map;
  }, [messagesQ.data]);

  function toggleSetting(key: keyof BotSettings) {
    if (!settings) return;
    const next = {
      ...settings,
      [key]: settings[key] ? 0 : 1,
    };
    setSettingsDraft(next);
  }

  async function saveSettings() {
    if (!settings) return;
    await apiCall("/bot/settings", { method: "PUT", body: settings });
    setSettingsDraft(null);
    await qc.invalidateQueries({ queryKey: ["bot-settings"] });
  }

  async function addService() {
    if (!serviceCode.trim() || !serviceName.trim()) return;
    await apiCall("/bot/services", {
      method: "POST",
      body: {
        code: serviceCode.trim(),
        name: serviceName.trim(),
        duration_min: serviceDuration ? Number(serviceDuration) : null,
      },
    });
    setServiceCode("");
    setServiceName("");
    setServiceDuration("");
    setServiceOpen(false);
    await qc.invalidateQueries({ queryKey: ["bot-services"] });
  }

  async function saveMessages() {
    const items = Object.entries(messagesDraft).map(([key, content]) => ({ key, content }));
    if (!items.length) return;
    await apiCall("/bot/messages", { method: "PUT", body: { messages: items } });
    setMessagesDraft({});
    await qc.invalidateQueries({ queryKey: ["bot-messages"] });
  }

  async function addInsuranceDay() {
    if (!selectedDoctorId) return;
    const existing = (daysQ.data ?? []) as InsuranceDay[];
    const next = [...existing.filter((d) => d.weekday !== selectedWeekday), {
      weekday: selectedWeekday,
      insurance_plan_id: selectedPlanId,
    }];
    await apiCall(`/doctor-insurance-days?doctor_id=${selectedDoctorId}`, {
      method: "PUT",
      body: { days: next },
    });
    await qc.invalidateQueries({ queryKey: ["doctor-insurance-days", selectedDoctorId] });
  }

  return (
    <ScreenContainer className="p-4">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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
        <Text style={{ fontSize: 20, fontWeight: "900", color: colors.text }}>Robô de atendimento</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View
          style={{
            marginTop: 14,
            backgroundColor: "white",
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontWeight: "900", color: colors.text }}>Configuração geral</Text>
          {!settings ? (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator />
            </View>
          ) : (
            <>
              {([
                { key: "enabled", label: "Ativar robô" },
                { key: "collect_insurance", label: "Perguntar convênio" },
                { key: "collect_visit_type", label: "Perguntar tipo de visita" },
                { key: "collect_date", label: "Perguntar data" },
                { key: "collect_time", label: "Perguntar horário" },
                { key: "fallback_to_human", label: "Encaminhar para humano" },
              ] as const).map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => toggleSetting(item.key)}
                  style={{
                    marginTop: 10,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.10)",
                    backgroundColor: "rgba(0,0,0,0.02)",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Text style={{ fontWeight: "800", color: colors.text }}>{item.label}</Text>
                  <View
                    style={{
                      width: 46,
                      height: 26,
                      borderRadius: 999,
                      backgroundColor: settings[item.key] ? "rgba(16,185,129,0.35)" : "rgba(0,0,0,0.08)",
                      alignItems: settings[item.key] ? "flex-end" : "flex-start",
                      padding: 3,
                    }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 999, backgroundColor: "white" }} />
                  </View>
                </Pressable>
              ))}

              <Pressable
                onPress={saveSettings}
                style={{
                  marginTop: 12,
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: "center",
                  backgroundColor: "rgba(37,99,235,0.12)",
                  borderWidth: 1,
                  borderColor: "rgba(37,99,235,0.45)",
                }}
              >
                <Text style={{ fontWeight: "900", color: "#1E3A8A" }}>Salvar configurações</Text>
              </Pressable>
            </>
          )}
        </View>

        <View
          style={{
            marginTop: 14,
            backgroundColor: "white",
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontWeight: "900", color: colors.text }}>Serviços</Text>
            <Pressable
              onPress={() => setServiceOpen(true)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "rgba(37,99,235,0.45)",
                backgroundColor: "rgba(37,99,235,0.12)",
              }}
            >
              <Text style={{ fontWeight: "900", color: "#1E3A8A" }}>Adicionar</Text>
            </Pressable>
          </View>

          {servicesQ.isLoading ? (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator />
            </View>
          ) : (
            <View style={{ marginTop: 10, gap: 8 }}>
              {(servicesQ.data ?? []).map((s) => (
                <View
                  key={s.id}
                  style={{
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.10)",
                    backgroundColor: "rgba(0,0,0,0.02)",
                  }}
                >
                  <Text style={{ fontWeight: "900", color: colors.text }}>{s.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    Código: {s.code} {s.duration_min ? `• ${s.duration_min} min` : ""}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View
          style={{
            marginTop: 14,
            backgroundColor: "white",
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontWeight: "900", color: colors.text }}>Mensagens do robô</Text>
          <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>
            Personalize o texto enviado ao paciente. Use variáveis como {{specialty}}, {{datetime}}, {{options}}.
          </Text>

          <View style={{ marginTop: 10, gap: 10 }}>
            {messageDefaults.map((m) => (
              <View key={m.key}>
                <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text }}>{m.label}</Text>
                <TextInput
                  multiline
                  value={messagesDraft[m.key] ?? mergedMessages.get(m.key) ?? ""}
                  onChangeText={(v) => setMessagesDraft((prev) => ({ ...prev, [m.key]: v }))}
                  style={{
                    marginTop: 6,
                    minHeight: 70,
                    borderWidth: 1,
                    borderColor: "rgba(0,0,0,0.10)",
                    borderRadius: 12,
                    padding: 10,
                    color: colors.text,
                    backgroundColor: "rgba(0,0,0,0.02)",
                  }}
                />
              </View>
            ))}
          </View>

          <Pressable
            onPress={saveMessages}
            style={{
              marginTop: 12,
              paddingVertical: 12,
              borderRadius: 12,
              alignItems: "center",
              backgroundColor: "rgba(37,99,235,0.12)",
              borderWidth: 1,
              borderColor: "rgba(37,99,235,0.45)",
            }}
          >
            <Text style={{ fontWeight: "900", color: "#1E3A8A" }}>Salvar mensagens</Text>
          </Pressable>
        </View>

        <View
          style={{
            marginTop: 14,
            backgroundColor: "white",
            borderRadius: 16,
            padding: 14,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontWeight: "900", color: colors.text }}>Convênio por dia</Text>
          <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>
            Define dias reservados para convênios (usado pelo robô).
          </Text>

          <View style={{ marginTop: 10, gap: 8 }}>
            {(doctors ?? []).length === 0 ? (
              <Text style={{ color: colors.muted }}>Nenhum profissional encontrado.</Text>
            ) : (
              <>
                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                  {doctors.map((d) => (
                    <Pressable
                      key={d.doctor_id}
                      onPress={() => setSelectedDoctorId(String(d.doctor_id))}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor:
                          String(d.doctor_id) === String(selectedDoctorId)
                            ? "rgba(16,185,129,0.45)"
                            : "rgba(0,0,0,0.10)",
                        backgroundColor:
                          String(d.doctor_id) === String(selectedDoctorId)
                            ? "rgba(16,185,129,0.12)"
                            : "rgba(0,0,0,0.02)",
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "900", color: colors.text }}>{d.name}</Text>
                    </Pressable>
                  ))}
                </View>

                {selectedDoctorId ? (
                  <>
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      {weekdays.map((w) => (
                        <Pressable
                          key={w.value}
                          onPress={() => setSelectedWeekday(w.value)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor:
                              w.value === selectedWeekday ? "rgba(59,130,246,0.45)" : "rgba(0,0,0,0.10)",
                            backgroundColor:
                              w.value === selectedWeekday ? "rgba(59,130,246,0.12)" : "rgba(0,0,0,0.02)",
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "900", color: colors.text }}>{w.label}</Text>
                        </Pressable>
                      ))}
                    </View>

                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      {(plansQ.data ?? []).map((p) => (
                        <Pressable
                          key={p.id}
                          onPress={() => setSelectedPlanId(p.id)}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor:
                              p.id === selectedPlanId ? "rgba(245,158,11,0.50)" : "rgba(0,0,0,0.10)",
                            backgroundColor:
                              p.id === selectedPlanId ? "rgba(245,158,11,0.14)" : "rgba(0,0,0,0.02)",
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "900", color: colors.text }}>{p.name}</Text>
                        </Pressable>
                      ))}
                    </View>

                    <Pressable
                      onPress={addInsuranceDay}
                      style={{
                        marginTop: 10,
                        paddingVertical: 12,
                        borderRadius: 12,
                        alignItems: "center",
                        backgroundColor: "rgba(16,185,129,0.12)",
                        borderWidth: 1,
                        borderColor: "rgba(16,185,129,0.45)",
                      }}
                    >
                      <Text style={{ fontWeight: "900", color: "#065F46" }}>Salvar regra</Text>
                    </Pressable>

                    <View style={{ marginTop: 10, gap: 6 }}>
                      {(daysQ.data ?? []).map((d) => (
                        <View
                          key={`${d.weekday}-${d.insurance_plan_id}`}
                          style={{
                            padding: 10,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: "rgba(0,0,0,0.10)",
                            backgroundColor: "rgba(0,0,0,0.02)",
                          }}
                        >
                          <Text style={{ fontWeight: "800", color: colors.text }}>
                            {weekdays.find((w) => w.value === d.weekday)?.label || `Dia ${d.weekday}`} •{" "}
                            {d.insurance_name || "Convênio"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </>
                ) : (
                  <Text style={{ color: colors.muted, marginTop: 8 }}>Selecione um profissional.</Text>
                )}
              </>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal visible={serviceOpen} animationType="slide" transparent onRequestClose={() => setServiceOpen(false)}>
        <Pressable
          onPress={() => setServiceOpen(false)}
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
            <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Novo serviço</Text>

            <TextInput
              value={serviceName}
              onChangeText={setServiceName}
              placeholder="Nome do serviço"
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
              value={serviceCode}
              onChangeText={setServiceCode}
              placeholder="Código (ex: FISIO)"
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
            <TextInput
              value={serviceDuration}
              onChangeText={setServiceDuration}
              placeholder="Duração (min)"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
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

            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              <Pressable
                onPress={() => setServiceOpen(false)}
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
                onPress={addService}
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
