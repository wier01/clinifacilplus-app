import { Platform, ScrollView, View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Asset } from "expo-asset";

import { cn } from "@/lib/utils";

export interface ScreenContainerProps extends ViewProps {
  /**
   * SafeArea edges to apply. Defaults to ["top", "left", "right"].
   * Bottom is typically handled by Tab Bar.
   */
  edges?: Edge[];
  /**
   * Tailwind className for the content area.
   */
  className?: string;
  /**
   * Additional className for the outer container (background layer).
   */
  containerClassName?: string;
  /**
   * Additional className for the SafeAreaView (content layer).
   */
  safeAreaClassName?: string;
  /**
   * Render the premium background layer.
   */
  withBackground?: boolean;
  /**
   * Enable web scroll wrapper (ScrollView). Disable when a screen
   * already manages its own scrolling (e.g., FlatList).
   */
  webScroll?: boolean;
}

/**
 * A container component that properly handles SafeArea and background colors.
 *
 * The outer View extends to full screen (including status bar area) with the background color,
 * while the inner SafeAreaView ensures content is within safe bounds.
 *
 * Usage:
 * ```tsx
 * <ScreenContainer className="p-4">
 *   <Text className="text-2xl font-bold text-foreground">
 *     Welcome
 *   </Text>
 * </ScreenContainer>
 * ```
 */
export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  className,
  containerClassName,
  safeAreaClassName,
  withBackground = true,
  webScroll = true,
  style,
  ...props
}: ScreenContainerProps) {
  const backgroundUri = Asset.fromModule(require("../assets/backgrounds/signup-wave.svg")).uri;
  const isWeb = Platform.OS === "web";
  return (
    <View
      className={cn(
        "flex-1",
        "bg-[#F2F7FB]",
        containerClassName
      )}
      {...props}
    >
      {withBackground ? (
        <Image
          source={{ uri: backgroundUri }}
          style={{ position: "absolute", inset: 0, opacity: 0.85, zIndex: 0 }}
          contentFit="cover"
          pointerEvents="none"
        />
      ) : null}
      <SafeAreaView
        edges={edges}
        className={cn("flex-1", safeAreaClassName)}
        style={[{ zIndex: 1 }, style]}
      >
        {isWeb && webScroll ? (
          <ScrollView
            className={cn("flex-1", className)}
            contentContainerStyle={{ minHeight: "100%" }}
          >
            {children}
          </ScrollView>
        ) : (
          <View className={cn("flex-1", className)}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}
