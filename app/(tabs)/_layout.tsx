import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Platform } from "react-native";
import { useColors } from "@/hooks/use-colors";
import { useQuery } from "@tanstack/react-query";
import { apiCall } from "@/lib/_core/api";

export default function TabLayout() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const bottomPadding = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomPadding;

  const featuresQ = useQuery({
    queryKey: ["features"],
    queryFn: async () => {
      const data = await apiCall<any>("/features");
      return data?.features ?? null;
    },
    staleTime: 60_000,
  });

  const features = (featuresQ.data ?? null) as string[] | null;
  const has = (code: string) => !features || features.includes(code);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          paddingTop: 8,
          paddingBottom: bottomPadding,
          height: tabBarHeight,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      {has("INBOX") ? (
        <Tabs.Screen
          name="inbox"
          options={{
            title: "Inbox",
            tabBarLabel: "Inbox",
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="message.fill" color={color} />,
          }}
        />
      ) : null}
      {has("AGENDA") ? (
        <Tabs.Screen
          name="agenda"
          options={{
            title: "Agenda",
            tabBarLabel: "Agenda",
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar.fill" color={color} />,
          }}
        />
      ) : null}
      {has("PRONTUARIO") ? (
        <Tabs.Screen
          name="prontuarios"
          options={{
            title: "Prontuários",
            tabBarLabel: "Prontuários",
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="doc.text.fill" color={color} />,
          }}
        />
      ) : null}
      <Tabs.Screen
        name="more"
        options={{
          title: "Mais",
          tabBarLabel: "Mais",
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="ellipsis.circle.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}
