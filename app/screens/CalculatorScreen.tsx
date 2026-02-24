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
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  FadeInDown, 
  withSequence, 
} from "react-native-reanimated"

import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { delay } from "@/utils/delay"
import { Icon } from "@/components/Icon"
import { colors } from "@/theme/colors"
import { ScreenHeader } from "@/components/ScreenHeader"

export const CalculatorScreen: FC<DemoTabScreenProps<"Calculator">> = ({ navigation }) => {
  const { themed, theme } = useAppTheme()

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

  // UX state
  const [isLoading, setIsLoading] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [focused, setFocused] = useState<"distance" | "price" | "eff" | null>(null)

  // Results state
  const [litersNeeded, setLitersNeeded] = useState<number | null>(null)
  const [tripCost, setTripCost] = useState<number | null>(null)

  // Validation Logic
  const isValidNumber = (str: string) => {
    const regex = /^\d*\.?\d*$/
    return str !== "" && regex.test(str) && !isNaN(parseFloat(str)) && parseFloat(str) > 0
  }

  const distanceError = hasSubmitted && !isValidNumber(distanceKm)
  const priceError = hasSubmitted && !isValidNumber(fuelPrice)
  const effError = hasSubmitted && !isValidNumber(kmPerLiter)

  const canCompute = isValidNumber(distanceKm) && isValidNumber(fuelPrice) && isValidNumber(kmPerLiter)

  // Animations
  const resultProgress = useSharedValue(0)
  const resultStyle = useAnimatedStyle(() => ({
    opacity: resultProgress.value,
    transform: [{ scale: 0.95 + resultProgress.value * 0.05 }],
  }))

  const onCompute = useCallback(async () => {
    setHasSubmitted(true)
    if (!canCompute) {
      return
    }

    setIsLoading(true)
    await delay(400)

    const d = parseFloat(distanceKm)
    const p = parseFloat(fuelPrice)
    const e = parseFloat(kmPerLiter)

    const liters = d / e
    const cost = liters * p

    setLitersNeeded(liters)
    setTripCost(cost)

    resultProgress.value = 0
    resultProgress.value = withTiming(1, { duration: 400 })
    setIsLoading(false)
  }, [canCompute, distanceKm, fuelPrice, kmPerLiter, resultProgress])

  const resetForm = useCallback(() => {
    setDistanceKm("")
    setFuelPrice("")
    setKmPerLiter("")
    setHasSubmitted(false)
    setLitersNeeded(null)
    setTripCost(null)
    resultProgress.value = 0
  }, [resultProgress])

  const formatNumber = (n: number | null) => {
    if (n === null) return "0.00"
    return new Intl.NumberFormat("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)
  }

  const formContent = useMemo(() => (
    <View style={themed($formInner)}>
      <View style={themed($fieldGroup)}>
        <Text preset="formLabel" style={themed($label)}>Trip Distance</Text>
        <View style={[
          themed($inputFrame), 
          focused === "distance" && themed($inputFrameFocused),
          distanceError && themed($inputError)
        ]}>
          <Icon 
            icon="map" 
            size={20} 
            color={distanceError ? theme.colors.error : (focused === "distance" ? theme.colors.tint : theme.colors.textDim)} 
          />
          <TextInput
            value={distanceKm}
            onChangeText={(v) => {
              setDistanceKm(v)
              if (hasSubmitted) setHasSubmitted(false)
            }}
            onFocus={() => setFocused("distance")}
            onBlur={() => setFocused(null)}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor={theme.colors.textDim}
            style={themed($input)}
          />
          <Text style={themed($suffix)}>km</Text>
        </View>
        {distanceError && <Text style={themed($errorText)}>Enter a valid distance</Text>}
      </View>

      {/* Fuel Price Input */}
      <View style={themed($fieldGroup)}>
        <Text preset="formLabel" style={themed($label)}>Fuel Price</Text>
        <View style={[
          themed($inputFrame), 
          focused === "price" && themed($inputFrameFocused),
          priceError && themed($inputError)
        ]}>
          <Text style={[themed($prefix), priceError && { color: theme.colors.error }]}>₱</Text>
          <TextInput
            value={fuelPrice}
            onChangeText={(v) => {
              setFuelPrice(v)
              if (hasSubmitted) setHasSubmitted(false)
            }}
            onFocus={() => setFocused("price")}
            onBlur={() => setFocused(null)}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor={theme.colors.textDim}
            style={themed($input)}
          />
          <Text style={themed($suffix)}>per L</Text>
        </View>
        {priceError && <Text style={themed($errorText)}>Enter a valid price</Text>}
      </View>

      {/* Efficiency Input */}
      <View style={themed($fieldGroup)}>
        <Text preset="formLabel" style={themed($label)}>Vehicle Fuel Efficiency</Text>
        <View style={[
          themed($inputFrame), 
          focused === "eff" && themed($inputFrameFocused),
          effError && themed($inputError)
        ]}>
          <Icon 
            icon="settings" 
            size={20} 
            color={effError ? theme.colors.error : (focused === "eff" ? theme.colors.tint : theme.colors.textDim)} 
          />
          <TextInput
            value={kmPerLiter}
            onChangeText={(v) => {
              setKmPerLiter(v)
              if (hasSubmitted) setHasSubmitted(false)
            }}
            onFocus={() => setFocused("eff")}
            onBlur={() => setFocused(null)}
            keyboardType="decimal-pad"
            placeholder="0.0"
            placeholderTextColor={theme.colors.textDim}
            style={themed($input)}
          />
          <Text style={themed($suffix)}>km/L</Text>
        </View>
        {effError && <Text style={themed($errorText)}>Enter a valid fuel efficiency</Text>}
      </View>

      <View style={themed($actions)}>
        <Button
          preset="filled"
          onPress={onCompute}
          style={themed($computeBtn)}
          pressedStyle={{ opacity: 0.9 }}
        >
          <Text style={{ color: "white", fontWeight: "bold" }}>
            {isLoading ? "Calculating..." : "Calculate Trip"}
          </Text>
        </Button>
        <Pressable onPress={resetForm} style={themed($resetBtn)}>
          <Text size="sm" style={{ color: theme.colors.textDim }}>Clear All</Text>
        </Pressable>
      </View>
    </View>
  ), [distanceKm, fuelPrice, kmPerLiter, focused, hasSubmitted, isLoading, themed, theme, distanceError, priceError, effError])

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screenContainer)}>
      <ScreenHeader 
        title="Trip cost calculator" 
        leftIcon="arrow_left" 
        onLeftPress={() => navigation.goBack()} 
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={manualRefresh} />}
      >
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: "padding", android: undefined })}
          style={themed($mainContainer)}
        >
          <Animated.View entering={FadeInDown.duration(400)}>
            <Card style={themed($card)} ContentComponent={formContent} />
          </Animated.View>

          {litersNeeded !== null && !isLoading && (
            <Animated.View style={[themed($resultsWrap), resultStyle]}>
              <View style={themed($resultsContent)}>
                <View style={themed($resultItem)}>
                  <Text style={themed($resultLabel)}>Total Fuel</Text>
                  <Text style={themed($resultValue)}>{formatNumber(litersNeeded)} L</Text>
                </View>
                <View style={themed($resultItem)}>
                  <Text style={themed($resultLabel)}>Estimated Cost</Text>
                  <Text style={[themed($resultValue), { color: theme.colors.tint }]}>₱ {formatNumber(tripCost)}</Text>
                </View>
                
                <View style={themed($disclaimerBox)}>
                  <Icon icon="information" size={14} color={theme.colors.textDim} />
                  <Text size="xxs" style={themed($disclaimerText)}>
                    Estimates assume constant speed and no traffic.
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}
        </KeyboardAvoidingView>
      </ScrollView>
    </Screen>
  )
}

