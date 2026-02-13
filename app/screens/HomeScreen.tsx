import React, { FC, ReactElement, useCallback, useMemo, useState } from "react"
import {
  View,
  ScrollView,
  Pressable,
  Platform,
  ViewStyle,
  TextStyle,
  ColorValue,
} from "react-native"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { Icon } from "@/components/Icon"

import { useAppTheme } from "@/theme/context"
import { $styles } from "@/theme/styles"
import type { ThemedStyle } from "@/theme/types"

import { isRTL, TxKeyPath } from "@/i18n"
import { translate } from "@/i18n/translate"

import type { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useNavigation } from "@react-navigation/native"
/**
 * DemoShowroomScreen (Refactored for international app)
 * - Clean architecture: CTA → Forecast → News → Services
 * - Accessible, RTL-aware, i18n-friendly, themed
 * - Removed unused code from the old showroom/drawer logic
 */

type ServiceItem = {
  serviceKey: string
  labelTx: TxKeyPath
  icon: string
}

export const HomeScreen: FC<DemoTabScreenProps<"Home">> = function HomeScreen(
  _props,
) {
  const { themed, theme } = useAppTheme()
  const { colors } = theme
  // 👇 Add this line
  const navigation = useNavigation<any>()

  // Local UI state (replace with real data bindings later)
  const [isLoadingPrices] = useState<boolean>(false)
  const [isLoadingNews] = useState<boolean>(false)
  const [hasErrorPrices] = useState<boolean>(false)
  const [hasErrorNews] = useState<boolean>(false)

  // Example forecast deltas (replace with fetched values)
  const forecastData = !hasErrorPrices
    ? [
        { fuel: "gasoline" as const, delta: 0.5 },
        { fuel: "diesel" as const, delta: 0.3 },
        { fuel: "kerosene" as const, delta: 0.2 },
      ]
    : []

  // Example news payload (replace with fetched content)
  const ltoNewsHeadline = ""

  // Handlers (wire to navigation/services)
  const onComputeTripPress = useCallback(() => {
    navigation.navigate("Calculator") // Example
  }, [navigation])

  const onOpenForecastLink = useCallback(() => {
    // Linking.openURL("https://example.com/forecast")
  }, [])

  const onOpenNews = useCallback(() => {
    // Linking.openURL("https://www.facebook.com/ltoph")
  }, [])

  const onFindService = useCallback((serviceKey: string) => {
    // navigation.navigate("Nearby", { category: serviceKey })
  }, [])

  // Services grid (renamed key -> serviceKey to avoid collisions with React's `key`)
  const services: ServiceItem[] = useMemo(
    () => [
      { serviceKey: "parking", labelTx: "demoShowroomScreen:servicesParking", icon: "parking" },
      { serviceKey: "carWash", labelTx: "demoShowroomScreen:servicesCarWash", icon: "carWash" },
      { serviceKey: "vulcanizing", labelTx: "demoShowroomScreen:servicesVulcanizing", icon: "tireRepair" },
      { serviceKey: "towing", labelTx: "demoShowroomScreen:servicesTowing", icon: "towing" },
      { serviceKey: "servicing", labelTx: "demoShowroomScreen:servicesServicing", icon: "carRepair" },
    ],
    [],
  )

  const formatDelta = (d: number) => `${d >= 0 ? "+" : ""}${d.toFixed(2)} / L`

  // UI helpers
  const Grid: FC<{ children: React.ReactNode }> = ({ children }) => (
    <View style={themed($grid)} accessibilityRole="list">
      {children}
    </View>
  )

  type ServiceTileProps = {
    serviceKey: string
    labelTx: TxKeyPath
    icon: string
  }

  const ServiceTile: FC<ServiceTileProps> = ({ serviceKey, labelTx, icon }) => (
    <Pressable
      onPress={() => onFindService(serviceKey)}
      style={({ pressed }) => [themed($serviceTile), pressed && { opacity: 0.85 }]}
      android_ripple={
        Platform.OS === "android"
          ? { color: (colors.tint as ColorValue) ?? "#999", borderless: false }
          : undefined
      }
      accessibilityRole="button"
      accessibilityLabel={translate(labelTx)}
      accessibilityHint={translate("demoShowroomScreen:commonOpens")}
      testID={`service-${serviceKey}`}
      hitSlop={8}
    >
      <View style={themed($serviceIconWrap)}>
        <Icon icon={icon as any} size={22} color={colors.tint} />
      </View>
      <Text size="xs" numberOfLines={2} style={themed($serviceLabel)} tx={labelTx} />
    </Pressable>
  )

  const Pill: FC<{ label: string; icon?: string }> = ({ label, icon }) => (
    <View style={themed($pill)}>
      {icon ? <Icon icon={icon as any} size={12} color={colors.tint} /> : null}
      <Text size="xs" style={themed($pillText)} text={label} />
    </View>
  )

  const InfoRow: FC<{ labelTx: TxKeyPath; value: string | ReactElement }> = ({
    labelTx,
    value,
  }) => (
    <View
      style={[themed($row), isRTL ? { flexDirection: "row-reverse" } : null]}
      accessibilityRole="text"
    >
      <Text size="sm" style={themed($rowLabel)} tx={labelTx} />
      {typeof value === "string" ? (
        <Text size="sm" style={themed($rowValue)} text={value} />
      ) : (
        value
      )}
    </View>
  )

  const SectionHeader: FC<{ titleTx: TxKeyPath; onPressLink?: () => void; linkTx?: TxKeyPath }> = ({
    titleTx,
    onPressLink,
    linkTx,
  }) => (
    <View
      style={[themed($sectionHeader), isRTL ? { flexDirection: "row-reverse" } : null]}
      accessibilityRole="header"
    >
      <Text preset="subheading" tx={titleTx} />
      {onPressLink && linkTx ? (
        <Pressable
          onPress={onPressLink}
          accessibilityRole="link"
          accessibilityLabel={translate(linkTx)}
          hitSlop={8}
          style={themed($headerLinkWrap)}
        >
          <Text size="xs" style={themed($headerLinkText)} tx={linkTx} />
        </Pressable>
      ) : null}
    </View>
  )

  const SectionCard: FC<{ children: React.ReactNode; testID?: string }> = ({ children, testID }) => (
    <View style={themed($card)} testID={testID}>
      {children}
    </View>
  )

  const LoadingSkeletonRow: FC = () => (
    <View style={themed($skeletonRow)}>
      <View style={themed($skeletonBlock)} />
      <View style={[themed($skeletonBlock), { width: "35%" }]} />
    </View>
  )

  return (
    <Screen preset="scroll" safeAreaEdges={["top"]} contentContainerStyle={[$styles.flex1, themed($container)]}>
      <ScrollView
        contentContainerStyle={themed($content)}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Nearby Services */}
        <SectionCard testID="services-card">
          <SectionHeader titleTx="demoShowroomScreen:servicesTitle" />
          <Grid>
            {services.map((s) => (
              <ServiceTile key={s.serviceKey} {...s} />
            ))}
          </Grid>
        </SectionCard>

        {/* Oil Price Forecast */}
        <SectionCard testID="forecast-card">
          <SectionHeader
            titleTx="demoShowroomScreen:forecastTitle"
            onPressLink={onOpenForecastLink}
            linkTx="demoShowroomScreen:sourceLink"
          />
          {isLoadingPrices ? (
            <>
              <LoadingSkeletonRow />
              <LoadingSkeletonRow />
              <LoadingSkeletonRow />
            </>
          ) : hasErrorPrices ? (
            <View accessible accessibilityRole="text">
              <Text size="sm" style={themed($errorText)} tx="demoShowroomScreen:commonLoadError" />
            </View>
          ) : (
            <>
              {forecastData.map((f) => (
                <InfoRow
                  key={f.fuel}
                  labelTx={
                    f.fuel === "gasoline"
                      ? "demoShowroomScreen:gasoline"
                      : f.fuel === "diesel"
                      ? "demoShowroomScreen:diesel"
                      : "demoShowroomScreen:kerosene"
                  }
                  value={<Pill icon={f.delta >= 0 ? "trendingUp" : "trendingDown"} label={formatDelta(f.delta)} />}
                />
              ))}
              <Text size="xs" style={themed($disclaimer)} tx="demoShowroomScreen:forecastDisclaimer" />
            </>
          )}
        </SectionCard>

        {/* LTO News */}
        <SectionCard testID="lto-card">
          <SectionHeader titleTx="demoShowroomScreen:ltoTitle" onPressLink={onOpenNews} linkTx="demoShowroomScreen:viewMore" />
          {isLoadingNews ? (
            <>
              <LoadingSkeletonRow />
              <LoadingSkeletonRow />
            </>
          ) : hasErrorNews ? (
            <View accessible accessibilityRole="text">
              <Text size="sm" style={themed($errorText)} tx="demoShowroomScreen:commonLoadError" />
            </View>
          ) : ltoNewsHeadline ? (
            <Text size="sm" text={ltoNewsHeadline} />
          ) : (
            <Text size="sm" style={themed($mutedText)} tx="demoShowroomScreen:ltoEmpty" />
          )}
        </SectionCard>

        {/* CTA */}
        <SectionCard testID="cta-card">
          <Text preset="subheading" style={themed($ctaTitle)} tx="demoShowroomScreen:planTripTitle" />
          <Text size="sm" style={themed($ctaSubtitle)} tx="demoShowroomScreen:planTripSubtitle" />
          <Button onPress={onComputeTripPress} style={themed($ctaButton)}>
            <Text preset="bold" style={{ color: colors.background }} tx="demoShowroomScreen:planTripCta" />
          </Button>
        </SectionCard>

        <View style={$spacerBottom} />
      </ScrollView>
    </Screen>
  )
}

