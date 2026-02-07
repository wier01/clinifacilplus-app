// clinica-crm-mobile/app/lead/[itemId].tsx
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { apiCall } from "@/lib/_core/api";
import { ModernButton } from "@/components/modern-button";

type ItemDetails = {
  id: string;
  phone?: string | null;
  patient_name?: string | null;
  lead_name?: string | null;
  name?: string | null;
  patient_id?: string | null;
  stage_id?: string | null;
  stage_code?: string | null;
  stage_name?: string | null;
  pipeline_id?: string | null;
  doctor_id?: string | null;
};

type WhatsMessage = {
  id?: string;
  conversation_id?: string | null;
  sender?: string | null; // PACIENTE | CLINICA | BOT | ...
  content?: string | null;
  created_at?: string | null;
  wa_message_id?: string | null;
  _localStatus?: "SENDING" | "ERROR" | "SENT";
};

type LeadEvent = {
  id?: string;
  kind?: string;
  type?: string;
  created_at?: string | null;
  payload?: any;
  message?: string | null;
  text?: string | null;
};

type PipelineItemResponse = {
  item?: ItemDetails | null;
  stage?: any;
  messages?: WhatsMessage[];
  events?: LeadEvent[];
  pipeline?: any;
};

type StageRow = { id: string; name?: string | null; code?: string | null };
type DoctorRow = { id: string; name?: string | null; email?: string | null; specialty?: string | null };

function pickTitle(it?: ItemDetails | null) {
  if (!it) return "Lead";
  const name =
    (it.patient_name && String(it.patient_name).trim()) ||
    (it.lead_name && String(it.lead_name).trim()) ||
    (it.name && String(it.name).trim()) ||
    "";
  if (name) return name;

  const phone = it.phone ? String(it.phone).trim() : "";
  if (phone) return phone;

  return `Lead ${String(it.id).slice(0, 8)}`;
}

function pickPhone(it?: ItemDetails | null) {
  const phone = it?.phone ? String(it.phone).trim() : "";
  return phone || "";
}

function pickStage(it?: ItemDetails | null) {
  return (
    (it?.stage_name && String(it.stage_name).trim()) ||
    (it?.stage_code && String(it.stage_code).trim()) ||
    ""
  );
}

function normalizeMessages(list: WhatsMessage[] = []) {
  const items = list
    .filter((m) => !!(m?.content || m?.wa_message_id || m?.id))
    .map((m) => {
      const created = m.created_at ? new Date(m.created_at) : null;
      return {
        id: String(m.id ?? m.wa_message_id ?? `msg-${Math.random()}`),
        sender: String(m.sender || "").toUpperCase(),
        content: String(m.content ?? "").trim(),
        created_at: created && !Number.isNaN(created.getTime()) ? created.toISOString() : null,
        conversation_id: m.conversation_id ?? null,
        localStatus: m._localStatus ?? undefined,
      };
    });

  items.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });

  return items;
}


type TimelineItem = {
  id: string;
  kind: "MESSAGE" | "EVENT";
  created_at: string | null;
  sender?: string;
  content?: string;
  eventLabel?: string;
  eventKind?: string;
  localStatus?: "SENDING" | "ERROR" | "SENT";
};

type TimelineBlock =
  | { type: "date"; id: string; label: string }
  | { type: "item"; id: string; item: TimelineItem };

function normalizeEvents(list: LeadEvent[] = []) {
  return list
    .map((e) => {
      const created = e.created_at ? new Date(e.created_at) : null;
      const when = created && !Number.isNaN(created.getTime()) ? created.toISOString() : null;
      const kind = String(e.kind ?? e.type ?? "EVENT").toUpperCase();
      const payloadText =
        (e.payload && typeof e.payload === "object" ? (e.payload.text ?? e.payload.message) : null) ??
        e.text ??
        e.message ??
        "";

      let label = "Evento";
      if (kind === "NOTE") label = "Nota interna";
      if (kind === "STAGE_CHANGED") label = "Mudou etapa";
      if (kind === "SYSTEM") label = "Sistema";

      const extra = String(payloadText || "").trim();
      return {
        id: String(e.id ?? `event-${Math.random()}`),
        kind: "EVENT" as const,
        created_at: when,
        eventLabel: extra ? `${label}: ${extra}` : label,
        eventKind: kind,
      };
    })
    .filter((e) => !!e.id);
}

