// clinica-crm-mobile/app/onboarding.tsx
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { ModernButton } from "@/components/modern-button";
import { apiCall } from "@/lib/_core/api";

type StepKey = "plan" | "clinic_profile" | "team" | "whatsapp";

type Step = {
  key: StepKey;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  done: boolean;
  hint?: string;
};

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();

  const clinicQ = useQuery({
    queryKey: ["clinic"],
    queryFn: async () => {
      const data = await apiCall<any>("/clinic");
      return data?.clinic ?? data;
    },
  });

  const staffQ = useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      const data = await apiCall<any>("/staff");
      return data?.items ?? data ?? [];
    },
  });

  const plansQ = useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const data = await apiCall<any>("/plans");
      return data ?? {};
    },
  });

  const whatsappQ = useQuery({
    queryKey: ["admin-whatsapp"],
    queryFn: async () => {
      const data = await apiCall<any>("/admin/whatsapp");
      return data?.whatsapp ?? null;
    },
  });

  const clinic = clinicQ.data ?? {};
  const hasClinicProfile =
    Boolean(clinic?.name) &&
    (Boolean(clinic?.phone) || Boolean(clinic?.address) || Boolean(clinic?.city) || Boolean(clinic?.state));
  const staffCount = Array.isArray(staffQ.data) ? staffQ.data.length : 0;
  const hasTeam = staffCount > 0;
  const hasPlan = Boolean(plansQ.data?.current?.plan_id);
  const whatsappStatus = String(whatsappQ.data?.status || "").toUpperCase();
  const hasWhatsapp = whatsappStatus === "CONNECTED";

  const steps = useMemo<Step[]>(
    () => [
      {
        key: "plan",
        title: "Escolher plano",
        description: "Defina o plano ideal para sua clínica. Você pode mudar depois.",
        actionLabel: "Ver planos",
        onAction: () => router.push("/plan-select"),
        done: hasPlan,
        hint: hasPlan ? `Plano ativo: ${plansQ.data?.current?.plan_name ?? ""}` : "Nenhum plano ativo",
      },
      {
        key: "clinic_profile",
        title: "Completar dados da clínica",
        description: "Nome, telefone, endereço e descrição. Isso aparece para o time e nos documentos.",
        actionLabel: "Editar clínica",
        onAction: () => router.push("/clinic"),
        done: hasClinicProfile,
        hint: clinic?.name ? `Clínica: ${clinic.name}` : "Dados incompletos",
      },
      {
        key: "team",
        title: "Adicionar equipe",
        description: "Cadastre profissionais e secretárias. Cada pessoa recebe seu login.",
        actionLabel: "Gerenciar equipe",
        onAction: () => router.push("/clinic"),
        done: hasTeam,
        hint: hasTeam ? `${staffCount} pessoa(s) cadastradas` : "Nenhum usuário",
      },
      {
        key: "whatsapp",
        title: "Conectar WhatsApp",
        description: "Configure o número oficial da clínica para enviar e receber mensagens.",
        actionLabel: "Conectar agora",
        onAction: () => router.push("/whatsapp-setup"),
        done: hasWhatsapp,
        hint: whatsappStatus ? `Status: ${whatsappStatus}` : "Desconectado",
      },
    ],
    [router, hasPlan, hasClinicProfile, hasTeam, hasWhatsapp, staffCount, clinic, plansQ.data, whatsappStatus]
  );

  const completedCount = steps.filter((s) => s.done).length;
  const totalSteps = steps.length;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-row items-center mb-3" style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Pressable
            className="mr-3 px-3 py-2 rounded-xl bg-white/90 dark:bg-neutral-900/70"
            style={{ borderWidth: 1, borderColor: colors.border }}
            onPress={() => router.back()}
          >
            <Text style={{ color: colors.text }}>Voltar</Text>
          </Pressable>

          <Text className="text-[22px] font-extrabold flex-1" style={{ color: colors.text }}>
            Onboarding
          </Text>
        </View>

        <View
          className="mx-4 rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
          style={{ borderWidth: 1, borderColor: colors.border }}
        >
          <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>
            Progresso: {completedCount}/{totalSteps} concluídos
          </Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
            Complete os passos abaixo para usar o CRM no dia a dia.
          </Text>
        </View>

        <View className="mx-4">
          {steps.map((step) => {
            const isDone = step.done;
            return (
              <View
                key={step.key}
                className="rounded-2xl p-4 bg-white/90 dark:bg-neutral-900/70 mb-3"
                style={{ borderWidth: 1, borderColor: colors.border }}
              >
                <Text style={{ color: colors.text, fontWeight: "900", fontSize: 14 }}>
                  {step.title}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                  {step.description}
                </Text>
                {step.hint ? (
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>
                    {step.hint}
                  </Text>
                ) : null}

                <View className="flex-row mt-3">
                  <View className="flex-1">
                    <ModernButton title={step.actionLabel} variant="primary" onPress={step.onAction} />
                  </View>
                </View>

                <View className="flex-row mt-2">
                  <View className="flex-1">
                    <ModernButton
                      title={isDone ? "Concluído" : "Pendente"}
                      variant={isDone ? "soft" : "dark"}
                      onPress={() => {}}
                      disabled={!isDone}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

