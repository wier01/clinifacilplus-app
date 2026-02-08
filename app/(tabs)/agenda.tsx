// clinica-crm-mobile/app/(tabs)/agenda.tsx
import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { apiCall } from "@/lib/_core/api";
import { ModernButton } from "@/components/modern-button";
import { useAuth } from "@/hooks/use-auth";
import { useFeatures } from "@/hooks/use-features";
import { PlanLockedCard } from "@/components/plan-locked-card";
import { useRouter } from "expo-router";

type Doctor = { id: string; name?: string | null; email?: string | null; specialty?: string | null };

type Appointment = {
  id: string;
  patient_id?: string | null;
  patient_name?: string | null;
  insurance_plan_id?: string | null;
  insurance_plan_name?: string | null;
  doctor_id?: string | null;
  scheduled_at?: string | null;
  duration_minutes?: number | null;
  status?: string | null;
};

type ScheduleBlock = {
  id: string;
  doctor_id: string;
  start_at: string;
  end_at: string;
  reason?: string | null;
};

type DoctorSettings = {
  appointment_duration_minutes?: number | null;
  work_start_time?: string | null;
  work_end_time?: string | null;
  lunch_start_time?: string | null;
  lunch_end_time?: string | null;
};

type InsurancePlan = { id: string; name: string; active?: number };

type SlotItem = {
  id: string;
  timeLabel: string;
  duration: number;
  status: "AVAILABLE" | "APPOINTMENT" | "BLOCKED";
  appointment?: Appointment | null;
  block?: ScheduleBlock | null;
};

type SlotRow =
  | { kind: "HEADER"; id: string; title: string }
  | ({ kind: "ITEM" } & SlotItem);

const WEEKDAYS = [
  { idx: 0, label: "Domingo" },
  { idx: 1, label: "Segunda" },
  { idx: 2, label: "Terça" },
  { idx: 3, label: "Quarta" },
  { idx: 4, label: "Quinta" },
  { idx: 5, label: "Sexta" },
  { idx: 6, label: "Sábado" },
];

function toDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateTime(dateKey: string, time: string) {
  return `${dateKey} ${time}`;
}

function addMinutes(d: Date, minutes: number) {
  return new Date(d.getTime() + minutes * 60_000);
}

function parseMySQLDateTime(s?: string | null) {
  if (!s) return null;
  return new Date(String(s).replace(" ", "T"));
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

function formatHumanDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "long" });
}

function statusLabel(status?: string | null) {
  const s = String(status || "").toUpperCase();
  if (s === "CONFIRMADA" || s === "CONFIRMED") return "Confirmada";
  if (s === "AGENDADA" || s === "SCHEDULED") return "Agendada";
  if (s === "CANCELADA" || s === "CANCELLED") return "Cancelada";
  if (s === "REAGENDADA") return "Reagendada";
  if (s === "REALIZADA" || s === "DONE") return "Realizada";
  return s ? s : "Agendada";
}

function statusTone(status?: string | null) {
  const s = String(status || "").toUpperCase();
  if (s === "CONFIRMADA" || s === "CONFIRMED") return { bg: "rgba(16,185,129,0.12)", fg: "#065F46" };
  if (s === "AGENDADA" || s === "SCHEDULED") return { bg: "rgba(59,130,246,0.12)", fg: "#1E3A8A" };
  if (s === "CANCELADA" || s === "CANCELLED") return { bg: "rgba(239,68,68,0.12)", fg: "#991B1B" };
  return { bg: "rgba(15,23,42,0.06)", fg: "#111827" };
}

function periodLabelFromTimeLabel(timeLabel: string) {
  const hour = Number(timeLabel.split(":")[0] || "0");
  if (hour >= 6 && hour < 12) return "Manhã";
  if (hour >= 12 && hour < 18) return "Tarde";
  if (hour >= 18 && hour < 24) return "Noite";
  return "Madrugada";
}

