import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/use-colors";

export function PlanLockedCard({ featureName }: { featureName: string }) {
  const colors = useColors();
  const router = useRouter();

  return (
    <View
      style={{
        margin: 16,
        padding: 14,
        borderRadius: 16,
        backgroundColor: "white",
        borderWidth: 1,
        borderColor: "rgba(15,23,42,0.08)",
      }}
    >
      <Text style={{ fontWeight: "900", color: colors.text }}>Recurso do plano</Text>
      <Text style={{ marginTop: 6, color: colors.muted, fontSize: 12 }}>
        {featureName} está disponível apenas em planos superiores.
      </Text>

      <Pressable
        onPress={() => router.push("/upgrade")}
        style={{
          marginTop: 10,
          paddingVertical: 10,
          borderRadius: 12,
          alignItems: "center",
          backgroundColor: "rgba(37,99,235,0.12)",
          borderWidth: 1,
          borderColor: "rgba(37,99,235,0.45)",
        }}
      >
        <Text style={{ fontWeight: "900", color: "#1E3A8A" }}>Ver planos</Text>
      </Pressable>
    </View>
  );
}
