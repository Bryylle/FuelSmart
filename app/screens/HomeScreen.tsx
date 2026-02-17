import React, { FC, ReactElement, useCallback, useMemo, useState, useEffect } from "react"
import {
  View,
  ScrollView,
  Pressable,
  Platform,
  ViewStyle,
  TextStyle,
  ColorValue,
  Linking,
  RefreshControl,
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

// Utility for smooth refresh experience
import { delay } from "@/utils/delay"

// Integrated Supabase import
import { supabase } from "@/services/supabase"

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
  const navigation = useNavigation<any>()

  // State Management
  const [forecast, setForecast] = useState<any>(null)
  const [isLoadingPrices, setIsLoadingPrices] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isLoadingNews] = useState<boolean>(false)
  const [hasErrorPrices, setHasErrorPrices] = useState<boolean>(false)
  const [hasErrorNews] = useState<boolean>(false)

  // Fetch logic for Fuel Forecast
  const fetchFuelForecast = useCallback(async () => {
    try {
      setHasErrorPrices(false)
      const { data, error } = await supabase
        .from("fuel_price_forecast")
        .select("*")
        .order("last_updated", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      
      setForecast(data) 
      if (!data) setHasErrorPrices(true)
    } catch (error) {
      console.error("Price fetch error:", error)
      setHasErrorPrices(true)
    } finally {
      setIsLoadingPrices(false)
    }
  }, [])

  const manualRefresh = async () => {
    setRefreshing(true)
    await Promise.allSettled([fetchFuelForecast(), delay(750)])
    setRefreshing(false)
  }

  useEffect(() => {
    fetchFuelForecast()
  }, [fetchFuelForecast])

  const forecastData = useMemo(() => {
    if (!forecast || hasErrorPrices) return []
    return [
      { 
        fuel: "gasoline" as const, 
        labelTx: "demoShowroomScreen:gasoline" as TxKeyPath,
        amount: forecast.gas_amount, 
        isIncrease: forecast.b_gas_increase 
      },
      { 
        fuel: "diesel" as const, 
        labelTx: "demoShowroomScreen:diesel" as TxKeyPath,
        amount: forecast.diesel_amount, 
        isIncrease: forecast.b_diesel_increase 
      },
      { 
        fuel: "kerosene" as const, 
        labelTx: "demoShowroomScreen:kerosene" as TxKeyPath,
        amount: forecast.kerosene_amount, 
        isIncrease: forecast.b_kerosene_increase 
      },
    ]
  }, [forecast, hasErrorPrices])

  const effectiveDateLabel = useMemo(() => {
    return forecast?.effective_date 
      ? new Date(forecast.effective_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
      : ""
  }, [forecast])

  const lastUpdatedLabel = useMemo(() => {
    return forecast?.last_updated 
      ? new Date(forecast.last_updated).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
      : ""
  }, [forecast])

  const onComputeTripPress = useCallback(() => {
    navigation.navigate("Calculator")
  }, [navigation])

  const onFindService = useCallback((labelTx: TxKeyPath) => {
    const query = translate(labelTx)
    const url = Platform.select({
      ios: `maps:0,0?q=${query}`,
      android: `geo:0,0?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    })
    if (url) Linking.openURL(url).catch((err) => console.error("Error opening maps", err))
  }, [])

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

  const Grid: FC<{ children: React.ReactNode }> = ({ children }) => (
    <View style={themed($grid)} accessibilityRole="list">{children}</View>
  )

  const ServiceTile: FC<ServiceItem> = ({ labelTx, icon }) => (
    <Pressable
      onPress={() => onFindService(labelTx)}
      style={({ pressed }) => [themed($serviceTile), pressed && { opacity: 0.85 }]}
      android_ripple={Platform.OS === "android" ? { color: colors.tint, borderless: false } : undefined}
    >
      <View style={themed($serviceIconWrap)}>
        <Icon icon={icon as any} size={22} color={colors.tint} />
      </View>
      <Text size="xs" numberOfLines={2} style={themed($serviceLabel)} tx={labelTx} />
    </Pressable>
  )

  const SectionCard: FC<{ children: React.ReactNode; testID?: string }> = ({ children, testID }) => (
    <View style={themed($card)} testID={testID}>{children}</View>
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
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={manualRefresh} tintColor={colors.palette.primary500} />
        }
      >
        {/* Services */}
        <SectionCard testID="services-card">
          <View style={themed($sectionHeader)}>
            <Text preset="subheading" tx="demoShowroomScreen:servicesTitle" />
          </View>
          <Grid>{services.map((s) => (<ServiceTile key={s.serviceKey} {...s} />))}</Grid>
        </SectionCard>

        {/* Forecast Card */}
        <SectionCard testID="forecast-card">
          <View style={[themed($sectionHeader), { marginBottom: 4 }]}>
            <Text preset="subheading" tx="demoShowroomScreen:forecastTitle" />
            {!isLoadingPrices && !hasErrorPrices && lastUpdatedLabel && (
              <Text size="xxs" style={themed($lastUpdatedText)} text={`Updated ${lastUpdatedLabel}`} />
            )}
          </View>
          
          {effectiveDateLabel && !isLoadingPrices && !hasErrorPrices && (
            <Text 
              size="xxs" 
              style={{ color: colors.textDim, marginBottom: 12 }} 
              text={`Effective by ${effectiveDateLabel}`} 
            />
          )}

          {isLoadingPrices ? (
            <View style={{ gap: 10 }}><LoadingSkeletonRow /><LoadingSkeletonRow /></View>
          ) : hasErrorPrices ? (
            <Text size="sm" style={themed($errorText)} tx="demoShowroomScreen:commonLoadError" />
          ) : (
            <>
              <View style={themed($priceDashboard)}>
                <View style={themed($priceGridContainer)}>
                  {forecastData.map((f, index) => (
                    <View key={f.fuel} style={themed($dataEntry)}>
                      <Text style={themed($dataLabel)} tx={f.labelTx} />
                      <Text 
                        style={[themed($dataValue), { color: f.isIncrease ? colors.error : colors.palette.accent500 }]}
                        text={`${f.isIncrease ? "+" : "-"}₱${Number(f.amount || 0).toFixed(2)}`}
                      />
                      {index < 2 && <View style={themed($verticalDivider)} />}
                    </View>
                  ))}
                </View>
              </View>

              {/* Styled Disclaimer Box */}
              <View style={themed($disclaimerBox)}>
                <Icon icon="information" size={14} color={colors.textDim} />
                <Text size="xxs" style={themed($disclaimerText)} tx="demoShowroomScreen:forecastDisclaimer" />
              </View>
            </>
          )}
        </SectionCard>

        {/* LTO News */}
        <SectionCard testID="lto-card">
          <View style={themed($sectionHeader)}>
            <Text preset="subheading" tx="demoShowroomScreen:ltoTitle" />
            <Pressable style={themed($headerLinkWrap)}>
              <Text size="xs" style={themed($headerLinkText)} tx="demoShowroomScreen:viewMore" />
            </Pressable>
          </View>
          <Text size="sm" style={themed($mutedText)} tx="demoShowroomScreen:ltoEmpty" />
        </SectionCard>

        {/* CTA Card */}
        <SectionCard testID="cta-card">
          <Text preset="subheading" style={themed($ctaTitle)} tx="demoShowroomScreen:planTripTitle" />
          <Text size="sm" style={themed($ctaSubtitle)} tx="demoShowroomScreen:planTripSubtitle" />
          
          <Button 
            onPress={onComputeTripPress} 
            style={themed($ctaButton)}
            RightAccessory={(props) => (
              <Icon icon="caretRight" size={18} color={colors.background} {...props} />
            )}
          >
            <Text 
              preset="bold" 
              style={themed($ctaButtonText)} 
              tx="demoShowroomScreen:planTripCta" 
            />
          </Button>
        </SectionCard>

        <View style={$spacerBottom} />
      </ScrollView>
    </Screen>
  )
}
const $ctaTitle: TextStyle = { 
  marginBottom: 4 
}

const $ctaSubtitle: ThemedStyle<TextStyle> = ({ colors }) => ({ 
  color: colors.textDim, 
  marginBottom: 16 // Increased margin for better spacing
})

const $ctaButton: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  marginTop: spacing.xs,
  backgroundColor: colors.palette.primary500, // Using primary brand color
  borderRadius: 16,
  borderWidth: 0,
  minHeight: 56, // Slightly taller for a more "tappable" feel
})

const $ctaButtonText: ThemedStyle<TextStyle> = ({ colors }) => ({ 
  color: colors.background,
  fontSize: 16,
})
const $container: ThemedStyle<ViewStyle> = () => ({ paddingTop: 0 })
const $content: ThemedStyle<ViewStyle> = ({ spacing }) => ({ padding: spacing.lg, gap: spacing.lg })

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.background,
  borderRadius: 20,
  padding: spacing.md,
  borderWidth: 1,
  borderColor: colors.border,
})

const $sectionHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: spacing.md,
})

const $priceDashboard: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: "#F2F2F7",
  borderRadius: 16,
  paddingVertical: 14,
  paddingHorizontal: 8,
  borderWidth: 1,
  borderColor: "#E5E5EA",
  marginVertical: 4,
})

const $priceGridContainer: ThemedStyle<ViewStyle> = () => ({ flexDirection: "row" })
const $dataEntry: ThemedStyle<ViewStyle> = () => ({ width: "33.33%", alignItems: "center" })
const $verticalDivider: ThemedStyle<ViewStyle> = () => ({ position: 'absolute', right: 0, height: '60%', width: 1, backgroundColor: "#D1D1D6" })
const $dataLabel: ThemedStyle<TextStyle> = () => ({ color: "#8E8E93", fontSize: 10, fontWeight: "600" })
const $dataValue: ThemedStyle<TextStyle> = () => ({ fontSize: 18, fontWeight: "700", marginTop: 2 })

// Disclaimer Styles
const $disclaimerBox: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: spacing.xs,
  marginTop: spacing.md,
})

const $disclaimerText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  flex: 1,
  lineHeight: 14,
})

const $lastUpdatedText: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim, fontSize: 10 })
const $headerLinkText: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.tint, textDecorationLine: "underline" })
const $headerLinkWrap: ViewStyle = { paddingHorizontal: 4 }
const $grid: ViewStyle = { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }
const $serviceTile: ViewStyle = { width: "33.3333%", paddingHorizontal: 4, marginBottom: 16, alignItems: "center" }
const $serviceIconWrap: ThemedStyle<ViewStyle> = ({ colors }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, marginBottom: 4 })
const $serviceLabel: TextStyle = { textAlign: "center" }
const $skeletonRow: ViewStyle = { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }
const $skeletonBlock: ThemedStyle<ViewStyle> = ({ colors }) => ({ height: 14, borderRadius: 4, backgroundColor: colors.border, width: "50%", opacity: 0.6 })
const $errorText: TextStyle = { textAlign: 'center' }
const $mutedText: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })
const $spacerBottom: ViewStyle = { height: 16 }