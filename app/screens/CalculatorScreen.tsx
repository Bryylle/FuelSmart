import { FC, useCallback, useMemo, useState } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
  ViewStyle,
  TextStyle,
  ScrollView,
  RefreshControl,
} from "react-native"
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated"

import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import { $styles } from "@/theme/styles"
import type { ThemedStyle } from "@/theme/types"
import { delay } from "@/utils/delay"
import { Icon } from "@/components/Icon"
import { colors } from "@/theme/colors"
import { Header } from "@/components/Header"

export const CalculatorScreen: FC<DemoTabScreenProps<"Calculator">> = ({ navigation }) => {
  const { themed } = useAppTheme()

  const [refreshing, setRefreshing] = useState(false)
  const manualRefresh = async () => {
      setRefreshing(true)
      await Promise.allSettled([resetForm(), delay(750)])
      setRefreshing(false)
    }

  // Form state
  const [distanceKm, setDistanceKm] = useState<string>("")
  const [fuelPrice, setFuelPrice] = useState<string>("")
  const [kmPerLiter, setKmPerLiter] = useState<string>("")

  // UX
  const [isLoading, setIsLoading] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [focused, setFocused] = useState<"distance" | "price" | "eff" | null>(null)

  // Results
  const [litersNeeded, setLitersNeeded] = useState<number | null>(null)
  const [tripCost, setTripCost] = useState<number | null>(null)

  const parseNum = (v: string) => {
    const n = Number(String(v).replace(/,/g, ""))
    return Number.isFinite(n) ? n : NaN
  }

  const distanceNum = useMemo(() => parseNum(distanceKm), [distanceKm])
  const priceNum = useMemo(() => parseNum(fuelPrice), [fuelPrice])
  const effNum = useMemo(() => parseNum(kmPerLiter), [kmPerLiter])

  const distanceError =
    hasSubmitted && (isNaN(distanceNum) || distanceNum <= 0)
      ? "Enter a valid distance in kilometers."
      : ""
  const priceError =
    hasSubmitted && (isNaN(priceNum) || priceNum <= 0)
      ? "Enter a valid price per liter."
      : ""
  const effError =
    hasSubmitted && (isNaN(effNum) || effNum <= 0)
      ? "Enter a valid km-per-liter efficiency."
      : ""

  const canCompute =
    Number.isFinite(distanceNum) &&
    Number.isFinite(priceNum) &&
    Number.isFinite(effNum) &&
    distanceNum > 0 &&
    priceNum > 0 &&
    effNum > 0

  // Result animation
  const resultProgress = useSharedValue(0)
  const resultStyle = useAnimatedStyle(() => ({
    opacity: resultProgress.value,
    transform: [{ translateY: (1 - resultProgress.value) * 12 }],
  }))

  const onCompute = useCallback(async () => {
    setHasSubmitted(true)
    if (!canCompute) return

    setIsLoading(true)
    await delay(300)

    const liters = distanceNum / effNum
    const cost = liters * priceNum

    setLitersNeeded(liters)
    setTripCost(cost)

    resultProgress.value = 0
    resultProgress.value = withTiming(1, { duration: 220 })
    setIsLoading(false)
  }, [canCompute, distanceNum, effNum, priceNum, resultProgress])

  const resetForm = useCallback(() => {
    setDistanceKm("")
    setFuelPrice("")
    setKmPerLiter("")
    setHasSubmitted(false)
    setLitersNeeded(null)
    setTripCost(null)
    resultProgress.value = 0
  }, [resultProgress])

  const formatNumber = (n: number | null, fractionDigits = 2) => {
    if (n === null || !Number.isFinite(n)) return "—"
    try {
      return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(n)
    } catch {
      return n.toFixed(fractionDigits)
    }
  }

  const webInputReset: TextStyle =
    Platform.OS === "web"
      ? ({
          outlineStyle: "none",
          boxShadow: "none",
          appearance: "none",
          WebkitAppearance: "none",
          MozAppearance: "textfield",
        } as any)
      : ({} as any)

  // FIX: Memoizing this content prevents the "Focus Jumping" bug
  const formContent = useMemo(() => (
    <View>
      <View style={themed($fieldGroup)}>
        <Text style={themed($label)}>Trip Distance (km)</Text>
        <View style={[themed($inputFrame), focused === "distance" && themed($inputFrameFocused)]}>
          <TextInput
            value={distanceKm}
            onChangeText={setDistanceKm}
            onFocus={() => setFocused("distance")}
            onBlur={() => setFocused(null)}
            keyboardType="decimal-pad"
            placeholder="e.g., 90"
            placeholderTextColor="#9AA0A6"
            style={[themed($input), webInputReset]}
          />
        </View>
        {!!distanceError && <Text style={themed($error)}>{distanceError}</Text>}
      </View>

      <View style={themed($fieldGroup)}>
        <Text style={themed($label)}>Fuel Price (per liter)</Text>
        <View style={[themed($inputFrame), focused === "price" && themed($inputFrameFocused)]}>
          <Text style={themed($prefix)}>₱</Text>
          <TextInput
            value={fuelPrice}
            onChangeText={setFuelPrice}
            onFocus={() => setFocused("price")}
            onBlur={() => setFocused(null)}
            keyboardType="decimal-pad"
            placeholder="e.g., 56"
            placeholderTextColor="#9AA0A6"
            style={[themed($input), { flex: 1 }, webInputReset]}
          />
        </View>
        {!!priceError && <Text style={themed($error)}>{priceError}</Text>}
      </View>

      <View style={themed($fieldGroup)}>
        <Text style={themed($label)}>Vehicle Efficiency (km/L)</Text>
        <View style={[themed($inputFrame), focused === "eff" && themed($inputFrameFocused)]}>
          <TextInput
            value={kmPerLiter}
            onChangeText={setKmPerLiter}
            onFocus={() => setFocused("eff")}
            onBlur={() => setFocused(null)}
            keyboardType="decimal-pad"
            placeholder="e.g., 9"
            placeholderTextColor="#9AA0A6"
            style={[themed($input), webInputReset]}
          />
        </View>
        {!!effError && <Text style={themed($error)}>{effError}</Text>}
      </View>

      <View style={themed($actions)}>
        <Button
          preset="filled"
          disabled={!canCompute || isLoading}
          onPress={onCompute}
          style={themed($computeBtn)}
        >
          {isLoading ? "Computing…" : "Compute"}
        </Button>
        <Button onPress={resetForm} disabled={isLoading}>Reset</Button>
      </View>
    </View>
  ), [distanceKm, fuelPrice, kmPerLiter, focused, hasSubmitted, isLoading, themed])

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screenContainer)}>
      <Header
          title="Trip cost calculator"
          safeAreaEdges={["top"]} 
          LeftActionComponent={
            <View style={$leftActionWrapper}>
              <Pressable
                onPress={() => navigation.goBack()}
                accessibilityLabel="Go back"
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Icon icon="arrowLeft" size={24} color={"#fff"} />
              </Pressable>
            </View>
          }
          style={themed($headerStyle)}
          titleStyle={themed($headerTitle)}
        />
      <ScrollView
        contentContainerStyle={themed($content)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={manualRefresh} tintColor={colors.palette.primary500} />
        }
      >
        <View style={themed($titleWrap)}>
          <Text style={themed($tagline)}>Calculate the fuel needed and total cost for your trip.</Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.select({ ios: "padding", android: undefined })}
          style={themed($content)}
        >
          <Card
            style={themed($card)}
            ContentComponent={formContent}
          />

          {(litersNeeded !== null || tripCost !== null) && (
            <Animated.View style={[themed($resultsWrap), resultStyle]}>
              <Card
                style={themed($resultsCard)}
                ContentComponent={
                  <View>
                    <Text preset="subheading" style={themed($resultsTitle)}>Estimate</Text>
                    <View style={themed($resultRow)}>
                      <Text style={themed($resultLabel)}>Fuel needed</Text>
                      <Text style={themed($resultValue)}>{formatNumber(litersNeeded, 2)} L</Text>
                    </View>
                    <View style={themed($divider)} />
                    <View style={themed($resultRow)}>
                      <Text style={themed($resultLabel)}>Trip cost</Text>
                      <Text style={themed($resultValue)}>₱ {formatNumber(tripCost, 2)}</Text>
                    </View>
                    <Text style={themed($note)}>
                      
                    </Text>
                    {/* Styled Disclaimer Box */}
                    <View style={themed($disclaimerBox)}>
                      <Icon icon="information" size={14} color={colors.textDim} />
                      <Text size="xxs" style={themed($disclaimerText)}>Estimates assume constant speed and no traffic or load variations.</Text>
                    </View>
                  </View>
                }
              />
            </Animated.View>
          )}
        </KeyboardAvoidingView>
      </ScrollView>
    </Screen>
  )
}
const $disclaimerBox: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: spacing.xs,
})

