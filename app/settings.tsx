// clinica-crm-mobile/app/settings.tsx
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, Text, TextInput, View, ActivityIndicator, ScrollView, Platform, Modal } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { ModernButton } from "@/components/modern-button";
import {
  getApiBaseUrl,
  setApiBaseUrl,
  clearApiBaseUrl,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  apiCall,
} from "@/lib/_core/api";
import { parseUserFromToken } from "@/lib/_core/auth";
import { useAuth } from "@/hooks/use-auth";

function sanitizeToken(raw: string) {
  return (raw || "").replace(/^Bearer\s+/i, "").trim();
}

function normalizeBaseUrl(u: string) {
  return (u || "").trim().replace(/\/+$/, "");
}

function maskToken(t: string) {
  const s = sanitizeToken(t);
  if (s.length <= 16) return "********";
  return `${s.slice(0, 10)}…${s.slice(-6)}`;
}

async function robustPing() {
  // Try /health (may exist) then /pipelines (real)
  try {
    const h = await apiCall<any>("/health");
    if (h?.ok === true) return;
  } catch {
    // ignore
  }
  // pipelines root might be /pipelines or /pipelines/ depending backend
  try {
    await apiCall<any>("/pipelines");
    return;
  } catch (e1) {
    try {
      await apiCall<any>("/pipelines/");
      return;
    } catch (e2: any) {
      throw e2;
    }
  }
}

