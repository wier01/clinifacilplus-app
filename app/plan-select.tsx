// clinica-crm-mobile/app/plan-select.tsx
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { ModernButton } from "@/components/modern-button";
import { useColors } from "@/hooks/use-colors";
import { apiCall } from "@/lib/_core/api";
import { kvGet, kvSet } from "@/lib/_core/storage";

const KEY_ONBOARDING = "clinica_crm_onboarding_v1";

type Plan = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  price_monthly_cents?: number | null;
  features?: string[];
};

function formatBRL(cents?: number | null) {
  const v = Number(cents || 0) / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function PlanSelectScreen() {
  const colors = useColors();
  const router = useRouter();
  const isWeb = Platform.OS === "web";
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const plansQ = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const data = await apiCall<any>("/plans");
      const list: Plan[] = data?.plans ?? [];
      return list.map((p: any) => ({
        id: String(p.id),
        code: String(p.code || ""),
        name: String(p.name || ""),
        description: p.description ?? null,
        price_monthly_cents: Number(p.price_monthly_cents ?? 0),
        features: p.features ?? [],
        is_selected: p.is_selected ?? p.selected ?? p.active ?? false,
      }));
    },
  });

  const plans = useMemo(() => plansQ.data ?? [], [plansQ.data]);
  const selectedPlan = useMemo(() => {
    const list = plans as any[];
    return (
      list.find((p) => p?.is_selected || p?.selected || p?.active) ||
      list.find((p) => String(p?.code || "").toLowerCase().includes("pro")) ||
      list[0] ||
      null
    );
  }, [plans]);

  async function markOnboardingPlanDone() {
    const saved = await kvGet(KEY_ONBOARDING);
    let next: any = { plan: true };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        next = { ...parsed, plan: true };
      } catch {}
    }
    await kvSet(KEY_ONBOARDING, JSON.stringify(next));
  }

  async function choosePlan(planId: string) {
    try {
      setError(null);
      setSavingId(planId);
      await apiCall("/plans/select", { method: "POST", body: { plan_id: planId } });
      await markOnboardingPlanDone();
      router.back();
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <ScreenContainer className="bg-[#F7F8FB]">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={{ marginBottom: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>Assinatura</Text>
          <Text style={{ marginTop: 4, color: colors.muted, fontSize: 12 }}>
            Você pode trocar de plano a qualquer momento.
          </Text>
        </View>

        <View style={{ flexDirection: isWeb ? "row" : "column", gap: 16, alignItems: "flex-start" }}>
          <View style={{ flex: 1, minWidth: 320 }}>
            {plansQ.isLoading ? (
              <View style={{ padding: 16 }}>
                <ActivityIndicator />
              </View>
            ) : plansQ.isError ? (
              <View
                style={{
                  backgroundColor: "#FEF2F2",
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: "#FECACA",
                }}
              >
                <Text style={{ color: "#991B1B", fontWeight: "900" }}>Não consegui carregar os planos.</Text>
              </View>
            ) : (
              plans.map((p: any) => (
                <View
                  key={p.id}
                  style={{
                    backgroundColor: "white",
                    borderRadius: 16,
                    padding: 16,
                    borderWidth: 1,
                    borderColor: "rgba(15,23,42,0.08)",
                    marginBottom: 12,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }}>{p.name}</Text>
                    <Text style={{ fontSize: 13, fontWeight: "800", color: "#1E3A8A" }}>
                      {formatBRL(p.price_monthly_cents)}/mês
                    </Text>
                  </View>

                  {p.description ? (
                    <Text style={{ marginTop: 6, color: colors.muted, fontSize: 12 }}>{p.description}</Text>
                  ) : null}

                  {Array.isArray(p.features) && p.features.length > 0 ? (
                    <View style={{ marginTop: 10 }}>
                      {p.features.slice(0, 6).map((f: string) => (
                        <Text key={f} style={{ color: colors.muted, fontSize: 12 }}>
                          • {f}
                        </Text>
                      ))}
                    </View>
                  ) : null}

                  <View style={{ marginTop: 12 }}>
                    <ModernButton
                      title={savingId === p.id ? "Selecionando..." : "Selecionar"}
                      variant="primary"
                      onPress={() => choosePlan(p.id)}
                    />
                  </View>
                </View>
              ))
            )}

            {error ? (
              <Text style={{ marginTop: 6, color: "#991B1B", fontSize: 12 }}>{error}</Text>
            ) : null}
          </View>

          {isWeb ? (
            <View style={{ width: 320 }}>
              <View
                style={{
                  backgroundColor: "white",
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 1,
                  borderColor: "rgba(15,23,42,0.08)",
                }}
              >
                <Text style={{ fontWeight: "900", color: colors.text }}>Seu plano</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                  {selectedPlan?.name || "Selecione um plano"}
                </Text>

                <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "rgba(37,99,235,0.08)" }}>
                  <Text style={{ color: "#1E3A8A", fontWeight: "900", fontSize: 18 }}>
                    {selectedPlan ? formatBRL(selectedPlan.price_monthly_cents) : "—"}
                  </Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>por mês</Text>
                </View>

                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontWeight: "800", color: colors.text, fontSize: 12 }}>Benefícios principais</Text>
                  {Array.isArray(selectedPlan?.features) && selectedPlan?.features?.length ? (
                    selectedPlan.features.slice(0, 5).map((f: string) => (
                      <Text key={f} style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                        • {f}
                      </Text>
                    ))
                  ) : (
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                      WhatsApp, agenda e prontuários integrados.
                    </Text>
                  )}
                </View>

                <View style={{ marginTop: 12 }}>
                  <ModernButton title="Quero mudar de plano" variant="primary" onPress={() => {}} />
                </View>
              </View>
            </View>
          ) : null}
        </View>

        <Pressable onPress={() => router.back()} style={{ marginTop: 12, alignSelf: "center" }}>
          <Text style={{ color: colors.muted }}>Voltar</Text>
        </Pressable>
      </ScrollView>
    </ScreenContainer>
  );
}