const $disclaimerText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  flex: 1,
  lineHeight: 14,
})
const $screenContainer: ThemedStyle<ViewStyle> = () => ({ flex: 1 })
const $headerStyle: ThemedStyle<ViewStyle> = () => ({
  backgroundColor: "#1737ba",
})

const $headerTitle: ThemedStyle<TextStyle> = () => ({
  color: "#fff",
})

const $leftActionWrapper: ViewStyle = {
  justifyContent: "center",
  alignItems: "center",
  marginLeft: 16,
}
const $input: ThemedStyle<TextStyle> = ({ colors }) => ({
  flex: 1,
  color: colors.text,
  fontSize: 16,
  backgroundColor: "transparent",
  paddingVertical: Platform.select({ ios: 12, android: 10 }),
  paddingHorizontal: 0,
  includeFontPadding: false,
  borderWidth: 0,
})

const $titleWrap: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.lg,
  marginBottom: spacing.xs,
})

const $tagline: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  paddingHorizontal: spacing.xxxs,
  marginTop: spacing.md,
  marginBottom: spacing.xs,
})

const $content: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  paddingHorizontal: spacing.lg,
})

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.background,
  borderRadius: spacing.md,
  marginBottom: spacing.lg,
  padding: spacing.lg,
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
})

const $fieldGroup: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.md,
})

