// clinica-crm-mobile/app/(tabs)/patients.tsx
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

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

export default function PatientsScreen() {
  const colors = useColors();
  const router = useRouter();
  const features = useFeatures();
  const hasPatients = features.has("PATIENTS");
  const [q, setQ] = useState("");

  const patientsQ = useQuery({
    queryKey: ["patients", q],
    enabled: hasPatients,
    queryFn: async () => {
      const data = await apiCall<any>(`/patients?search=${encodeURIComponent(q)}`);
      const list: Patient[] = Array.isArray(data) ? data : (data?.patients ?? data?.data ?? []);
      return (list || []).map((p: any) => ({ ...p, id: String(p.id) }));
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

    return filtered.sort((a, b) =>
      String(a.name || "").localeCompare(String(b.name || ""), "pt-BR", { sensitivity: "base" })
    );
  }, [patientsQ.data, q]);

  return (
    <ScreenContainer className="bg-[#F2F5F7]">
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -140,
          left: -80,
          right: -80,
          height: 260,
          backgroundColor: "rgba(37,211,102,0.10)",
          borderBottomLeftRadius: 240,
          borderBottomRightRadius: 240,
        }}
      />

      <View style={{ padding: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ fontSize: 24, fontWeight: "900", color: colors.text }}>Pacientes</Text>
            <Text style={{ marginTop: 2, color: colors.muted, fontSize: 12 }}>
              {patients.length} cadastrados
            </Text>
          </View>
        </View>

        <View
          style={{
            marginTop: 12,
            borderWidth: 1,
            borderColor: "rgba(15,23,42,0.10)",
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 10,
            backgroundColor: "white",
          }}
        >
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar por nome, sobrenome ou telefone"
            placeholderTextColor={colors.muted}
            style={{ color: colors.text }}
          />
        </View>
      </View>

      {!hasPatients ? (
        <PlanLockedCard featureName="Pacientes" />
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
            patients.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push({ pathname: "/patients/[id]", params: { id: p.id } } as any)}
                style={{
                  borderWidth: 1,
                  borderColor: "rgba(15,23,42,0.08)",
                  backgroundColor: "white",
                  borderRadius: 18,
                  padding: 14,
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 999,
                      backgroundColor: avatarColor(String(p.name || p.id)),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ color: "white", fontWeight: "900", fontSize: 12 }}>
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
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                      Cadastro: {safeWhen(p.created_at)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}