/**
 * Styles
 */
const $container: ThemedStyle<ViewStyle> = () => ({
  paddingTop: 0,
})

const $content: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.lg,
  gap: spacing.lg,
})

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.background,
  borderRadius: 12,
  padding: spacing.lg,
  borderWidth: 1,
  borderColor: colors.border,
  ...Platform.select({
    ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8 },
    android: { elevation: 2 },
    default: {},
  }),
})

const $sectionHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: spacing.md,
})

const $headerLinkWrap: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.xs,
  paddingVertical: spacing.xxs,
})

const $headerLinkText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
  textDecorationLine: "underline",
})

const $row: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: spacing.xs,
})

const $rowLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $rowValue: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

const $pill: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  borderWidth: 1,
  borderColor: colors.tint,
  paddingHorizontal: spacing.sm,
  paddingVertical: 4,
  borderRadius: 999,
  backgroundColor: "transparent",
})

const $pillText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
})

const $disclaimer: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  marginTop: spacing.sm,
})

const $ctaTitle: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.xs,
})

const $ctaSubtitle: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  marginBottom: spacing.sm,
})

const $ctaButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.sm,
})

const $grid: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  marginHorizontal: -spacing.xs,
})

const $serviceTile: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  width: "33.3333%",
  paddingHorizontal: spacing.xs,
  marginBottom: spacing.md,
  alignItems: "center",
})

const $serviceIconWrap: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: "center",
  justifyContent: "center",
  borderWidth: 1,
  borderColor: colors.border,
  marginBottom: spacing.xs,
})

const $serviceLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  textAlign: "center",
  color: colors.text,
})

const $skeletonRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  gap: spacing.md,
  paddingVertical: spacing.xs,
})

const $skeletonBlock: ThemedStyle<ViewStyle> = ({ colors }) => ({
  height: 14,
  borderRadius: 4,
  backgroundColor: colors.border,
  width: "50%",
  opacity: 0.6,
})

const $errorText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

const $mutedText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $spacerBottom: ViewStyle = { height: 16 }