export default function SettingsScreen({ embedded = false }: { embedded?: boolean }) {
  const colors = useColors();
  const router = useRouter();
  const auth = useAuth();
  const isWeb = Platform.OS === "web";

  const [baseUrl, setBaseUrlState] = useState("");
  const [token, setTokenState] = useState("");
  const [loading, setLoading] = useState(false);
  const [clinicName, setClinicName] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [savedToken, setSavedToken] = useState<string>("");
  const [showToken, setShowToken] = useState(false);
  const [activeSection, setActiveSection] = useState<
    "account" | "clinic" | "users" | "comms" | "billing" | "data"
  >("account");

  const [staffOpen, setStaffOpen] = useState(false);
  const [staffRole, setStaffRole] = useState<"MEDICO" | "SECRETARIA">("MEDICO");
  const [staffName, setStaffName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffSpecialty, setStaffSpecialty] = useState("");
  const [staffError, setStaffError] = useState<string | null>(null);

  const [commsDraft, setCommsDraft] = useState({
    reminders_24h: true,
    reminders_2h: true,
    auto_confirm: true,
    channel_priority: "WHATSAPP",
    channel_fallback: "SMS",
  });
  const [tplOpen, setTplOpen] = useState(false);
  const [tplName, setTplName] = useState("");
  const [tplCategory, setTplCategory] = useState("GERAL");
  const [tplBody, setTplBody] = useState("");
  const [tplError, setTplError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const b = await getApiBaseUrl();
      setBaseUrlState(b);

      const t = (await getAuthToken()) || "";
      setSavedToken(t);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiCall<any>("/clinic");
        const name = data?.clinic?.name ?? data?.name ?? "";
        if (name) setClinicName(String(name));
      } catch {
        // ignore
      }
    })();
  }, [savedToken]);

  const clinicInfoQ = useQuery({
    queryKey: ["clinic-info"],
    enabled: isWeb && activeSection === "clinic",
    queryFn: async () => {
      const data = await apiCall<any>("/clinic");
      return data?.clinic ?? data;
    },
  });

  const staffQ = useQuery({
    queryKey: ["staff"],
    enabled: isWeb && activeSection === "users",
    queryFn: async () => {
      const data = await apiCall<any>("/staff");
      const list = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
      return (list || []).map((r: any) => ({
        id: String(r.id),
        name: r.name ?? "",
        email: r.email ?? "",
        role: String(r.role ?? "").toUpperCase(),
        specialty: r.specialty ?? "",
        created_at: r.created_at ?? null,
      }));
    },
  });

  const whatsappQ = useQuery({
    queryKey: ["admin-whatsapp"],
    enabled: isWeb && activeSection === "comms",
    queryFn: async () => {
      const data = await apiCall<any>("/admin/whatsapp");
      return data?.whatsapp ?? null;
    },
  });

  const commsQ = useQuery({
    queryKey: ["comms-settings"],
    enabled: isWeb && activeSection === "comms",
    queryFn: async () => {
      const data = await apiCall<any>("/comms/settings");
      return data?.settings ?? null;
    },
  });

  const templatesQ = useQuery({
    queryKey: ["comms-templates"],
    enabled: isWeb && activeSection === "comms",
    queryFn: async () => {
      const data = await apiCall<any>("/comms/templates");
      return data?.templates ?? [];
    },
  });

  useEffect(() => {
    if (!commsQ.data) return;
    setCommsDraft({
      reminders_24h: !!commsQ.data.reminders_24h,
      reminders_2h: !!commsQ.data.reminders_2h,
      auto_confirm: !!commsQ.data.auto_confirm,
      channel_priority: String(commsQ.data.channel_priority || "WHATSAPP").toUpperCase(),
      channel_fallback: String(commsQ.data.channel_fallback || "SMS").toUpperCase(),
    });
  }, [commsQ.data]);

  const decodedSaved = useMemo(() => {
    const t = sanitizeToken(savedToken);
    if (!t) return null;
    return parseUserFromToken(t);
  }, [savedToken]);

  const decoded = useMemo(() => {
    const t = sanitizeToken(token);
    if (!t) return null;
    return parseUserFromToken(t);
  }, [token]);

  async function onSave() {
    const b = normalizeBaseUrl(baseUrl);
    const t = sanitizeToken(token);

    try {
      setLoading(true);

      if (b) await setApiBaseUrl(b);
      if (t) {
        const u = parseUserFromToken(t);
        if (!u) throw new Error("Token inválido (payload não reconhecido).");
        await setAuthToken(t);
      }

      await robustPing();

      const nowSaved = (await getAuthToken()) || "";
      setSavedToken(nowSaved);

      await auth.refresh();

      Alert.alert("OK", "Configurações salvas e API ok.");
      router.back();
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onClearToken() {
    await clearAuthToken();
    setTokenState("");
    setSavedToken("");
    await auth.refresh();
    Alert.alert("OK", "Token removido.");
  }

  async function onLogout() {
    if (Platform.OS === "web") {
      const ok = window.confirm("Deseja sair da conta?");
      if (!ok) return;
      await clearAuthToken();
      await auth.refresh();
      router.replace("/login");
      return;
    }
    Alert.alert("Sair", "Deseja sair da conta?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: async () => {
          await clearAuthToken();
          await auth.refresh();
          router.replace("/login");
        },
      },
    ]);
  }

  async function onResetBaseUrl() {
    await clearApiBaseUrl();
    const b = await getApiBaseUrl();
    if (b) {
      await setApiBaseUrl(b);
    }
    setBaseUrlState(b);
    Alert.alert("OK", "API Base URL restaurada.");
  }

  function resetStaffForm() {
    setStaffName("");
    setStaffEmail("");
    setStaffPassword("");
    setStaffSpecialty("");
    setStaffError(null);
  }

  async function createStaff() {
    setStaffError(null);
    const name = staffName.trim();
    const email = staffEmail.trim().toLowerCase();
    const password = staffPassword.trim();
    const specialty = staffSpecialty.trim();

    if (name.length < 3) return setStaffError("Informe um nome com pelo menos 3 caracteres.");
    if (!email) return setStaffError("Informe um email válido.");
    if (password.length < 6) return setStaffError("Senha mínima de 6 caracteres.");
    if (staffRole === "MEDICO" && !specialty) return setStaffError("Informe a especialidade do profissional.");

    try {
      await apiCall("/staff", {
        method: "POST",
        body: {
          name,
          email,
          password,
          role: staffRole,
          specialty: staffRole === "MEDICO" ? specialty : undefined,
        },
      });
      setStaffOpen(false);
      resetStaffForm();
      await staffQ.refetch();
      Alert.alert("OK", "Profissional criado.");
    } catch (e: any) {
      setStaffError(e?.message ?? String(e));
    }
  }

  async function saveComms() {
    try {
      await apiCall("/comms/settings", {
        method: "PUT",
        body: {
          reminders_24h: commsDraft.reminders_24h,
          reminders_2h: commsDraft.reminders_2h,
          auto_confirm: commsDraft.auto_confirm,
          channel_priority: commsDraft.channel_priority,
          channel_fallback: commsDraft.channel_fallback,
        },
      });
      await commsQ.refetch();
      Alert.alert("OK", "Configurações de comunicação salvas.");
    } catch (e: any) {
      Alert.alert("Erro", e?.message ?? String(e));
    }
  }

  async function createTemplate() {
    setTplError(null);
    const name = tplName.trim();
    const body = tplBody.trim();
    if (name.length < 3) return setTplError("Informe um nome.");
    if (!body) return setTplError("Informe o conteúdo.");

    try {
      await apiCall("/comms/templates", {
        method: "POST",
        body: { name, category: tplCategory, body },
      });
      setTplOpen(false);
      setTplName("");
      setTplBody("");
      await templatesQ.refetch();
    } catch (e: any) {
      setTplError(e?.message ?? String(e));
    }
  }

  const sections = [
    { key: "account", label: "Conta" },
    { key: "clinic", label: "Clínica" },
    { key: "users", label: "Usuários" },
    { key: "comms", label: "Comunicação" },
    { key: "billing", label: "Cobrança" },
    { key: "data", label: "Dados" },
  ] as const;

  const accountSection = (
    <View>
      <View
        className="rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
        style={{ borderWidth: 1, borderColor: colors.border }}
      >
        <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
          URL da API
        </Text>
        <Text className="text-[12px] mt-1" style={{ color: colors.muted }}>
          Web: use http://localhost:3000 (seu backend). No celular, use o IP do seu computador.
        </Text>

        <TextInput
          value={baseUrl}
          onChangeText={setBaseUrlState}
          placeholder="http://localhost:3000"
          placeholderTextColor={colors.muted}
          className="mt-3 rounded-xl px-3 py-3 text-[14px] bg-black/5 dark:bg-white/10"
          style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View className="flex-row mt-3">
          <View className="flex-1">
            <ModernButton title="Restaurar padrão" variant="dark" onPress={onResetBaseUrl} />
          </View>
        </View>
      </View>

      <View
        className="rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
        style={{ borderWidth: 1, borderColor: colors.border }}
      >
        <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
          Modo avançado
        </Text>
        <Text className="text-[12px] mt-1" style={{ color: colors.muted }}>
          Área para suporte técnico. O uso normal não precisa de token manual.
        </Text>

        <View className="flex-row mt-3">
          <View className="flex-1">
            <ModernButton
              title={showAdvanced ? "Ocultar avançado" : "Exibir avançado"}
              variant="outline"
              onPress={() => setShowAdvanced((v) => !v)}
            />
          </View>
        </View>

        {showAdvanced && (
          <View
            className="mt-4 rounded-xl p-3 bg-black/5 dark:bg-white/10"
            style={{ borderWidth: 1, borderColor: colors.border }}
          >
            {savedToken ? (
              <>
                <Text className="text-[12px] font-bold" style={{ color: colors.text }}>
                  Token salvo ✅
                </Text>
                <Text className="text-[12px] mt-1" style={{ color: colors.muted }}>
                  {showToken ? sanitizeToken(savedToken) : maskToken(savedToken)}
                </Text>

                {!!decodedSaved && (
                  <Text className="text-[12px] mt-2" style={{ color: colors.muted }}>
                    {decodedSaved.name} • {decodedSaved.email}
                    {clinicName ? ` • ${clinicName}` : ""}
                  </Text>
                )}

                <View className="flex-row mt-3">
                  <View className="flex-1 mr-2">
                    <ModernButton
                      title={showToken ? "Ocultar" : "Mostrar"}
                      variant="dark"
                      onPress={() => setShowToken((v) => !v)}
                    />
                  </View>
                  <View className="flex-1">
                    <ModernButton
                      title="Usar token salvo"
                      variant="primary"
                      onPress={() => {
                        setTokenState(sanitizeToken(savedToken));
                        setShowToken(true);
                      }}
                    />
                  </View>
                </View>
              </>
            ) : (
              <Text className="text-[12px]" style={{ color: colors.muted }}>
                Nenhum token salvo ainda.
              </Text>
            )}
          </View>
        )}

        {showAdvanced && (
          <>
            <TextInput
              value={token}
              onChangeText={setTokenState}
              placeholder="Cole o token aqui (opcional)"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 120 }}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
            />

            {!!decoded && (
              <View className="mt-3 rounded-xl p-3 bg-black/5 dark:bg-white/10" style={{ borderWidth: 1, borderColor: colors.border }}>
                <Text className="text-[12px] font-bold" style={{ color: colors.text }}>
                  Token colado (prévia)
                </Text>
                <Text className="text-[12px] mt-1" style={{ color: colors.muted }}>
                  {decoded.name} • {decoded.email}
                </Text>
                <Text className="text-[12px] mt-1" style={{ color: colors.muted }}>
                  Perfil: {decoded.role}
                  {clinicName ? ` • ${clinicName}` : ""}
                </Text>
              </View>
            )}

            <View className="flex-row mt-3">
              <View className="flex-1">
                <ModernButton title="Remover token" variant="dark" onPress={onClearToken} />
              </View>
            </View>
          </>
        )}
      </View>

      <View>
        <ModernButton
          title={loading ? "Salvando..." : "Salvar e testar"}
          variant="primary"
          onPress={onSave}
          disabled={loading}
          style={{ paddingVertical: 14 }}
          textStyle={{ fontSize: 15 }}
        />
      </View>

      <View className="mt-3">
        <ModernButton
          title="Sair da conta"
          variant="dark"
          onPress={onLogout}
          style={{ paddingVertical: 14 }}
          textStyle={{ fontSize: 15 }}
        />
      </View>
    </View>
  );

  function sectionCard(title: string, description: string, action?: { label: string; onPress: () => void }) {
    return (
      <View
        className="rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
        style={{ borderWidth: 1, borderColor: colors.border }}
      >
        <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
          {title}
        </Text>
        <Text className="text-[12px] mt-1" style={{ color: colors.muted }}>
          {description}
        </Text>
        {action ? (
          <View className="flex-row mt-3">
            <View className="flex-1">
              <ModernButton title={action.label} variant="primary" onPress={action.onPress} />
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  const staffItems = (staffQ.data ?? []) as Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    specialty?: string;
    created_at?: string | null;
  }>;

  const doctors = staffItems.filter((s) => s.role === "MEDICO");
  const reception = staffItems.filter((s) => s.role === "SECRETARIA");

  const sectionContent = activeSection === "account"
    ? accountSection
    : activeSection === "clinic"
      ? (
        <View>
          <View
            className="rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
            style={{ borderWidth: 1, borderColor: colors.border }}
          >
            <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
              Clínica
            </Text>
            <Text className="text-[12px] mt-1" style={{ color: colors.muted }}>
              Gerencie dados da clínica e integrações.
            </Text>

            <View className="mt-4 rounded-xl p-3 bg-black/5 dark:bg-white/10" style={{ borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontWeight: "900", color: colors.text }}>
                {clinicInfoQ.data?.name || clinicName || "Clínica"}
              </Text>
              <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>
                {(clinicInfoQ.data?.city || clinicInfoQ.data?.state)
                  ? `${clinicInfoQ.data?.city || ""}${clinicInfoQ.data?.city && clinicInfoQ.data?.state ? " • " : ""}${clinicInfoQ.data?.state || ""}`
                  : "Sem localização"}
              </Text>
              {clinicInfoQ.data?.phone || clinicInfoQ.data?.address ? (
                <Text style={{ color: colors.muted, marginTop: 4, fontSize: 12 }}>
                  {[clinicInfoQ.data?.phone, clinicInfoQ.data?.address].filter(Boolean).join(" • ")}
                </Text>
              ) : null}
            </View>

            <View className="flex-row mt-3">
              <View className="flex-1">
                <ModernButton title="Editar clínica" variant="primary" onPress={() => router.push("/clinic")} />
              </View>
            </View>
          </View>
        </View>
      )
    : activeSection === "users"
        ? (
          <View>
            <View
              className="rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
                  Profissionais de saúde
                </Text>
                <ModernButton
                  title="Adicionar profissional"
                  variant="primary"
                  onPress={() => {
                    setStaffRole("MEDICO");
                    resetStaffForm();
                    setStaffOpen(true);
                  }}
                />
              </View>

              <View style={{ marginTop: 10, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", borderRadius: 12, overflow: "hidden" }}>
                <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(0,0,0,0.04)" }}>
                  <Text style={{ flex: 1, fontSize: 11, color: colors.muted, fontWeight: "800" }}>NOME</Text>
                  <Text style={{ width: 160, fontSize: 11, color: colors.muted, fontWeight: "800" }}>ESPECIALIDADE</Text>
                  <Text style={{ width: 140, fontSize: 11, color: colors.muted, fontWeight: "800" }}>CRIADO EM</Text>
                </View>
                {staffQ.isLoading ? (
                  <View style={{ padding: 12 }}>
                    <ActivityIndicator />
                  </View>
                ) : doctors.length === 0 ? (
                  <View style={{ padding: 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Nenhum profissional encontrado.</Text>
                  </View>
                ) : (
                  doctors.map((d) => (
                    <View key={d.id} style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.06)" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "900", color: colors.text }} numberOfLines={1}>{d.name}</Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>{d.email}</Text>
                      </View>
                      <Text style={{ width: 160, color: colors.text, fontSize: 12 }} numberOfLines={1}>{d.specialty || "-"}</Text>
                      <Text style={{ width: 140, color: colors.muted, fontSize: 12 }}>
                        {d.created_at ? new Date(d.created_at).toLocaleDateString() : "-"}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            <View
              className="rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
              style={{ borderWidth: 1, borderColor: colors.border }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
                  Recepção
                </Text>
                <ModernButton
                  title="Adicionar recepcionista"
                  variant="primary"
                  onPress={() => {
                    setStaffRole("SECRETARIA");
                    resetStaffForm();
                    setStaffOpen(true);
                  }}
                />
              </View>

              <View style={{ marginTop: 10, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", borderRadius: 12, overflow: "hidden" }}>
                <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(0,0,0,0.04)" }}>
                  <Text style={{ flex: 1, fontSize: 11, color: colors.muted, fontWeight: "800" }}>NOME</Text>
                  <Text style={{ width: 140, fontSize: 11, color: colors.muted, fontWeight: "800" }}>CRIADO EM</Text>
                </View>
                {staffQ.isLoading ? (
                  <View style={{ padding: 12 }}>
                    <ActivityIndicator />
                  </View>
                ) : reception.length === 0 ? (
                  <View style={{ padding: 12 }}>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Nenhum usuário encontrado.</Text>
                  </View>
                ) : (
                  reception.map((d) => (
                    <View key={d.id} style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.06)" }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "900", color: colors.text }} numberOfLines={1}>{d.name}</Text>
                        <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>{d.email}</Text>
                      </View>
                      <Text style={{ width: 140, color: colors.muted, fontSize: 12 }}>
                        {d.created_at ? new Date(d.created_at).toLocaleDateString() : "-"}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
        )
        : activeSection === "comms"
          ? (
            <View>
              <View
                className="rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
                style={{ borderWidth: 1, borderColor: colors.border }}
              >
                <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
                  WhatsApp da clínica
                </Text>
                <Text className="text-[12px] mt-1" style={{ color: colors.muted }}>
                  Conecte o WhatsApp oficial da clínica para atender pacientes.
                </Text>

                <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "rgba(16,185,129,0.10)" }}>
                  <Text style={{ color: "#065F46", fontWeight: "900" }}>
                    Status: {whatsappQ.data?.status || "Desconectado"}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                    Número: {whatsappQ.data?.display_phone_number || "não informado"}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>WABA: {whatsappQ.data?.waba_id || "não informado"}</Text>
                </View>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <View style={{ flex: 1 }}>
                    <ModernButton title="Conectar / Revalidar" variant="primary" onPress={() => router.push("/onboarding")} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ModernButton title="Configurar templates" variant="outline" onPress={() => setTplOpen(true)} />
                  </View>
                </View>
              </View>

              <View
                className="rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
                style={{ borderWidth: 1, borderColor: colors.border }}
              >
                <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
                  Notificações automáticas
                </Text>
                <Text className="text-[12px] mt-1" style={{ color: colors.muted }}>
                  Defina lembretes, confirmações e mensagens automáticas.
                </Text>

                <View style={{ marginTop: 12, gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontWeight: "700", color: colors.text }}>Lembrete 24h antes</Text>
                    <Pressable onPress={() => setCommsDraft((s) => ({ ...s, reminders_24h: !s.reminders_24h }))}>
                      <Text style={{ color: colors.muted }}>{commsDraft.reminders_24h ? "Ativo" : "Inativo"}</Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontWeight: "700", color: colors.text }}>Lembrete 2h antes</Text>
                    <Pressable onPress={() => setCommsDraft((s) => ({ ...s, reminders_2h: !s.reminders_2h }))}>
                      <Text style={{ color: colors.muted }}>{commsDraft.reminders_2h ? "Ativo" : "Inativo"}</Text>
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontWeight: "700", color: colors.text }}>Confirmação automática</Text>
                    <Pressable onPress={() => setCommsDraft((s) => ({ ...s, auto_confirm: !s.auto_confirm }))}>
                      <Text style={{ color: colors.muted }}>{commsDraft.auto_confirm ? "Ativo" : "Inativo"}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              <View
                className="rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
                style={{ borderWidth: 1, borderColor: colors.border }}
              >
                <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
                  Canal de envio
                </Text>
                <Text className="text-[12px] mt-1" style={{ color: colors.muted }}>
                  Escolha como as mensagens são entregues ao paciente.
                </Text>

                <View style={{ marginTop: 12, gap: 8 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontWeight: "700", color: colors.text }}>Prioridade</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {["WHATSAPP", "SMS"].map((opt) => (
                        <Pressable
                          key={opt}
                          onPress={() => setCommsDraft((s) => ({ ...s, channel_priority: opt }))}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: commsDraft.channel_priority === opt ? "rgba(37,99,235,0.45)" : "rgba(0,0,0,0.10)",
                            backgroundColor: commsDraft.channel_priority === opt ? "rgba(37,99,235,0.10)" : "rgba(0,0,0,0.02)",
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text }}>{opt}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontWeight: "700", color: colors.text }}>Fallback</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {["SMS", "WHATSAPP"].map((opt) => (
                        <Pressable
                          key={opt}
                          onPress={() => setCommsDraft((s) => ({ ...s, channel_fallback: opt }))}
                          style={{
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: commsDraft.channel_fallback === opt ? "rgba(16,185,129,0.45)" : "rgba(0,0,0,0.10)",
                            backgroundColor: commsDraft.channel_fallback === opt ? "rgba(16,185,129,0.10)" : "rgba(0,0,0,0.02)",
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text }}>{opt}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={{ marginTop: 12 }}>
                  <ModernButton title="Salvar comunicação" variant="primary" onPress={saveComms} />
                </View>
              </View>

              <View
                className="rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
                style={{ borderWidth: 1, borderColor: colors.border }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
                    Templates de mensagens
                  </Text>
                  <ModernButton title="Adicionar template" variant="primary" onPress={() => setTplOpen(true)} />
                </View>

                <View style={{ marginTop: 10, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", borderRadius: 12, overflow: "hidden" }}>
                  <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(0,0,0,0.04)" }}>
                    <Text style={{ flex: 1, fontSize: 11, color: colors.muted, fontWeight: "800" }}>NOME</Text>
                    <Text style={{ width: 120, fontSize: 11, color: colors.muted, fontWeight: "800" }}>CATEGORIA</Text>
                    <Text style={{ width: 90, fontSize: 11, color: colors.muted, fontWeight: "800" }}>STATUS</Text>
                  </View>

                  {(templatesQ.data ?? []).length === 0 ? (
                    <View style={{ padding: 12 }}>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>Nenhum template criado.</Text>
                    </View>
                  ) : (
                    (templatesQ.data ?? []).map((t: any) => (
                      <View
                        key={t.id}
                        style={{
                          flexDirection: "row",
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          borderTopWidth: 1,
                          borderTopColor: "rgba(0,0,0,0.06)",
                        }}
                      >
                        <Text style={{ flex: 1, color: colors.text, fontSize: 12 }} numberOfLines={1}>
                          {t.name}
                        </Text>
                        <Text style={{ width: 120, color: colors.text, fontSize: 12 }}>
                          {String(t.category || "GERAL")}
                        </Text>
                        <Text style={{ width: 90, color: colors.muted, fontSize: 12 }}>{t.status}</Text>
                      </View>
                    ))
                  )}
                </View>
              </View>
            </View>
          )
          : activeSection === "billing"
            ? (
              <View>
                <View
                  className="rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
                  style={{ borderWidth: 1, borderColor: colors.border }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
                      Histórico de cobranças
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Últimos 12 meses</Text>
                  </View>

                  <View style={{ marginTop: 10, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", borderRadius: 12, overflow: "hidden" }}>
                    <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(0,0,0,0.04)" }}>
                      <Text style={{ width: 110, fontSize: 11, color: colors.muted, fontWeight: "800" }}>DATA</Text>
                      <Text style={{ flex: 1, fontSize: 11, color: colors.muted, fontWeight: "800" }}>DESCRIÇÃO</Text>
                      <Text style={{ width: 90, fontSize: 11, color: colors.muted, fontWeight: "800" }}>VALOR</Text>
                      <Text style={{ width: 90, fontSize: 11, color: colors.muted, fontWeight: "800" }}>STATUS</Text>
                      <Text style={{ width: 110, fontSize: 11, color: colors.muted, fontWeight: "800" }}>NFE</Text>
                    </View>

                    {[
                      { date: "20/01/2026", desc: "Cobrança referente a 20/01/2026", value: "R$ 98,18", status: "Pago" },
                      { date: "20/12/2025", desc: "Cobrança referente a 20/12/2025", value: "R$ 98,18", status: "Pago" },
                      { date: "20/11/2025", desc: "Cobrança referente a 20/11/2025", value: "R$ 98,18", status: "Pago" },
                    ].map((row, idx) => (
                      <View
                        key={`${row.date}-${idx}`}
                        style={{
                          flexDirection: "row",
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          borderTopWidth: 1,
                          borderTopColor: "rgba(0,0,0,0.06)",
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ width: 110, color: colors.text, fontSize: 12 }}>{row.date}</Text>
                        <Text style={{ flex: 1, color: colors.text, fontSize: 12 }} numberOfLines={1}>
                          {row.desc}
                        </Text>
                        <Text style={{ width: 90, color: colors.text, fontSize: 12 }}>{row.value}</Text>
                        <Text style={{ width: 90, color: "#065F46", fontSize: 12, fontWeight: "800" }}>{row.status}</Text>
                        <Pressable
                          style={{
                            width: 110,
                            paddingVertical: 6,
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: "rgba(37,99,235,0.35)",
                            backgroundColor: "rgba(37,99,235,0.10)",
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ color: "#1E3A8A", fontSize: 12, fontWeight: "800" }}>Baixar NFe</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                </View>

                <View
                  className="rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
                  style={{ borderWidth: 1, borderColor: colors.border }}
                >
                  <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
                    Assinatura
                  </Text>
                  <Text className="text-[12px] mt-1" style={{ color: colors.muted }}>
                    Gerencie plano e dados de cobrança.
                  </Text>

                  <View className="flex-row mt-3">
                    <View className="flex-1">
                      <ModernButton title="Ver assinatura" variant="primary" onPress={() => router.push("/plan-select")} />
                    </View>
                  </View>
                </View>
              </View>
            )
            : (
              <View>
                <View
                  className="rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
                  style={{ borderWidth: 1, borderColor: colors.border }}
                >
                  <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
                    Exportar dados
                  </Text>
                  <Text className="text-[12px] mt-1" style={{ color: colors.muted }}>
                    Baixe relatórios e backups da sua clínica.
                  </Text>

                  <View style={{ marginTop: 12, gap: 10 }}>
                    <ModernButton title="Exportar pacientes (CSV)" variant="primary" onPress={() => {}} />
                    <ModernButton title="Exportar agendamentos (CSV)" variant="outline" onPress={() => {}} />
                    <ModernButton title="Exportar mensagens (CSV)" variant="outline" onPress={() => {}} />
                  </View>
                </View>

                <View
                  className="rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
                  style={{ borderWidth: 1, borderColor: colors.border }}
                >
                  <Text className="text-[14px] font-bold" style={{ color: colors.text }}>
                    Backup completo
                  </Text>
                  <Text className="text-[12px] mt-1" style={{ color: colors.muted }}>
                    Gera um arquivo com todos os dados da clínica (uso administrativo).
                  </Text>
                  <View style={{ marginTop: 12 }}>
                    <ModernButton title="Gerar backup" variant="dark" onPress={() => {}} />
                  </View>
                </View>
              </View>
            );

  return (
    <ScreenContainer>
      <View style={{ flex: 1 }}>
        <View className="flex-row items-center mb-3 px-4 pt-4">
          {!embedded ? (
            <Pressable
              className="mr-3 px-3 py-2 rounded-xl bg-white/90 dark:bg-neutral-900/70"
              style={{ borderWidth: 1, borderColor: colors.border }}
              onPress={() => router.back()}
            >
              <Text style={{ color: colors.text }}>Voltar</Text>
            </Pressable>
          ) : null}

          <Text className="text-[22px] font-extrabold flex-1" style={{ color: colors.text }}>
            Configurações
          </Text>
        </View>

        {isWeb ? (
          <View style={{ flexDirection: "row", gap: 16, paddingHorizontal: 16, paddingBottom: 24 }}>
            <View style={{ width: 240 }}>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 16,
                  backgroundColor: "white",
                  overflow: "hidden",
                }}
              >
                <View style={{ padding: 14, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.06)" }}>
                  <Text style={{ fontWeight: "900", color: colors.text }}>Configurações da conta</Text>
                </View>
                {sections.map((s) => {
                  const active = activeSection === s.key;
                  return (
                    <Pressable
                      key={s.key}
                      onPress={() => setActiveSection(s.key)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 12,
                        borderLeftWidth: 3,
                        borderLeftColor: active ? "#2563EB" : "transparent",
                        backgroundColor: active ? "rgba(37,99,235,0.08)" : "white",
                      }}
                    >
                      <Text style={{ fontWeight: active ? "900" : "600", color: colors.text }}>{s.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                {sectionContent}
              </ScrollView>
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}>
            {accountSection}
          </ScrollView>
        )}
      </View>

      <Modal visible={staffOpen} animationType="slide" transparent onRequestClose={() => setStaffOpen(false)}>
        <Pressable
          onPress={() => setStaffOpen(false)}
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
            <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>
              {staffRole === "MEDICO" ? "Adicionar profissional" : "Adicionar recepcionista"}
            </Text>

            <TextInput
              value={staffName}
              onChangeText={setStaffName}
              placeholder="Nome completo"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />
            <TextInput
              value={staffEmail}
              onChangeText={setStaffEmail}
              placeholder="Email"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
              autoCapitalize="none"
            />
            <TextInput
              value={staffPassword}
              onChangeText={setStaffPassword}
              placeholder="Senha"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />

            {staffRole === "MEDICO" ? (
              <TextInput
                value={staffSpecialty}
                onChangeText={setStaffSpecialty}
                placeholder="Especialidade (ex: FISIOTERAPIA)"
                placeholderTextColor={colors.muted}
                className="mt-3 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
                style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
              />
            ) : null}

            {staffError ? (
              <Text style={{ marginTop: 6, color: "#991B1B", fontSize: 12 }}>{staffError}</Text>
            ) : null}

            <View className="flex-row mt-3 gap-10">
              <View className="flex-1">
                <ModernButton title="Cancelar" variant="dark" onPress={() => setStaffOpen(false)} />
              </View>
              <View className="flex-1">
                <ModernButton title="Salvar" variant="primary" onPress={createStaff} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={tplOpen} animationType="slide" transparent onRequestClose={() => setTplOpen(false)}>
        <Pressable
          onPress={() => setTplOpen(false)}
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
            <Text style={{ fontSize: 14, fontWeight: "900", color: colors.text }}>Novo template</Text>

            <TextInput
              value={tplName}
              onChangeText={setTplName}
              placeholder="Nome do template"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />
            <TextInput
              value={tplCategory}
              onChangeText={setTplCategory}
              placeholder="Categoria (GERAL/LEMBRETE/CONFIRMACAO)"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border }}
            />
            <TextInput
              value={tplBody}
              onChangeText={setTplBody}
              placeholder="Conteúdo da mensagem"
              placeholderTextColor={colors.muted}
              className="mt-3 rounded-xl px-3 py-3 text-[13px] bg-black/5 dark:bg-white/10"
              style={{ color: colors.text, borderWidth: 1, borderColor: colors.border, minHeight: 120 }}
              multiline
            />

            {tplError ? (
              <Text style={{ marginTop: 6, color: "#991B1B", fontSize: 12 }}>{tplError}</Text>
            ) : null}

            <View className="flex-row mt-3 gap-10">
              <View className="flex-1">
                <ModernButton title="Cancelar" variant="dark" onPress={() => setTplOpen(false)} />
              </View>
              <View className="flex-1">
                <ModernButton title="Salvar" variant="primary" onPress={createTemplate} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}