function buildTimeline(messages: WhatsMessage[] = [], events: LeadEvent[] = []) {
  const msgItems: TimelineItem[] = normalizeMessages(messages).map((m) => ({
    id: m.id,
    kind: "MESSAGE",
    created_at: m.created_at,
    sender: m.sender,
    content: m.content,
    localStatus: m.localStatus,
  }));

  const evItems: TimelineItem[] = normalizeEvents(events);

  const all = [...msgItems, ...evItems];
  all.sort((a, b) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });
  return all;
}

function formatTime(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

function initialsFrom(title: string) {
  const parts = title.split(" ").filter(Boolean);
  if (!parts.length) return "L";
  const a = parts[0]?.[0] ?? "";
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return `${a}${b}`.toUpperCase();
}

function parseEventBody(label?: string) {
  const raw = String(label || "").trim();
  const notePrefix = "Nota interna:";
  if (raw.startsWith(notePrefix)) {
    return { title: "Nota interna", body: raw.replace(notePrefix, "").trim() };
  }
  return { title: "Evento", body: raw };
}

export default function LeadChatScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const optimisticIdRef = useRef<string | null>(null);

  const params = useLocalSearchParams<{ itemId?: string }>();
  const itemId = String(params.itemId || "");

  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);

  const itemQ = useQuery({
    queryKey: ["pipeline-item", itemId],
    enabled: !!itemId,
    queryFn: async () => {
      const data = await apiCall<PipelineItemResponse>(`/pipelines/items/${itemId}`);
      const it = (data?.item ?? null) as ItemDetails | null;
      return {
        item: it ? { ...it, id: String(it.id ?? itemId) } : null,
        stage: data?.stage ?? null,
        messages: Array.isArray(data?.messages) ? data.messages : [],
        events: Array.isArray((data as any)?.events) ? (data as any).events : [],
        pipeline: (data as any)?.pipeline ?? null,
      } as PipelineItemResponse;
    },
  });

  const pipelineId = itemQ.data?.item?.pipeline_id ?? itemQ.data?.pipeline?.id ?? null;

  const stagesQ = useQuery({
    queryKey: ["pipeline-stages", pipelineId],
    enabled: !!pipelineId,
    queryFn: async () => {
      const data = await apiCall<any>(`/pipelines/${pipelineId}/stages`);
      const list: StageRow[] = Array.isArray(data) ? data : (data?.stages ?? data?.data ?? []);
      return (list || []).filter(Boolean).map((s: any) => ({ id: String(s.id), name: s.name ?? null, code: s.code ?? null }));
    },
  });

  const doctorsQ = useQuery({
    queryKey: ["doctors"],
    queryFn: async () => {
      const data = await apiCall<any>("/doctors");
      const list: DoctorRow[] = Array.isArray(data) ? data : (data?.data ?? []);
      return (list || []).filter(Boolean).map((d: any) => ({ id: String(d.id), name: d.name ?? null, email: d.email ?? null, specialty: d.specialty ?? null }));
    },
  });

  const assignedDoctor = useMemo(() => {
    const id = itemQ.data?.item?.doctor_id;
    if (!id) return null;
    return (doctorsQ.data ?? []).find((d) => String(d.id) === String(id)) ?? null;
  }, [doctorsQ.data, itemQ.data?.item?.doctor_id]);

  const timeline = useMemo(
    () => buildTimeline(itemQ.data?.messages ?? [], itemQ.data?.events ?? []),
    [itemQ.data?.messages, itemQ.data?.events]
  );
  const item = itemQ.data?.item ?? null;
  const title = useMemo(() => pickTitle(item), [item]);
  const phone = useMemo(() => pickPhone(item), [item]);
  const stage = useMemo(() => pickStage(item), [item]);

  const lastConversationId = useMemo(() => {
    const lastMsg = [...(itemQ.data?.messages ?? [])].pop();
    if (!lastMsg) return null;
    return lastMsg.conversation_id ?? null;
  }, [itemQ.data?.messages]);

  const bubbleInitial = useMemo(() => initialsFrom(title), [title]);
  const clinicInitial = "C";

  const scrollToEnd = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  const onContentSizeChange = () => {
    scrollToEnd();
  };

  const onLayout = () => {
    scrollToEnd();
  };

  const lastTimelineIdRef = useRef<string | null>(null);
  useEffect(() => {
    const last = timeline[timeline.length - 1];
    if (!last) return;
    if (last.id === lastTimelineIdRef.current) return;
    lastTimelineIdRef.current = last.id;
    scrollToEnd();
  }, [timeline.length]);

  const timelineBlocks = useMemo(() => {
    const blocks: TimelineBlock[] = [];
    let lastDateKey = "";

    for (const t of timeline) {
      const label = formatDateLabel(t.created_at);
      const dateKey = label || "Sem data";
      if (dateKey !== lastDateKey) {
        blocks.push({ type: "date", id: `date-${dateKey}`, label: dateKey });
        lastDateKey = dateKey;
      }
      blocks.push({ type: "item", id: t.id, item: t });
    }

    return blocks;
  }, [timeline]);

  const moveStageM = useMutation({
    mutationFn: async (stageId: string) => {
      await apiCall(`/pipelines/items/${itemId}/move`, {
        method: "POST",
        body: { stage_id: stageId },
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["pipeline-item", itemId] });
      setMoveOpen(false);
    },
  });

  const assignDoctorM = useMutation({
    mutationFn: async (doctorId: string | null) => {
      await apiCall(`/pipelines/items/${itemId}/assign`, {
        method: "POST",
        body: { doctor_id: doctorId },
      });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["pipeline-item", itemId] });
      setAssignOpen(false);
    },
  });

  const sendM = useMutation({
    mutationFn: async (text: string) => {
      const cleanText = String(text || "").trim();
      if (!cleanText) throw new Error("Digite uma mensagem.");
      if (!phone) throw new Error("Telefone do lead ausente.");

      console.log("[send] /whatsapp/send", { to: phone, text: cleanText });
      await apiCall("/whatsapp/send", {
        method: "POST",
        body: {
          to: phone,
          text: cleanText,
          ...(lastConversationId ? { conversation_id: lastConversationId } : {}),
        },
      });

      return { text: cleanText };
    },
    onMutate: async (text: string) => {
      const cleanText = String(text || "").trim();
      if (!cleanText) return;

      setSendError(null);
      setDraft("");

      await qc.cancelQueries({ queryKey: ["pipeline-item", itemId] });
      const prev = qc.getQueryData<PipelineItemResponse>(["pipeline-item", itemId]);

      const optimisticId = `optimistic-${Date.now()}`;
      optimisticIdRef.current = optimisticId;

      const optimistic: WhatsMessage = {
        id: optimisticId,
        sender: "CLINICA",
        content: cleanText,
        created_at: new Date().toISOString(),
        conversation_id: lastConversationId,
        _localStatus: "SENDING",
      };

      qc.setQueryData<PipelineItemResponse>(["pipeline-item", itemId], (old) => {
        const base = old ?? { item: prev?.item ?? null, stage: prev?.stage ?? null, messages: [] };
        const nextMessages = [...(base.messages ?? []), optimistic];
        return { ...base, messages: nextMessages };
      });

      return { prev } as { prev?: PipelineItemResponse };
    },
    onError: (_err, _vars, ctx) => {
      const msg = String((_err as any)?.message ?? _err ?? "Erro ao enviar");
      setSendError(msg);

      const optimisticId = optimisticIdRef.current;
      if (optimisticId) {
        qc.setQueryData<PipelineItemResponse>(["pipeline-item", itemId], (old) => {
          if (!old) return old;
          const next = (old.messages ?? []).map((m) =>
            String(m.id) === String(optimisticId) ? { ...m, _localStatus: "ERROR" } : m
          );
          return { ...old, messages: next };
        });
      }

      if (ctx?.prev) qc.setQueryData(["pipeline-item", itemId], ctx.prev);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["pipeline-item", itemId] });
      scrollToEnd();
    },
  });

  const noteM = useMutation({
    mutationFn: async (text: string) => {
      const cleanText = String(text || "").trim();
      if (!cleanText) throw new Error("Digite uma nota.");
      await apiCall(`/pipelines/items/${itemId}/note`, {
        method: "POST",
        body: { text: cleanText },
      });
      return { text: cleanText };
    },
    onMutate: async () => {
      setNoteError(null);
    },
    onError: (_err) => {
      const msg = String((_err as any)?.message ?? _err ?? "Erro ao salvar nota");
      setNoteError(msg);
    },
    onSuccess: async () => {
      setNoteDraft("");
      await qc.invalidateQueries({ queryKey: ["pipeline-item", itemId] });
    },
  });

  const handleCall = async () => {
    if (!phone) return;
    try {
      await Linking.openURL(`tel:${phone}`);
    } catch {
      setSendError("Não foi possível abrir a chamada.");
    }
  };

  const handleCopy = async () => {
    if (!phone) return;
    try {
      if (Platform.OS === "web" && (navigator as any)?.clipboard?.writeText) {
        await (navigator as any).clipboard.writeText(phone);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } else {
        setSendError("Copiar telefone só funciona no web.");
      }
    } catch {
      setSendError("Não foi possível copiar.");
    }
  };

  const typingHint = draft.trim().length > 0 && !sendM.isPending;

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View
          style={{
            padding: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Pressable
              onPress={() => router.back()}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: "rgba(0,0,0,0.03)",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar</Text>
            </Pressable>

            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(37,99,235,0.15)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontWeight: "800", color: "#2563eb" }}>{bubbleInitial}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }} numberOfLines={1}>
                {title}
              </Text>
              <Text style={{ color: colors.muted }} numberOfLines={1}>
                {phone ? phone : "Sem telefone"}
                {stage ? `  -  ${stage}` : ""}
              </Text>
              {assignedDoctor ? (
                <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
                  Responsavel: {assignedDoctor.name || assignedDoctor.email || assignedDoctor.id}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {item?.patient_id ? (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: "/patients/[id]",
                    params: { id: String(item.patient_id) },
                  } as any)
                }
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: "rgba(0,0,0,0.03)",
                }}
              >
                <Text style={{ fontWeight: "800", color: colors.text }}>Prontuario</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={handleCall}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: "rgba(0,0,0,0.03)",
              }}
            >
              <Text style={{ fontWeight: "800", color: colors.text }}>Ligar</Text>
            </Pressable>

            <Pressable
              onPress={handleCopy}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: "rgba(0,0,0,0.03)",
              }}
            >
              <Text style={{ fontWeight: "800", color: colors.text }}>{copied ? "Copiado" : "Copiar"}</Text>
            </Pressable>

            <Pressable
              onPress={() => setMoveOpen(true)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: "rgba(0,0,0,0.03)",
              }}
            >
              <Text style={{ fontWeight: "800", color: colors.text }}>Mover etapa</Text>
            </Pressable>

            <Pressable
              onPress={() => setAssignOpen(true)}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: "rgba(0,0,0,0.03)",
              }}
            >
              <Text style={{ fontWeight: "800", color: colors.text }}>Atribuir</Text>
            </Pressable>
          </View>
        </View>

        {itemQ.isLoading ? (
          <View style={{ padding: 16 }}>
            <ActivityIndicator />
          </View>
        ) : itemQ.isError ? (
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
            <Text style={{ color: "#991B1B", fontWeight: "800" }}>Erro ao carregar conversa.</Text>
            <Text style={{ color: "#7F1D1D", marginTop: 6, lineHeight: 18 }}>
              {String((itemQ.error as any)?.message ?? "Erro desconhecido")}
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1, paddingHorizontal: 12, paddingVertical: 8 }}>
            <View
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                padding: 12,
                backgroundColor: "rgba(0,0,0,0.02)",
                marginBottom: 10,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "800", color: colors.text }}>Adicionar nota interna</Text>
              <TextInput
                value={noteDraft}
                onChangeText={setNoteDraft}
                placeholder="Ex: Paciente pediu retorno na próxima semana…"
                placeholderTextColor={colors.muted}
                multiline
                style={{
                  minHeight: 56,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  marginTop: 8,
                  color: colors.text,
                  backgroundColor: "rgba(0,0,0,0.02)",
                }}
              />
              {noteError ? (
                <Text style={{ color: "#b91c1c", marginTop: 6, fontSize: 12 }}>{noteError}</Text>
              ) : null}
              <View style={{ marginTop: 8, alignItems: "flex-end" }}>
                <ModernButton
                  title={noteM.isPending ? "Salvando..." : "Salvar nota"}
                  variant="soft"
                  onPress={() => noteM.mutate(noteDraft)}
                  disabled={noteM.isPending || !noteDraft.trim()}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}
                  textStyle={{ fontSize: 12 }}
                />
              </View>
            </View>

            <ScrollView
              ref={scrollRef}
              contentContainerStyle={{ paddingBottom: 12 }}
              onContentSizeChange={onContentSizeChange}
              onLayout={onLayout}
            >
              {timelineBlocks.length === 0 ? (
                <Text style={{ color: colors.muted }}>Sem mensagens ainda.</Text>
              ) : (
                timelineBlocks.map((block) => {
                  if (block.type === "date") {
                    return (
                      <View key={block.id} style={{ alignItems: "center", marginBottom: 10, marginTop: 6 }}>
                        <View
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: "rgba(0,0,0,0.03)",
                          }}
                        >
                          <Text style={{ fontSize: 11, color: colors.muted }}>{block.label}</Text>
                        </View>
                      </View>
                    );
                  }

                  const t = block.item;
                  if (t.kind === "EVENT") {
                    const info = parseEventBody(t.eventLabel);
                    const isNote = t.eventKind === "NOTE";
                    return (
                      <View key={t.id} style={{ alignItems: "center", marginBottom: 10 }}>
                        <View
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: isNote ? "rgba(15,23,42,0.06)" : "rgba(0,0,0,0.03)",
                            maxWidth: "90%",
                          }}
                        >
                          <Text style={{ fontSize: 11, color: colors.muted, fontWeight: "800" }}>{info.title}</Text>
                          {info.body ? (
                            <Text style={{ marginTop: 4, fontSize: 12, color: colors.text }}>{info.body}</Text>
                          ) : null}
                        </View>
                      </View>
                    );
                  }

                  const isIn = t.sender === "PACIENTE";
                  const statusLabel =
                    t.localStatus === "SENDING" ? "Enviando..." : t.localStatus === "ERROR" ? "Erro" : "Enviado";

                  return (
                    <View
                      key={t.id}
                      style={{
                        alignSelf: isIn ? "flex-start" : "flex-end",
                        maxWidth: "84%",
                        flexDirection: "row",
                        gap: 8,
                        marginBottom: 8,
                      }}
                    >
                      {isIn ? (
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: "rgba(0,0,0,0.08)",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "800", color: colors.text }}>P</Text>
                        </View>
                      ) : null}

                      <View
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: isIn ? "rgba(0,0,0,0.02)" : "rgba(37,99,235,0.10)",
                          borderRadius: 14,
                          padding: 10,
                          flex: 1,
                        }}
                      >
                        <Text style={{ color: colors.text, lineHeight: 18 }}>{t.content || "-"}</Text>
                        <Text style={{ marginTop: 4, fontSize: 11, color: colors.muted, textAlign: "right" }}>
                          {formatTime(t.created_at)}
                          {!isIn ? `  -  ${statusLabel}` : ""}
                        </Text>
                      </View>

                      {!isIn ? (
                        <View
                          style={{
                            width: 24,
                            height: 24,
                            borderRadius: 12,
                            backgroundColor: "rgba(37,99,235,0.18)",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "800", color: "#2563eb" }}>{clinicInitial}</Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.border,
            padding: 10,
            backgroundColor: colors.background,
          }}
        >
          {sendError ? (
            <Text style={{ color: "#b91c1c", marginBottom: 6, fontSize: 12 }}>
              {sendError}
            </Text>
          ) : null}

          {sendM.isPending ? (
            <Text style={{ color: colors.muted, marginBottom: 6, fontSize: 12 }}>Enviando...</Text>
          ) : typingHint ? (
            <Text style={{ color: colors.muted, marginBottom: 6, fontSize: 12 }}>Digitando...</Text>
          ) : null}

          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Digite sua mensagem..."
              placeholderTextColor={colors.muted}
              multiline
              style={{
                flex: 1,
                minHeight: 40,
                maxHeight: 120,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 16,
                paddingHorizontal: 12,
                paddingVertical: 8,
                color: colors.text,
                backgroundColor: "rgba(0,0,0,0.03)",
              }}
            />
            <ModernButton
              title={sendM.isPending ? "..." : "Enviar"}
              variant="primary"
              onPress={() => {
                console.log("[ui] click enviar");
                sendM.mutate(draft);
              }}
              disabled={sendM.isPending || !draft.trim()}
              style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 }}
              textStyle={{ fontSize: 12 }}
            />
          </View>
        </View>

        {/* Modal Mover etapa */}
        <Modal visible={moveOpen} animationType="slide" transparent onRequestClose={() => setMoveOpen(false)}>
          <Pressable
            onPress={() => setMoveOpen(false)}
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
              <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Mover etapa</Text>
              <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>{title}</Text>

              <View style={{ height: 12 }} />

              {stagesQ.isLoading ? (
                <View style={{ paddingVertical: 18 }}>
                  <ActivityIndicator />
                </View>
              ) : (stagesQ.data ?? []).length === 0 ? (
                <View style={{ paddingVertical: 12 }}>
                  <Text style={{ color: colors.muted }}>Nao encontrei etapas para este pipeline.</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {(stagesQ.data ?? []).map((st) => {
                    const label = String(st.name ?? st.code ?? "").trim() || "Etapa";
                    const isCurrent = !!item?.stage_id && String(item.stage_id) === String(st.id);

                    return (
                      <Pressable
                        key={st.id}
                        onPress={() => moveStageM.mutate(st.id)}
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: isCurrent ? "rgba(37,99,235,0.45)" : "rgba(0,0,0,0.10)",
                          backgroundColor: isCurrent ? "rgba(37,99,235,0.12)" : "rgba(0,0,0,0.02)",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <Text style={{ fontWeight: "900", color: isCurrent ? "#1E3A8A" : colors.text }} numberOfLines={1}>
                          {label}
                        </Text>
                        {isCurrent ? <Text style={{ color: colors.muted, fontSize: 12 }}>Atual</Text> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              <View style={{ height: 12 }} />

              <Pressable
                onPress={() => setMoveOpen(false)}
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

        {/* Modal Atribuir */}
        <Modal visible={assignOpen} animationType="slide" transparent onRequestClose={() => setAssignOpen(false)}>
          <Pressable
            onPress={() => setAssignOpen(false)}
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
              <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Atribuir profissional</Text>
              <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>{title}</Text>

              <View style={{ height: 12 }} />

              {doctorsQ.isLoading ? (
                <View style={{ paddingVertical: 18 }}>
                  <ActivityIndicator />
                </View>
              ) : (doctorsQ.data ?? []).length === 0 ? (
                <View style={{ paddingVertical: 12 }}>
                  <Text style={{ color: colors.muted }}>Nenhum profissional encontrado.</Text>
                </View>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {(doctorsQ.data ?? []).map((d) => {
                    const label = String(d.name ?? d.email ?? d.id).trim();
                    const isCurrent = !!item?.doctor_id && String(item.doctor_id) === String(d.id);

                    return (
                      <Pressable
                        key={d.id}
                        onPress={() => assignDoctorM.mutate(d.id)}
                        style={{
                          paddingVertical: 12,
                          paddingHorizontal: 12,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: isCurrent ? "rgba(16,185,129,0.45)" : "rgba(0,0,0,0.10)",
                          backgroundColor: isCurrent ? "rgba(16,185,129,0.12)" : "rgba(0,0,0,0.02)",
                          flexDirection: "row",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <View>
                          <Text style={{ fontWeight: "900", color: isCurrent ? "#065F46" : colors.text }} numberOfLines={1}>
                            {label}
                          </Text>
                          {d.specialty ? (
                            <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>
                              {d.specialty}
                            </Text>
                          ) : null}
                        </View>
                        {isCurrent ? <Text style={{ color: colors.muted, fontSize: 12 }}>Atual</Text> : null}
                      </Pressable>
                    );
                  })}

                  <Pressable
                    onPress={() => assignDoctorM.mutate(null)}
                    style={{
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: "rgba(239,68,68,0.35)",
                      backgroundColor: "rgba(239,68,68,0.10)",
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: "#7F1D1D" }}>Remover atribuicao</Text>
                  </Pressable>
                </ScrollView>
              )}

              <View style={{ height: 12 }} />

              <Pressable
                onPress={() => setAssignOpen(false)}
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
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