export default function AgendaScreen() {
  const colors = useColors();
  const auth = useAuth();
  const qc = useQueryClient();
  const router = useRouter();
  const features = useFeatures();
  const hasAgenda = features.has("AGENDA");
  const [date, setDate] = useState(() => new Date());

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<{ id: string; name: string } | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const [duration, setDuration] = useState(30);
  const [workStart, setWorkStart] = useState("08:00:00");
  const [workEnd, setWorkEnd] = useState("18:00:00");
  const [lunchStart, setLunchStart] = useState("12:00:00");
  const [lunchEnd, setLunchEnd] = useState("13:00:00");

  const [blockStart, setBlockStart] = useState("12:00");
  const [blockEnd, setBlockEnd] = useState("13:00");
  const [blockReason, setBlockReason] = useState("Almoço");

  const [insuranceDays, setInsuranceDays] = useState<Record<number, string | null>>({});

  const doctorsQ = useQuery({
    queryKey: ["doctors"],
    enabled: hasAgenda,
    queryFn: async () => {
      const data = await apiCall<any>("/doctors");
      const list: Doctor[] = Array.isArray(data) ? data : (data?.data ?? []);
      return (list || []).map((d: any) => ({
        id: String(d.id),
        name: d.name ?? null,
        email: d.email ?? null,
        specialty: d.specialty ?? null,
      }));
    },
  });

  const doctors = useMemo(() => doctorsQ.data ?? [], [doctorsQ.data]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const doctorId = selectedDoctorId || doctors[0]?.id || "";

  const dateKey = toDateKey(date);
  const dayStart = toDateTime(dateKey, "00:00:00");
  const dayEnd = toDateTime(dateKey, "23:59:59");

  const settingsQ = useQuery({
    queryKey: ["doctor-settings", doctorId],
    enabled: hasAgenda && !!doctorId,
    queryFn: async () => {
      try {
        const data = await apiCall<any>(`/doctor-settings?doctor_id=${doctorId}`);
        return data as DoctorSettings;
      } catch {
        return {
          appointment_duration_minutes: 30,
          work_start_time: "08:00:00",
          work_end_time: "18:00:00",
          lunch_start_time: "12:00:00",
          lunch_end_time: "13:00:00",
        } as DoctorSettings;
      }
    },
    onSuccess: (data) => {
      setDuration(Number(data?.appointment_duration_minutes || 30));
      setWorkStart(String(data?.work_start_time || "08:00:00"));
      setWorkEnd(String(data?.work_end_time || "18:00:00"));
      setLunchStart(String(data?.lunch_start_time || "12:00:00"));
      setLunchEnd(String(data?.lunch_end_time || "13:00:00"));
    },
  });

  const appointmentsQ = useQuery({
    queryKey: ["appointments", doctorId, dateKey],
    enabled: hasAgenda && !!doctorId,
    queryFn: async () => {
      const data = await apiCall<any>(
        `/appointments?doctor_id=${doctorId}&from=${encodeURIComponent(dayStart)}&to=${encodeURIComponent(dayEnd)}`
      );
      return (Array.isArray(data) ? data : data?.data ?? []) as Appointment[];
    },
  });

  const blocksQ = useQuery({
    queryKey: ["schedule-blocks", doctorId, dateKey],
    enabled: hasAgenda && !!doctorId,
    queryFn: async () => {
      const data = await apiCall<any>(
        `/schedule-blocks?doctor_id=${doctorId}&from=${encodeURIComponent(dayStart)}&to=${encodeURIComponent(dayEnd)}`
      );
      return (Array.isArray(data) ? data : data?.data ?? []) as ScheduleBlock[];
    },
  });

  const plansQ = useQuery({
    queryKey: ["insurance-plans"],
    enabled: hasAgenda && !!doctorId,
    queryFn: async () => {
      const data = await apiCall<any>("/insurance-plans");
      return (data?.plans ?? []) as InsurancePlan[];
    },
  });

  const patientsQ = useQuery({
    queryKey: ["patients", patientSearch],
    enabled: hasAgenda && scheduleOpen,
    queryFn: async () => {
      const q = patientSearch.trim();
      const data = await apiCall<any>(`/patients?search=${encodeURIComponent(q)}`);
      return (Array.isArray(data) ? data : data?.data ?? data?.patients ?? []) as Array<{ id: string; name: string }>;
    },
  });

  const insuranceDaysQ = useQuery({
    queryKey: ["doctor-insurance-days", doctorId],
    enabled: hasAgenda && !!doctorId,
    queryFn: async () => {
      const data = await apiCall<any>(`/doctor-insurance-days?doctor_id=${doctorId}`);
      return (data?.days ?? []) as Array<{ weekday: number; insurance_plan_id: string | null; insurance_name?: string }>;
    },
    onSuccess: (rows) => {
      const map: Record<number, string | null> = {};
      for (const r of rows || []) {
        map[Number(r.weekday)] = r.insurance_plan_id || null;
      }
      setInsuranceDays(map);
    },
  });

  const slots = useMemo(() => {
    const durationMin = Number(settingsQ.data?.appointment_duration_minutes || duration || 30);
    const workStartTime = String(settingsQ.data?.work_start_time || workStart || "08:00:00");
    const workEndTime = String(settingsQ.data?.work_end_time || workEnd || "18:00:00");

    const startDt = parseMySQLDateTime(toDateTime(dateKey, workStartTime));
    const endDt = parseMySQLDateTime(toDateTime(dateKey, workEndTime));
    if (!startDt || !endDt) return [];

    const appts = appointmentsQ.data || [];
    const blocks = [...(blocksQ.data || [])];

    const lunchStartTime = String(settingsQ.data?.lunch_start_time || lunchStart || "");
    const lunchEndTime = String(settingsQ.data?.lunch_end_time || lunchEnd || "");
    if (lunchStartTime && lunchEndTime) {
      blocks.push({
        id: `lunch-${dateKey}`,
        doctor_id: doctorId,
        start_at: toDateTime(dateKey, lunchStartTime),
        end_at: toDateTime(dateKey, lunchEndTime),
        reason: "Almoço",
      });
    }

    const items: SlotItem[] = [];
    let cursor = new Date(startDt);

    while (cursor < endDt) {
      const slotEnd = addMinutes(cursor, durationMin);
      if (slotEnd > endDt) break;

      const appt = appts.find((a) => {
        const st = parseMySQLDateTime(a.scheduled_at);
        if (!st) return false;
        const en = addMinutes(st, Number(a.duration_minutes || durationMin));
        return overlaps(cursor, slotEnd, st, en);
      });

      const block = blocks.find((b) => {
        const st = parseMySQLDateTime(b.start_at);
        const en = parseMySQLDateTime(b.end_at);
        if (!st || !en) return false;
        return overlaps(cursor, slotEnd, st, en);
      });

      const label = cursor.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      if (appt) {
        items.push({
          id: `appt-${appt.id}`,
          timeLabel: label,
          duration: durationMin,
          status: "APPOINTMENT",
          appointment: appt,
        });
      } else if (block) {
        items.push({
          id: `block-${block.id}-${label}`,
          timeLabel: label,
          duration: durationMin,
          status: "BLOCKED",
          block,
        });
      } else {
        items.push({
          id: `slot-${label}`,
          timeLabel: label,
          duration: durationMin,
          status: "AVAILABLE",
        });
      }

      cursor = addMinutes(cursor, durationMin);
    }

    return items;
  }, [appointmentsQ.data, blocksQ.data, dateKey, doctorId, duration, lunchEnd, lunchStart, settingsQ.data, workEnd, workStart]);

  const rows: SlotRow[] = useMemo(() => {
    const out: SlotRow[] = [];
    let lastPeriod: string | null = null;
    for (const slot of slots) {
      const period = periodLabelFromTimeLabel(slot.timeLabel);
      if (period !== lastPeriod) {
        out.push({ kind: "HEADER", id: `header-${period}`, title: period });
        lastPeriod = period;
      }
      out.push({ kind: "ITEM", ...slot });
    }
    return out;
  }, [slots]);

  const selectedDoctor = doctors.find((d) => d.id === doctorId);
  const weekday = date.getDay();
  const planId = insuranceDays[weekday] || null;
  const planName = plansQ.data?.find((p) => p.id === planId)?.name || null;

  function openSchedule(slotTime?: string) {
    if (!hasAgenda) return router.push("/upgrade");
    setScheduleError(null);
    setSelectedPatient(null);
    setPatientSearch("");
    setScheduleTime(slotTime || "09:00");
    setSelectedPlanId(planId || null);
    setScheduleOpen(true);
  }

  async function saveSettings() {
    if (!hasAgenda) return router.push("/upgrade");
    if (!doctorId) return;
    await apiCall(`/doctor-settings?doctor_id=${doctorId}`, {
      method: "PUT",
      body: {
        appointment_duration_minutes: duration,
        work_start_time: workStart,
        work_end_time: workEnd,
        lunch_start_time: lunchStart,
        lunch_end_time: lunchEnd,
      },
    });
    await qc.invalidateQueries({ queryKey: ["doctor-settings", doctorId] });
  }

  async function addBlock() {
    if (!hasAgenda) return router.push("/upgrade");
    if (!doctorId) return;
    const start_at = toDateTime(dateKey, `${blockStart}:00`);
    const end_at = toDateTime(dateKey, `${blockEnd}:00`);
    await apiCall(`/schedule-blocks`, {
      method: "POST",
      body: { doctor_id: doctorId, start_at, end_at, reason: blockReason || "Bloqueio" },
    });
    setBlockOpen(false);
    await qc.invalidateQueries({ queryKey: ["schedule-blocks", doctorId, dateKey] });
  }

  async function addPlan() {
    if (!hasAgenda) return router.push("/upgrade");
    if (!newPlanName.trim()) return;
    await apiCall("/insurance-plans", { method: "POST", body: { name: newPlanName.trim() } });
    setNewPlanName("");
    await qc.invalidateQueries({ queryKey: ["insurance-plans"] });
  }

  function cyclePlan(dayIdx: number) {
    const plans = plansQ.data || [];
    const ids = [null, ...plans.map((p) => p.id)];
    const current = insuranceDays[dayIdx] ?? null;
    const next = ids[(ids.indexOf(current) + 1) % ids.length];
    setInsuranceDays((prev) => ({ ...prev, [dayIdx]: next }));
  }

  async function saveInsuranceDays() {
    if (!hasAgenda) return router.push("/upgrade");
    if (!doctorId) return;
    const days = WEEKDAYS.map((d) => ({
      weekday: d.idx,
      insurance_plan_id: insuranceDays[d.idx] || null,
    }));
    await apiCall(`/doctor-insurance-days?doctor_id=${doctorId}`, { method: "PUT", body: { days } });
    await qc.invalidateQueries({ queryKey: ["doctor-insurance-days", doctorId] });
  }

  async function saveAppointment() {
    if (!hasAgenda) return router.push("/upgrade");
    if (!doctorId) return;
    if (!selectedPatient?.id) {
      setScheduleError("Selecione um paciente.");
      return;
    }
    const time = scheduleTime.trim();
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setScheduleError("Informe o horário no formato HH:MM.");
      return;
    }

    if (planId && selectedPlanId !== planId) {
      setScheduleError(`Este dia é exclusivo para o convênio ${planName}.`);
      return;
    }

    const scheduled_at = toDateTime(dateKey, `${time}:00`);
    await apiCall("/appointments", {
      method: "POST",
      body: {
        patient_id: selectedPatient.id,
        doctor_id: doctorId,
        scheduled_at,
        duration_minutes: Number(settingsQ.data?.appointment_duration_minutes || duration || 30),
        status: "AGENDADA",
        insurance_plan_id: selectedPlanId || null,
      },
    });
    setScheduleOpen(false);
    await qc.invalidateQueries({ queryKey: ["appointments", doctorId, dateKey] });
  }

  const isLoading =
    doctorsQ.isLoading || settingsQ.isLoading || appointmentsQ.isLoading || blocksQ.isLoading;

  return (
    <ScreenContainer>
      <View className="px-6 pt-6">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-[20px] font-black text-[#0f172a]">Clínica CRM</Text>
          <Pressable accessibilityLabel="Menu">
            <Text className="text-[18px] font-bold text-[#0f172a]">≡</Text>
          </Pressable>
        </View>

        <View className="rounded-[24px] border border-black/5 bg-white/90 p-5 shadow-sm">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-[22px] font-black text-[#0f172a]">Agenda médica</Text>
              <Text className="text-[13px] text-[#64748b] mt-1">Pacientes do dia</Text>
            </View>
            {String(auth.user?.role || "").toUpperCase() === "ADMIN" && (
              <Pressable onPress={() => setSettingsOpen(true)}>
                <IconSymbol name="gearshape.fill" size={20} color={colors.foreground} />
              </Pressable>
            )}
          </View>

          {doctors.length > 0 && (
            <View className="flex-row gap-2 mt-4">
              {doctors.map((doctor) => {
                const active = doctor.id === doctorId;
                return (
                  <Pressable
                    key={doctor.id}
                    className="flex-1 px-4 py-3 rounded-2xl"
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: active ? "rgba(37,99,235,0.14)" : "rgba(0,0,0,0.02)",
                    }}
                    onPress={() => setSelectedDoctorId(doctor.id)}
                  >
                    <Text className="text-center font-semibold" style={{ color: active ? "#1E3A8A" : colors.text }}>
                      {doctor.name || doctor.email || "Profissional"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          <View className="flex-row items-center justify-between mt-5">
            <Pressable onPress={() => setDate(addMinutes(date, -24 * 60))} style={{ opacity: 1 }}>
              <IconSymbol name="arrow.left" size={24} color={colors.foreground} />
            </Pressable>

            <Text className="text-[18px] font-bold text-foreground">{formatHumanDate(date)}</Text>

            <Pressable onPress={() => setDate(addMinutes(date, 24 * 60))} style={{ opacity: 1 }}>
              <IconSymbol name="chevron.right" size={24} color={colors.foreground} />
            </Pressable>
          </View>

          {selectedDoctor?.specialty ? (
            <Text className="text-[12px] text-muted mt-3">{selectedDoctor.specialty}</Text>
          ) : null}

          {!!planName && (
            <View className="mt-4 self-start rounded-full px-3 py-1.5" style={{ backgroundColor: "rgba(37,99,235,0.12)" }}>
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#1E3A8A" }}>
                Somente convênio: {planName}
              </Text>
            </View>
          )}
        </View>
      </View>

      {!hasAgenda ? (
        <PlanLockedCard featureName="Agenda" />
      ) : isLoading ? (
        <View style={{ padding: 16 }}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 140 }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center p-6">
              <IconSymbol name="calendar.fill" size={64} color={colors.muted} />
              <Text className="text-lg font-semibold text-foreground mt-4">
                Nenhum horário disponível
              </Text>
              <Text className="text-base text-muted text-center mt-2">
                Verifique configurações do profissional ou horários de trabalho.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.kind === "HEADER") {
              return (
                <View className="mt-4 mb-2">
                  <View className="flex-row items-center gap-10">
                    <Text className="text-xs font-bold text-muted uppercase tracking-wider">
                      {item.title}
                    </Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: "rgba(15,23,42,0.08)" }} />
                  </View>
                </View>
              );
            }

            const slot = item as SlotItem;
            if (slot.status === "AVAILABLE") {
              return (
                <Pressable
                  onPress={() => openSchedule(slot.timeLabel)}
                  className="rounded-2xl p-5 mb-3 border bg-white/90"
                  style={{ borderColor: "rgba(15,23,42,0.08)" }}
                >
                  <View className="flex-row items-center">
                    <View style={{ width: 78 }}>
                      <Text className="text-lg font-bold text-foreground">{slot.timeLabel}</Text>
                      <Text className="text-xs text-muted">{slot.duration} min</Text>
                    </View>

                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">Disponível</Text>
                      <Text className="text-sm text-muted">Toque para agendar</Text>
                    </View>

                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: "rgba(16,185,129,0.12)"
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "800", color: "#065F46" }}>Livre</Text>
                    </View>
                  </View>
                </Pressable>
              );
            }

            if (slot.status === "BLOCKED") {
              return (
                <View
                  className="rounded-2xl p-5 mb-3 border"
                  style={{ borderColor: "rgba(239,68,68,0.18)", backgroundColor: "rgba(239,68,68,0.06)" }}
                >
                  <View className="flex-row items-center">
                    <View style={{ width: 78 }}>
                      <Text className="text-lg font-bold text-foreground">{slot.timeLabel}</Text>
                      <Text className="text-xs text-muted">{slot.duration} min</Text>
                    </View>

                    <View className="flex-1">
                      <Text className="text-base font-semibold text-foreground">Bloqueado</Text>
                      <Text className="text-sm text-muted">{slot.block?.reason || "Indisponível"}</Text>
                    </View>

                    <View
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: "rgba(239,68,68,0.12)",
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "800", color: "#991B1B" }}>Bloqueado</Text>
                    </View>
                  </View>
                </View>
              );
            }

            const appt = slot.appointment;
            const tone = statusTone(appt?.status);

            return (
              <View
                className="rounded-2xl p-5 mb-3 border"
                style={{ borderColor: "rgba(15,23,42,0.08)", backgroundColor: tone.bg }}
              >
                <View className="flex-row items-center">
                  <View style={{ width: 78 }}>
                    <Text className="text-lg font-bold text-foreground">{slot.timeLabel}</Text>
                    <Text className="text-xs text-muted">{slot.duration} min</Text>
                  </View>

                  <View className="flex-1">
                    <Text className="text-base font-semibold text-foreground">
                      {appt?.patient_name || "Paciente"}
                    </Text>
                    <Text className="text-sm text-muted">
                      {appt?.insurance_plan_name ? `Convênio: ${appt.insurance_plan_name}` : "Particular"}
                    </Text>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ fontSize: 12, fontWeight: "800", color: tone.fg }}>
                      {statusLabel(appt?.status)}
                    </Text>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      <View className="absolute bottom-6 right-6 flex-row gap-10">
        <ModernButton title="Bloquear" variant="dark" onPress={() => setBlockOpen(true)} style={{ borderRadius: 999 }} />
        <ModernButton title="Agendar" variant="primary" onPress={() => openSchedule()} style={{ borderRadius: 999 }} />
      </View>

      <Modal visible={blockOpen} animationType="slide" transparent onRequestClose={() => setBlockOpen(false)}>
        <Pressable
          onPress={() => setBlockOpen(false)}
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
            <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Bloquear horário</Text>
            <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>
              {formatHumanDate(date)}
            </Text>

            <TextInput
              value={blockStart}
              onChangeText={setBlockStart}
              placeholder="Início (HH:MM)"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />
            <TextInput
              value={blockEnd}
              onChangeText={setBlockEnd}
              placeholder="Fim (HH:MM)"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />
            <TextInput
              value={blockReason}
              onChangeText={setBlockReason}
              placeholder="Motivo (ex: Almoço)"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />

            <View className="flex-row mt-3 gap-10">
              <View className="flex-1">
                <ModernButton title="Cancelar" variant="dark" onPress={() => setBlockOpen(false)} />
              </View>
              <View className="flex-1">
                <ModernButton title="Salvar bloqueio" variant="primary" onPress={addBlock} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={settingsOpen} animationType="slide" transparent onRequestClose={() => setSettingsOpen(false)}>
        <Pressable
          onPress={() => setSettingsOpen(false)}
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
              maxHeight: "80%",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Configurar agenda</Text>
            <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>
              Defina duração, horários de trabalho e convênios por dia.
            </Text>

            <Text className="mt-3 text-[12px] font-bold" style={{ color: colors.text }}>
              duração do atendimento (min)
            </Text>
            <View className="flex-row gap-10 mt-2">
              {[20, 30, 40, 50, 60].map((m) => {
                const active = duration === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setDuration(m)}
                    className="px-3 py-2 rounded-full"
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: active ? "rgba(37,99,235,0.12)" : "rgba(0,0,0,0.02)",
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "800", color: active ? "#1E3A8A" : colors.text }}>
                      {m}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View className="flex-row gap-10 mt-3">
              <View style={{ flex: 1 }}>
                <Text className="text-[12px] font-bold" style={{ color: colors.text }}>
                  Início
                </Text>
                <TextInput
                  value={workStart}
                  onChangeText={setWorkStart}
                  placeholder="08:00:00"
                  placeholderTextColor={colors.muted}
                  className="mt-2 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
                  style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text className="text-[12px] font-bold" style={{ color: colors.text }}>
                  Fim
                </Text>
                <TextInput
                  value={workEnd}
                  onChangeText={setWorkEnd}
                  placeholder="18:00:00"
                  placeholderTextColor={colors.muted}
                  className="mt-2 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
                  style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
                />
              </View>
            </View>

            <View className="flex-row gap-10 mt-3">
              <View style={{ flex: 1 }}>
                <Text className="text-[12px] font-bold" style={{ color: colors.text }}>
                  Almoço Início
                </Text>
                <TextInput
                  value={lunchStart}
                  onChangeText={setLunchStart}
                  placeholder="12:00:00"
                  placeholderTextColor={colors.muted}
                  className="mt-2 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
                  style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text className="text-[12px] font-bold" style={{ color: colors.text }}>
                  Almoço fim
                </Text>
                <TextInput
                  value={lunchEnd}
                  onChangeText={setLunchEnd}
                  placeholder="13:00:00"
                  placeholderTextColor={colors.muted}
                  className="mt-2 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
                  style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
                />
              </View>
            </View>

            <Text className="mt-4 text-[12px] font-bold" style={{ color: colors.text }}>
              convênios por dia
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              Toque no dia para alternar entre os convênios cadastrados.
            </Text>

            <View className="mt-2">
              {WEEKDAYS.map((d) => {
                const plan = (plansQ.data || []).find((p) => p.id === insuranceDays[d.idx]);
                return (
                  <Pressable
                    key={d.idx}
                    onPress={() => cyclePlan(d.idx)}
                    className="mt-2 rounded-xl px-3 py-3"
                    style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: "rgba(0,0,0,0.02)" }}
                  >
                    <Text style={{ fontWeight: "800", color: colors.text }}>
                      {d.label}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>
                      {plan ? `Somente ${plan.name}` : "Todos os convênios"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="mt-4 text-[12px] font-bold" style={{ color: colors.text }}>
              Cadastrar convênio
            </Text>
            <TextInput
              value={newPlanName}
              onChangeText={setNewPlanName}
              placeholder="Ex: Unimed, Amil"
              placeholderTextColor={colors.muted}
              className="mt-2 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />

            <View className="flex-row mt-3 gap-10">
              <View className="flex-1">
                <ModernButton title="Adicionar convênio" variant="outline" onPress={addPlan} />
              </View>
              <View className="flex-1">
                <ModernButton title="Salvar regras" variant="primary" onPress={saveInsuranceDays} />
              </View>
            </View>

            <View className="mt-3">
              <ModernButton
                title="Salvar horários"
                variant="primary"
                onPress={async () => {
                  await saveSettings();
                  setSettingsOpen(false);
                }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={scheduleOpen} animationType="slide" transparent onRequestClose={() => setScheduleOpen(false)}>
        <Pressable
          onPress={() => setScheduleOpen(false)}
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
              maxHeight: "85%",
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Agendar consulta</Text>
            <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>{formatHumanDate(date)}</Text>

            <Text className="mt-3 text-[12px] font-bold" style={{ color: colors.text }}>
              horário (HH:MM)
            </Text>
            <TextInput
              value={scheduleTime}
              onChangeText={setScheduleTime}
              placeholder="09:00"
              placeholderTextColor={colors.muted}
              className="mt-2 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />

            <Text className="mt-3 text-[12px] font-bold" style={{ color: colors.text }}>
              Paciente
            </Text>
            <TextInput
              value={patientSearch}
              onChangeText={setPatientSearch}
              placeholder="Buscar por nome ou sobrenome"
              placeholderTextColor={colors.muted}
              className="mt-2 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />

            <View className="mt-2" style={{ maxHeight: 160 }}>
              {patientsQ.isLoading ? (
                <ActivityIndicator />
              ) : (
                <FlatList
                  data={patientsQ.data ?? []}
                  keyExtractor={(p) => p.id}
                  ListEmptyComponent={<Text style={{ color: colors.muted, fontSize: 12 }}>Nenhum paciente.</Text>}
                  renderItem={({ item }) => {
                    const active = selectedPatient?.id === item.id;
                    return (
                      <Pressable
                        onPress={() => setSelectedPatient({ id: item.id, name: item.name })}
                        className="mt-2 rounded-xl px-3 py-2"
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: active ? "rgba(37,99,235,0.12)" : "rgba(0,0,0,0.02)",
                        }}
                      >
                        <Text style={{ fontWeight: "700", color: active ? "#1E3A8A" : colors.text }}>
                          {item.name}
                        </Text>
                      </Pressable>
                    );
                  }}
                />
              )}
            </View>

            <Text className="mt-3 text-[12px] font-bold" style={{ color: colors.text }}>
              Convênio
            </Text>
            {planId ? (
              <View className="mt-2 rounded-xl px-3 py-3" style={{ backgroundColor: "rgba(37,99,235,0.12)" }}>
                <Text style={{ fontWeight: "800", color: "#1E3A8A" }}>
                  Somente {planName}
                </Text>
              </View>
            ) : (
              <View className="flex-row flex-wrap gap-10 mt-2">
                <Pressable
                  onPress={() => setSelectedPlanId(null)}
                  className="px-3 py-2 rounded-full"
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: !selectedPlanId ? "rgba(15,23,42,0.08)" : "rgba(0,0,0,0.02)",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text }}>Particular</Text>
                </Pressable>
                {(plansQ.data || []).map((p) => {
                  const active = selectedPlanId === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setSelectedPlanId(p.id)}
                      className="px-3 py-2 rounded-full"
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: active ? "rgba(37,99,235,0.12)" : "rgba(0,0,0,0.02)",
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: "800", color: active ? "#1E3A8A" : colors.text }}>
                        {p.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {!!scheduleError && (
              <Text className="mt-3 text-[12px] font-bold" style={{ color: "#DC2626" }}>
                {scheduleError}
              </Text>
            )}

            <View className="flex-row mt-4 gap-10">
              <View className="flex-1">
                <ModernButton title="Cancelar" variant="dark" onPress={() => setScheduleOpen(false)} />
              </View>
              <View className="flex-1">
                <ModernButton title="Salvar" variant="primary" onPress={saveAppointment} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}



