import { ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScreenContainer } from "@/components/screen-container";
import { ModernButton } from "@/components/modern-button";
import { useColors } from "@/hooks/use-colors";
import { apiCall } from "@/lib/_core/api";

export default function UpgradeScreen() {
  const colors = useColors();
  const router = useRouter();

  const plansQ = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const data = await apiCall<any>("/plans");
      return data?.plans ?? [];
    },
  });

  return (
    <ScreenContainer className="bg-[#F7F8FB]">
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text style={{ fontSize: 22, fontWeight: "900", color: colors.text }}>Atualize seu plano</Text>
        <Text style={{ marginTop: 4, color: colors.muted, fontSize: 12 }}>
          Este recurso está disponível em planos superiores.
        </Text>

        <View
          style={{
            marginTop: 12,
            padding: 14,
            borderRadius: 16,
            backgroundColor: "white",
            borderWidth: 1,
            borderColor: "rgba(15,23,42,0.08)",
          }}
        >
          <Text style={{ fontWeight: "900", color: colors.text }}>Quer liberar mais recursos?</Text>
          <Text style={{ marginTop: 6, color: colors.muted, fontSize: 12 }}>
            Compare os planos e escolha o melhor para sua clínica.
          </Text>

          <View style={{ marginTop: 10 }}>
            <ModernButton title="Ver planos" variant="primary" onPress={() => router.push("/plan-select")} />
          </View>
        </View>

        {plansQ.data?.length ? (
          <View style={{ marginTop: 16 }}>
            {plansQ.data.map((p: any) => (
              <View
                key={p.id}
                style={{
                  backgroundColor: "white",
                  borderRadius: 16,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: "rgba(15,23,42,0.08)",
                  marginBottom: 10,
                }}
              >
                <Text style={{ fontWeight: "900", color: colors.text }}>{p.name}</Text>
                {p.description ? (
                  <Text style={{ marginTop: 4, color: colors.muted, fontSize: 12 }}>{p.description}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </ScreenContainer>
  );
}