const $label: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontWeight: "700",
  letterSpacing: 0.2,
  marginBottom: 6,
})

const $inputFrame: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  minHeight: 48,
  borderWidth: 1.25,
  borderColor: colors.separator,
  backgroundColor: colors.background,
  borderRadius: 8,
  paddingHorizontal: spacing.md,
  flexDirection: "row",
  alignItems: "center",
})

const $inputFrameFocused: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.tint,
})

const $prefix: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  marginRight: spacing.xs,
  fontWeight: "600",
})

const $error: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  marginTop: spacing.xs,
  color: colors.error,
  fontSize: 13,
})

const $actions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.md,
  marginTop: spacing.sm,
})

const $computeBtn: ThemedStyle<ViewStyle> = ({}) => ({
  flex: 1,
})

const $resultsWrap: ThemedStyle<ViewStyle> = ({}) => ({})

const $resultsCard: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.background,
  borderRadius: spacing.md,
  padding: spacing.lg,
  shadowColor: "#000",
  shadowOpacity: 0.06,
  shadowRadius: 8,
  elevation: 2,
})

const $resultsTitle: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.md,
})

const $resultRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginVertical: spacing.xs,
})

const $resultLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $resultValue: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontWeight: "800",
  fontSize: 18,
})

const $divider: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  height: 1,
  backgroundColor: colors.separator,
  marginVertical: spacing.sm,
})

const $note: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  fontSize: 12,
  marginTop: spacing.md,
})