// --- Styles ---

const $screenContainer: ViewStyle = { flex: 1, backgroundColor: "#F8F9FD" }
const $headerStyle: ViewStyle = { backgroundColor: "#1737ba", borderBottomLeftRadius: 20, borderBottomRightRadius: 20 }
const $headerTitle: TextStyle = { color: "#fff", fontWeight: "bold" }
const $leftActionWrapper: ViewStyle = { marginLeft: 16 }

const $mainContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.lg,
})

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.background,
  borderRadius: 24,
  padding: spacing.md,
  borderWidth: 0,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.05,
  shadowRadius: 20,
  elevation: 5,
})

const $formInner: ViewStyle = { padding: 4 }

const $fieldGroup: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.md,
})

const $label: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.xs,
  marginLeft: 4,
  fontSize: 13,
  opacity: 0.8,
  fontWeight: "600",
})

const $inputFrame: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#F1F3F9",
  borderRadius: 8,
  paddingHorizontal: spacing.md,
  height: 56,
  borderWidth: 1.5,
  borderColor: "transparent",
})

const $inputFrameFocused: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.tint,
  backgroundColor: colors.background,
})

const $inputError: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.error,
  backgroundColor: "#FFF5F5",
})

const $input: ThemedStyle<TextStyle> = ({ colors }) => ({
  flex: 1,
  fontSize: 16,
  fontWeight: "600",
  color: colors.text,
  paddingHorizontal: 12,
})

const $prefix: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 16,
  fontWeight: "bold",
  color: colors.textDim,
})

const $suffix: ThemedStyle<TextStyle> = ({ colors }) => ({
  fontSize: 12,
  fontWeight: "bold",
  color: colors.textDim,
  textTransform: "uppercase",
})

const $errorText: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.error,
  fontSize: 12,
  marginTop: 4,
  marginLeft: 4,
  fontWeight: "600",
})

const $actions: ViewStyle = {
  marginTop: 12,
  alignItems: "center",
}

const $computeBtn: ViewStyle = {
  width: "100%",
  height: 52,
  borderRadius: 8,
  backgroundColor: "#1737ba",
  borderWidth: 0,
}

const $resetBtn: ViewStyle = {
  paddingVertical: 16,
}

const $resultsWrap: ThemedStyle<ViewStyle> = ({ colors }) => ({
  marginTop: 24,
  backgroundColor: colors.background,
  borderRadius: 12,
  overflow: "hidden",
  shadowColor: "#000",
  shadowOpacity: 0.1,
  shadowRadius: 15,
  elevation: 6,
})

const $resultsHeader: ViewStyle = {
  backgroundColor: "#1737ba",
  paddingVertical: 12,
  alignItems: "center",
}

const $resultsContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.lg,
})

const $resultItem: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 12,
}

const $resultLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 15,
})

const $resultValue: TextStyle = {
  fontSize: 20,
  fontWeight: "900",
}

const $disclaimerBox: ViewStyle = {
  marginTop: 10,
  paddingTop: 16,
  borderTopWidth: 1,
  borderTopColor: "#EEE",
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
}

const $disclaimerText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  flex: 1,
})