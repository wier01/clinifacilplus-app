// clinica-crm-mobile/app/encounters/[id].tsx
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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { WebView } from "react-native-webview";

import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { apiCall } from "@/lib/_core/api";
import { useAuth } from "@/hooks/use-auth";
import { ModernButton } from "@/components/modern-button";

type Encounter = {
  id: string;
  patient_id?: string | null;
  doctor_id?: string | null;
  status?: string | null;
  started_at?: string | null;
};

type Note = { id: string; kind?: string | null; content?: any; created_at?: string | null };

type Document = { id: string; type?: string | null; title?: string | null; pdf_url?: string | null; created_at?: string | null };

type Attachment = { id: string; type?: string | null; filename?: string | null; url?: string | null; created_at?: string | null };

type EncounterResponse = {
  encounter?: Encounter | null;
  notes?: Note[];
  documents?: Document[];
  attachments?: Attachment[];
};

const TABS = ["NOTA", "DOCUMENTOS", "ANEXOS", "PRESCRICAO"] as const;

type TabKey = (typeof TABS)[number];

function safeWhen(dateStr?: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function renderNoteContent(raw: any) {
  if (raw === null || raw === undefined) return "";
  if (typeof raw !== "string") return JSON.stringify(raw);
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && typeof parsed.text === "string") return parsed.text;
    return JSON.stringify(parsed);
  } catch {
    return raw;
  }
}

