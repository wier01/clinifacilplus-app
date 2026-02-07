// clinica-crm-mobile/app/(tabs)/index.tsx
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { apiCall } from "@/lib/_core/api";
import { ModernButton } from "@/components/modern-button";

type Clinic = {
  id: string;
  name?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  address?: string | null;
  description?: string | null;
};

function getInitials(name?: string | null) {
  if (!name) return "CL";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function DashboardScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const role = String(user?.role || "").toUpperCase();

  const clinicQ = useQuery({
    queryKey: ["clinic"],
    enabled: !!user,
    queryFn: async () => {
      const data = await apiCall<any>("/clinic");
      return (data?.clinic ?? data) as Clinic;
    },
  });

  const clinic = clinicQ.data as Clinic | undefined;
  const clinicName = clinic?.name || "Sua clínica";
  const clinicLocation = [clinic?.city, clinic?.state].filter(Boolean).join(" • ");
  const clinicContact = [clinic?.phone, clinic?.address].filter(Boolean).join(" • ");
  const initials = getInitials(clinic?.name);

  return (
    <ScreenContainer className="bg-[#F7F8FB]">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ width: "100%", maxWidth: 980, alignSelf: "center" }}>
          <View className="px-4 pt-4">
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Text style={{ color: "#0F2E66", fontWeight: "900", fontSize: 18 }}>Clínica CRM</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Painel geral</Text>
              </View>
              <Pressable
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "rgba(15,23,42,0.12)",
                  backgroundColor: "white",
                }}
              >
                <Text style={{ fontWeight: "900", color: "#0F2E66" }}>≡</Text>
              </Pressable>
            </View>
          </View>

          <View
            className="mt-4 mx-4 rounded-3xl p-4"
            style={{
              borderWidth: 1,
              borderColor: "rgba(15,23,42,0.08)",
              backgroundColor: "white",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                height: 84,
                borderRadius: 18,
                backgroundColor: "rgba(30,64,175,0.12)",
                marginBottom: 12,
              }}
            />
            <View style={{ position: "absolute", top: 24, left: 24, width: 54, height: 54, borderRadius: 18, backgroundColor: "white", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(15,23,42,0.08)" }}>
              <Text style={{ fontWeight: "900", color: "#0F2E66" }}>{initials}</Text>
            </View>

            {isAuthenticated && user ? (
              <View style={{ marginLeft: 72 }}>
                <Text style={{ fontSize: 16, fontWeight: "900", color: colors.text }} numberOfLines={2}>
                  {clinicName}
                </Text>
                {clinicLocation ? (
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{clinicLocation}</Text>
                ) : null}
                {clinicContact ? (
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>
                    {clinicContact}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={{ color: colors.text, fontWeight: "900" }}>Faça login para ver sua clínica</Text>
            )}

            {clinicQ.isLoading ? (
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 }}>
                <ActivityIndicator size="small" />
                <Text style={{ color: colors.muted, fontSize: 12 }}>Carregando dados da clínica...</Text>
              </View>
            ) : null}
          </View>

          <View className="mx-4 mt-4">
            <Text style={{ fontWeight: "900", color: "#0F2E66", fontSize: 14 }}>Pacientes do dia</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Agenda resumida do turno atual.</Text>

            <View
              className="mt-3 rounded-2xl p-4"
              style={{ borderWidth: 1, borderColor: "rgba(15,23,42,0.08)", backgroundColor: "white" }}
            >
              {[{ time: "14:00", name: "Sem dados hoje" }].map((row, idx) => (
                <View
                  key={`${row.time}-${idx}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 10,
                    borderBottomWidth: idx === 0 ? 0 : 1,
                    borderBottomColor: "rgba(15,23,42,0.06)",
                  }}
                >
                  <View>
                    <Text style={{ fontWeight: "900", color: "#0F2E66" }}>{row.time}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{row.name}</Text>
                  </View>
                  <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: "rgba(16,185,129,0.6)" }} />
                </View>
              ))}
            </View>
          </View>

          <View className="mx-4 mt-4">
            <View
              className="rounded-3xl p-4"
              style={{ borderWidth: 1, borderColor: "rgba(15,23,42,0.08)", backgroundColor: "white" }}
            >
              <Text style={{ fontWeight: "900", color: "#0F2E66", fontSize: 14 }}>Pacientes por convênio</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Resumo dos últimos 30 dias.</Text>

              <View style={{ alignItems: "center", marginTop: 16 }}>
                <View
                  style={{
                    width: 160,
                    height: 160,
                    borderRadius: 999,
                    borderWidth: 18,
                    borderColor: "rgba(37,99,235,0.16)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: 110,
                      height: 110,
                      borderRadius: 999,
                      backgroundColor: "white",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 28, fontWeight: "900", color: "#0F2E66" }}>0</Text>
                    <Text style={{ fontSize: 12, color: colors.muted }}>Pacientes</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View className="mx-4 mt-4">
            <View
              className="rounded-3xl p-4"
              style={{ borderWidth: 1, borderColor: "rgba(15,23,42,0.08)", backgroundColor: "white" }}
            >
              <Text style={{ fontWeight: "900", color: "#0F2E66", fontSize: 14 }}>Duração do atendimento</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Média geral.</Text>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 16 }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    backgroundColor: "rgba(59,130,246,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#1E3A8A", fontWeight: "900" }}>⏱</Text>
                </View>
                <Text style={{ fontSize: 26, fontWeight: "900", color: "#0F2E66" }}>0 min</Text>
              </View>
            </View>
          </View>

          <View className="mx-4 mt-4">
            <Text style={{ fontWeight: "900", color: "#0F2E66", fontSize: 14 }}>Ações rápidas</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
              Acesse as áreas principais com um toque.
            </Text>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
              <Pressable
                onPress={() => router.push("/(tabs)/inbox")}
                style={{
                  flexBasis: "48%",
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(15,23,42,0.08)",
                  backgroundColor: "white",
                }}
              >
                <Text style={{ fontWeight: "900", color: "#0F2E66" }}>Inbox</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Mensagens e leads</Text>
              </Pressable>

              <Pressable
                onPress={() => router.push("/(tabs)/agenda")}
                style={{
                  flexBasis: "48%",
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(15,23,42,0.08)",
                  backgroundColor: "white",
                }}
              >
                <Text style={{ fontWeight: "900", color: "#0F2E66" }}>Agenda</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Atendimentos</Text>
              </Pressable>

              <Pressable
                onPress={() => router.push("/(tabs)/prontuarios")}
                style={{
                  flexBasis: "48%",
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(15,23,42,0.08)",
                  backgroundColor: "white",
                }}
              >
                <Text style={{ fontWeight: "900", color: "#0F2E66" }}>Prontuários</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Pacientes</Text>
              </Pressable>

              <Pressable
                onPress={() => router.push("/settings")}
                style={{
                  flexBasis: "48%",
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "rgba(15,23,42,0.08)",
                  backgroundColor: "white",
                }}
              >
                <Text style={{ fontWeight: "900", color: "#0F2E66" }}>Configurações</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Conta e integração</Text>
              </Pressable>
            </View>
          </View>

          {role === "ADMIN" ? (
            <View className="mx-4 mt-4">
              <ModernButton title="Onboarding" variant="primary" onPress={() => router.push("/onboarding")} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}