export default function EncounterScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const auth = useAuth();

  const params = useLocalSearchParams<{ id?: string }>();
  const id = String(params.id || "");
  const role = String(auth.user?.role || "").toUpperCase();
  const canEditClinical = role === "MEDICO" || role === "ADMIN";

  const [tab, setTab] = useState<TabKey>("NOTA");
  const [noteText, setNoteText] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [rxTitle, setRxTitle] = useState("Receituário");
  const [rxText, setRxText] = useState("");
  const [examTitle, setExamTitle] = useState("Pedido de Exames");
  const [examText, setExamText] = useState("");
  const [attachUrl, setAttachUrl] = useState("");
  const [attachType, setAttachType] = useState("OTHER");
  const [prescriptionUrl, setPrescriptionUrl] = useState<string | null>(null);

  const encounterQ = useQuery({
    queryKey: ["encounter", id],
    enabled: !!id,
    queryFn: async () => {
      const data = await apiCall<EncounterResponse>(`/encounters/${id}`);
      return data as EncounterResponse;
    },
  });

  const encounter = encounterQ.data?.encounter ?? null;
  const notes = useMemo(() => encounterQ.data?.notes ?? [], [encounterQ.data?.notes]);
  const documents = useMemo(() => encounterQ.data?.documents ?? [], [encounterQ.data?.documents]);
  const attachments = useMemo(() => encounterQ.data?.attachments ?? [], [encounterQ.data?.attachments]);

  const addNoteM = useMutation({
    mutationFn: async () => {
      const content = noteText.trim();
      if (!content) throw new Error("Digite a nota.");
      await apiCall(`/encounters/${id}/notes`, { method: "POST", body: { kind: "TEXT", content } });
    },
    onSuccess: async () => {
      setNoteText("");
      await qc.invalidateQueries({ queryKey: ["encounter", id] });
    },
  });

  const createDocM = useMutation({
    mutationFn: async (type: string) => {
      const data = await apiCall<any>(`/documents`, {
        method: "POST",
        body: {
          patient_id: encounter?.patient_id,
          encounter_id: id,
          type,
          title: docTitle.trim() || null,
        },
      });
      return data?.document ?? data;
    },
    onSuccess: async () => {
      setDocTitle("");
      await qc.invalidateQueries({ queryKey: ["encounter", id] });
    },
  });

  const renderPdfM = useMutation({
    mutationFn: async (docId: string) => {
      await apiCall(`/documents/${docId}/render-pdf`, { method: "POST" });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["encounter", id] });
    },
  });

  const createAndRenderDocM = useMutation({
    mutationFn: async (args: { type: string; title: string | null; metadata: any }) => {
      const created = await apiCall<any>(`/documents`, {
        method: "POST",
        body: {
          patient_id: encounter?.patient_id,
          encounter_id: id,
          type: args.type,
          title: args.title,
          metadata: args.metadata,
        },
      });
      const docId = created?.document?.id ?? created?.id;
      if (docId) {
        const rendered = await apiCall<any>(`/documents/${docId}/render-pdf`, { method: "POST" });
        return rendered?.pdf_url ?? null;
      }
      return null;
    },
    onSuccess: async (pdfUrl) => {
      await qc.invalidateQueries({ queryKey: ["encounter", id] });
      if (pdfUrl) {
        try {
          await Linking.openURL(String(pdfUrl));
        } catch {
          // ignore
        }
      }
    },
  });

  const addAttachmentM = useMutation({
    mutationFn: async () => {
      if (!attachUrl.trim()) throw new Error("Informe a URL.");
      await apiCall(`/attachments`, {
        method: "POST",
        body: {
          patient_id: encounter?.patient_id,
          encounter_id: id,
          type: attachType,
          url: attachUrl.trim(),
        },
      });
    },
    onSuccess: async () => {
      setAttachUrl("");
      await qc.invalidateQueries({ queryKey: ["encounter", id] });
    },
  });

  const startPrescriptionM = useMutation({
    mutationFn: async () => {
      const data = await apiCall<any>(`/prescriptions/start`, {
        method: "POST",
        body: { encounter_id: id },
      });
      return data?.url ?? "https://example.com";
    },
    onSuccess: (url) => setPrescriptionUrl(String(url)),
  });

  return (
    <ScreenContainer>
      <View style={{ padding: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable
            onPress={() => router.back()}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: "rgba(0,0,0,0.03)",
            }}
          >
            <Text style={{ color: colors.text, fontWeight: "700" }}>Voltar</Text>
          </Pressable>

          <Text style={{ fontSize: 18, fontWeight: "900", color: colors.text, flex: 1 }} numberOfLines={1}>
            Atendimento
          </Text>
        </View>

        <Text style={{ marginTop: 6, color: colors.muted }} numberOfLines={1}>
          ID: {id}
        </Text>
      </View>

      {encounterQ.isLoading ? (
        <View style={{ padding: 16 }}>
          <ActivityIndicator />
        </View>
      ) : encounterQ.isError ? (
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
          <Text style={{ color: "#991B1B", fontWeight: "800" }}>Erro ao carregar atendimento.</Text>
          <Text style={{ color: "#7F1D1D", marginTop: 6, lineHeight: 18 }}>
            {String((encounterQ.error as any)?.message ?? "Erro desconhecido")}
          </Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {TABS.map((t) => {
              const active = t === tab;
              return (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? "rgba(59,130,246,0.45)" : "rgba(0,0,0,0.10)",
                    backgroundColor: active ? "rgba(59,130,246,0.12)" : "rgba(0,0,0,0.02)",
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: "900", color: active ? "#1E3A8A" : "#111827" }}>
                    {t}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            {tab === "NOTA" ? (
              <View>
                <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Nota clínica</Text>
                {!canEditClinical && (
                  <Text style={{ marginTop: 6, color: colors.muted, fontSize: 12 }}>
                    Apenas médico ou admin pode registrar notas clínicas.
                  </Text>
                )}
                <TextInput
                  value={noteText}
                  onChangeText={setNoteText}
                  placeholder="Escreva a evolução ou SOAP..."
                  placeholderTextColor={colors.muted}
                  multiline
                  style={{
                    marginTop: 10,
                    minHeight: 120,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 12,
                    color: colors.text,
                    backgroundColor: "rgba(0,0,0,0.03)",
                  }}
                  editable={canEditClinical}
                />

                <View style={{ marginTop: 10 }}>
                  <ModernButton
                    title={addNoteM.isPending ? "Salvando..." : "Salvar nota"}
                    variant="primary"
                    onPress={() => addNoteM.mutate()}
                    disabled={addNoteM.isPending || !canEditClinical}
                  />
                </View>

                <View style={{ height: 18 }} />

                <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Histórico</Text>
                <View style={{ marginTop: 10, gap: 10 }}>
                  {notes.length === 0 ? (
                    <Text style={{ color: colors.muted }}>Sem notas ainda.</Text>
                  ) : (
                    notes.map((n) => (
                      <View
                        key={n.id}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: "rgba(0,0,0,0.02)",
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text }}>
                          {n.kind || "TEXT"}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.muted }}>{safeWhen(n.created_at)}</Text>
                        <Text style={{ marginTop: 6, color: colors.text, lineHeight: 18 }}>
                          {renderNoteContent(n.content)}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            ) : null}

            {tab === "DOCUMENTOS" ? (
              <View>
                <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Documentos</Text>
                {!canEditClinical && (
                  <Text style={{ marginTop: 6, color: colors.muted, fontSize: 12 }}>
                    Apenas médico ou admin pode criar documentos.
                  </Text>
                )}

                <TextInput
                  value={docTitle}
                  onChangeText={setDocTitle}
                  placeholder="Título (opcional)"
                  placeholderTextColor={colors.muted}
                  style={{
                    marginTop: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 12,
                    color: colors.text,
                    backgroundColor: "rgba(0,0,0,0.03)",
                  }}
                  editable={canEditClinical}
                />

                <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                  {["ATESTADO", "RELATORIO"].map((t) => (
                    <Pressable
                      key={t}
                      onPress={() => createDocM.mutate(t)}
                      disabled={!canEditClinical}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: "rgba(0,0,0,0.03)",
                        opacity: canEditClinical ? 1 : 0.6,
                      }}
                    >
                      <Text style={{ fontWeight: "800", color: colors.text }}>{t}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={{ height: 18 }} />

                <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Lista</Text>
                <View style={{ marginTop: 10, gap: 10 }}>
                  {documents.length === 0 ? (
                    <Text style={{ color: colors.muted }}>Sem documentos ainda.</Text>
                  ) : (
                    documents.map((d) => (
                      <View
                        key={d.id}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: "rgba(0,0,0,0.02)",
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text }}>
                          {d.type}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.muted }}>{safeWhen(d.created_at)}</Text>
                        <Text style={{ marginTop: 6, color: colors.text }} numberOfLines={2}>
                          {d.title || "Documento"}
                        </Text>

                        <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                          {d.type ? (
                            <Pressable
                              onPress={() => renderPdfM.mutate(d.id)}
                              disabled={!canEditClinical}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: colors.border,
                                backgroundColor: "rgba(0,0,0,0.03)",
                                opacity: canEditClinical ? 1 : 0.6,
                              }}
                            >
                              <Text style={{ fontWeight: "800", color: colors.text }}>Gerar PDF</Text>
                            </Pressable>
                          ) : null}

                          {d.pdf_url ? (
                            <Pressable
                              onPress={() => Linking.openURL(String(d.pdf_url))}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: colors.border,
                                backgroundColor: "rgba(0,0,0,0.03)",
                              }}
                            >
                              <Text style={{ fontWeight: "800", color: colors.text }}>Abrir PDF</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    ))
                  )}
                </View>
              </View>
            ) : null}

            {tab === "ANEXOS" ? (
              <View>
                <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Anexos</Text>

                <TextInput
                  value={attachUrl}
                  onChangeText={setAttachUrl}
                  placeholder="URL do anexo"
                  placeholderTextColor={colors.muted}
                  style={{
                    marginTop: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 12,
                    color: colors.text,
                    backgroundColor: "rgba(0,0,0,0.03)",
                  }}
                />

                <TextInput
                  value={attachType}
                  onChangeText={setAttachType}
                  placeholder="Tipo (IMAGE/PDF/AUDIO/OTHER)"
                  placeholderTextColor={colors.muted}
                  style={{
                    marginTop: 10,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 12,
                    padding: 12,
                    color: colors.text,
                    backgroundColor: "rgba(0,0,0,0.03)",
                  }}
                />

                <View style={{ marginTop: 10 }}>
                  <ModernButton
                    title={addAttachmentM.isPending ? "Salvando..." : "Adicionar link"}
                    variant="primary"
                    onPress={() => addAttachmentM.mutate()}
                    disabled={addAttachmentM.isPending}
                  />
                </View>

                <View style={{ height: 18 }} />

                <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Lista</Text>
                <View style={{ marginTop: 10, gap: 10 }}>
                  {attachments.length === 0 ? (
                    <Text style={{ color: colors.muted }}>Sem anexos ainda.</Text>
                  ) : (
                    attachments.map((a) => (
                      <View
                        key={a.id}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.border,
                          backgroundColor: "rgba(0,0,0,0.02)",
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text }}>
                          {a.type || "OTHER"}
                        </Text>
                        <Text style={{ fontSize: 12, color: colors.muted }}>{safeWhen(a.created_at)}</Text>
                        <Text style={{ marginTop: 6, color: colors.text }} numberOfLines={2}>
                          {a.url}
                        </Text>
                        <Pressable
                          onPress={() => Linking.openURL(String(a.url))}
                          style={{
                            marginTop: 8,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: colors.border,
                            backgroundColor: "rgba(0,0,0,0.03)",
                          }}
                        >
                          <Text style={{ fontWeight: "800", color: colors.text }}>Abrir</Text>
                        </Pressable>
                      </View>
                    ))
                  )}
                </View>
              </View>
            ) : null}

            {tab === "PRESCRICAO" ? (
              <View>
                <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Receituário e exames</Text>
                {!canEditClinical && (
                  <Text style={{ marginTop: 6, color: colors.muted, fontSize: 12 }}>
                    Apenas médico ou admin pode gerar prescrições.
                  </Text>
                )}

                <View style={{ marginTop: 12, gap: 14 }}>
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      padding: 12,
                      backgroundColor: "rgba(0,0,0,0.02)",
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: colors.text }}>Receituário</Text>
                    <TextInput
                      value={rxTitle}
                      onChangeText={setRxTitle}
                      placeholder="Título do receituário"
                      placeholderTextColor={colors.muted}
                      style={{
                        marginTop: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 10,
                        padding: 10,
                        color: colors.text,
                        backgroundColor: "rgba(0,0,0,0.03)",
                      }}
                      editable={canEditClinical}
                    />
                    <TextInput
                      value={rxText}
                      onChangeText={setRxText}
                      placeholder="Ex: Dipirona 500mg — 1 cp a cada 8h por 3 dias"
                      placeholderTextColor={colors.muted}
                      multiline
                      style={{
                        marginTop: 8,
                        minHeight: 120,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 10,
                        padding: 10,
                        color: colors.text,
                        backgroundColor: "rgba(0,0,0,0.03)",
                      }}
                      editable={canEditClinical}
                    />
                    <View style={{ marginTop: 10 }}>
                      <ModernButton
                        title={createAndRenderDocM.isPending ? "Gerando..." : "Gerar PDF do receituário"}
                        variant="primary"
                        onPress={() =>
                          createAndRenderDocM.mutate({
                            type: "PRESCRIPTION",
                            title: rxTitle.trim() || "Receituário",
                            metadata: {
                              items: rxText
                                .split("\n")
                                .map((l) => l.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                        disabled={createAndRenderDocM.isPending || !canEditClinical}
                      />
                    </View>
                  </View>

                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 12,
                      padding: 12,
                      backgroundColor: "rgba(0,0,0,0.02)",
                    }}
                  >
                    <Text style={{ fontWeight: "900", color: colors.text }}>Pedido de exame</Text>
                    <TextInput
                      value={examTitle}
                      onChangeText={setExamTitle}
                      placeholder="Título do pedido"
                      placeholderTextColor={colors.muted}
                      style={{
                        marginTop: 8,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 10,
                        padding: 10,
                        color: colors.text,
                        backgroundColor: "rgba(0,0,0,0.03)",
                      }}
                      editable={canEditClinical}
                    />
                    <TextInput
                      value={examText}
                      onChangeText={setExamText}
                      placeholder="Ex: Hemograma completo"
                      placeholderTextColor={colors.muted}
                      multiline
                      style={{
                        marginTop: 8,
                        minHeight: 120,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: 10,
                        padding: 10,
                        color: colors.text,
                        backgroundColor: "rgba(0,0,0,0.03)",
                      }}
                      editable={canEditClinical}
                    />
                    <View style={{ marginTop: 10 }}>
                      <ModernButton
                        title={createAndRenderDocM.isPending ? "Gerando..." : "Gerar PDF do pedido"}
                        variant="primary"
                        onPress={() =>
                          createAndRenderDocM.mutate({
                            type: "PEDIDO_EXAME",
                            title: examTitle.trim() || "Pedido de Exames",
                            metadata: {
                              exams: examText
                                .split("\n")
                                .map((l) => l.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                        disabled={createAndRenderDocM.isPending || !canEditClinical}
                      />
                    </View>
                  </View>
                </View>

                <View style={{ marginTop: 14 }}>
                  <ModernButton
                    title={startPrescriptionM.isPending ? "Abrindo..." : "Prescrição digital (em breve)"}
                    variant="primary"
                    onPress={() => startPrescriptionM.mutate()}
                    disabled={startPrescriptionM.isPending || !canEditClinical}
                  />
                </View>

                <Text style={{ marginTop: 10, color: colors.muted, fontSize: 12 }}>
                  Placeholder para futura integração com Memed.
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      )}

      <Modal visible={!!prescriptionUrl} animationType="slide" onRequestClose={() => setPrescriptionUrl(null)}>
        <View style={{ flex: 1 }}>
          <View style={{ padding: 12 }}>
            <Pressable
              onPress={() => setPrescriptionUrl(null)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: "rgba(0,0,0,0.03)",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>Fechar</Text>
            </Pressable>
          </View>
          {prescriptionUrl ? <WebView source={{ uri: prescriptionUrl }} style={{ flex: 1 }} /> : null}
        </View>
      </Modal>
    </ScreenContainer>
  );
}


