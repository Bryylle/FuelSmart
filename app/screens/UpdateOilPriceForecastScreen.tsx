import React, { FC, useCallback, useEffect, useMemo, useState } from "react"
import {
  Pressable,
  View,
  ViewStyle,
  TextStyle,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from "react-native"
import DateTimePickerModal from "react-native-modal-datetime-picker"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { Icon } from "@/components/Icon"
import { Header } from "@/components/Header"
import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import { supabase } from "@/services/supabase"
import { spacing } from "@/theme/spacing"
import { Switch } from "@/components/Toggle/Switch"
import type { ThemedStyle } from "@/theme/types"

const ALLOWED_CHARS = /[^0-9.\s-]/g
const SINGLE_OR_RANGE_UP_TO_2DP = /^(\d+(\.\d{0,2})?)?(\s*-\s*(\d+(\.\d{0,2})?)?)?$/

type FuelKey = "gas" | "diesel" | "kerosene"

type FormState = {
  amounts: Record<FuelKey, string>
  increases: Record<FuelKey, boolean>
  effectiveDate: string
  effectiveDateObj: Date | null
}

const fuelFields: { key: FuelKey; label: string }[] = [
  { key: "gas", label: "Gasoline Amount" },
  { key: "diesel", label: "Diesel Amount" },
  { key: "kerosene", label: "Kerosene Amount" },
]

// Memoized Input Field (keeping your component idea)
const InputField = React.memo(
  ({ label, value, onChangeText, isIncrease, onToggle, colors, themedStyles }: any) => {
    const normalizeOnBlur = () => {
      if (!value) return
      const normalized = value
        .trim()
        .replace(/\s*-\s*/g, " - ")
        .replace(/\s+/g, " ")
      onChangeText(normalized)
    }

    return (
      <View style={themedStyles.$inputWrapper}>
        <View style={$rowJustify}>
          <Text preset="formLabel" text={label} size="md" />
          <View style={$rowAlignCenter}>
            <Text
              size="sm"
              text={isIncrease ? "Increase" : "Decrease"}
              style={{
                marginRight: 8,
                color: isIncrease ? colors.error : colors.palette.accent500,
              }}
            />
            <Switch value={isIncrease} onValueChange={onToggle} />
          </View>
        </View>

        <TextInput
          style={themedStyles.$input}
          value={value}
          placeholder="0.00"
          placeholderTextColor={colors.textDim}
          onBlur={normalizeOnBlur}
          onChangeText={(text) => {
            const cleaned = text.replace(ALLOWED_CHARS, "")
            if (SINGLE_OR_RANGE_UP_TO_2DP.test(cleaned)) onChangeText(cleaned)
          }}
        />
      </View>
    )
  },
)

export const UpdateOilPriceForecastScreen: FC<DemoTabScreenProps<"UpdateOilPriceForecast">> = ({ navigation }) => {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()

  const [recordId, setRecordId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)

  const [form, setForm] = useState<FormState>({
    amounts: { gas: "", diesel: "", kerosene: "" },
    increases: { gas: true, diesel: true, kerosene: true },
    effectiveDate: "",
    effectiveDateObj: null,
  })

  const themedStyles = useMemo(
    () => ({
      $inputWrapper: themed($inputWrapperStyle),
      $input: themed($inputStyle),
      $saveButton: themed($saveButtonStyle),
    }),
    [themed],
  )

  const toYYYYMMDD = (d: Date) => {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
  }

  const fromYYYYMMDD = (s: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
    if (!m) return null
    const [, y, mo, d] = m
    const dt = new Date(Number(y), Number(mo) - 1, Number(d))
    return isNaN(dt.getTime()) ? null : dt
  }

  const setAmount = useCallback((k: FuelKey, v: string) => {
    setForm((p) => ({ ...p, amounts: { ...p.amounts, [k]: v } }))
  }, [])

  const setIncrease = useCallback((k: FuelKey, v: boolean) => {
    setForm((p) => ({ ...p, increases: { ...p.increases, [k]: v } }))
  }, [])

  const fetchCurrentForecast = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true)

      const { data, error } = await supabase
        .from("fuel_price_forecast")
        .select("*")
        .order("last_updated", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      if (!data) return

      setRecordId(data.id)

      const fetchedEffective = data.effective_date ?? ""
      const parsedDate = fetchedEffective ? fromYYYYMMDD(fetchedEffective) : null

      setForm({
        amounts: {
          gas: String(data.gas_amount ?? ""),
          diesel: String(data.diesel_amount ?? ""),
          kerosene: String(data.kerosene_amount ?? ""),
        },
        increases: {
          gas: !!data.b_gas_increase,
          diesel: !!data.b_diesel_increase,
          kerosene: !!data.b_kerosene_increase,
        },
        effectiveDate: fetchedEffective,          // ✅ FIX: populate input
        effectiveDateObj: parsedDate,
      })
    } catch (e) {
      Alert.alert("Error", "Could not load existing data")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchCurrentForecast(false)
  }, [fetchCurrentForecast])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchCurrentForecast(true)
  }, [fetchCurrentForecast])

  const handleSubmitForecast = async () => {
    if (!recordId) return

    const { amounts, increases, effectiveDate } = form
    if (!effectiveDate || !amounts.gas || !amounts.diesel || !amounts.kerosene) {
      Alert.alert("Something is missing", "Please complete all fields.")
      return
    }

    setUpdating(true)
    const { error } = await supabase
      .from("fuel_price_forecast")
      .update({
        gas_amount: amounts.gas,
        b_gas_increase: increases.gas,
        diesel_amount: amounts.diesel,
        b_diesel_increase: increases.diesel,
        kerosene_amount: amounts.kerosene,
        b_kerosene_increase: increases.kerosene,
        effective_date: effectiveDate,
      })
      .eq("id", recordId)

    setUpdating(false)

    if (error) Alert.alert("Failed", error.message)
    else Alert.alert("Success", "Price forecast updated!", [{ text: "OK" }])
  }

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screenContainer)}>
      <Header
        title="Update Oil Price Forecast"
        safeAreaEdges={["top"]}
        LeftActionComponent={
          <View style={$headerLeftActionWrapper}>
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Icon icon="arrow_left" size={24} color={"#fff"} />
            </Pressable>
          </View>
        }
        style={themed($headerStyle)}
        titleStyle={themed($headerTitle)}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {loading && !refreshing ? (
          <ActivityIndicator style={{ flex: 1 }} color={colors.palette.primary500} />
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: spacing.lg }}
            keyboardShouldPersistTaps="handled"
            removeClippedSubviews
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.palette.primary500]}
                tintColor={colors.palette.primary500}
              />
            }
          >
            <Text preset="subheading" text="Fuel Adjustment Details" style={{ marginBottom: spacing.md }} />

            {fuelFields.map(({ key, label }) => (
              <InputField
                key={key}
                label={label}
                value={form.amounts[key]}
                onChangeText={(v: string) => setAmount(key, v)}
                isIncrease={form.increases[key]}
                onToggle={(v: boolean) => setIncrease(key, v)}
                colors={colors}
                themedStyles={themedStyles}
              />
            ))}

            <View style={themedStyles.$inputWrapper}>
              <Text preset="formLabel" text="Effective Date" />
              <Pressable onPress={() => setShowDatePicker(true)}>
                <View pointerEvents="none">
                  <TextInput
                    style={themedStyles.$input}
                    value={form.effectiveDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textDim}
                    editable={false}
                  />
                </View>
              </Pressable>

              <DateTimePickerModal
                isVisible={showDatePicker}
                mode="date"
                date={form.effectiveDateObj ?? new Date()}
                onConfirm={(date) => {
                  setForm((p) => ({
                    ...p,
                    effectiveDateObj: date,
                    effectiveDate: toYYYYMMDD(date),
                  }))
                  setShowDatePicker(false)
                }}
                onCancel={() => setShowDatePicker(false)}
              />
            </View>

            <Button
              preset="filled"
              onPress={handleSubmitForecast}
              style={themedStyles.$saveButton}
              disabled={updating}
              RightAccessory={() => (updating ? <ActivityIndicator color="#fff" /> : null)}
            >
              <Text
                text={updating ? "Saving..." : "Save Changes"}
                size="md"
                style={{ color: "#fff" }}
                preset="bold"
              />
            </Button>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Screen>
  )
}

// #region STYLES
const $screenContainer: ThemedStyle<ViewStyle> = () => ({ flex: 1 })
const $headerStyle: ThemedStyle<ViewStyle> = () => ({ backgroundColor: "#1737ba" })
const $headerTitle: ThemedStyle<TextStyle> = () => ({ color: "#fff" })
const $headerLeftActionWrapper: ViewStyle = { justifyContent: "center", alignItems: "center", marginLeft: 16 }
const $rowJustify: ViewStyle = { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }
const $rowAlignCenter: ViewStyle = { flexDirection: "row", alignItems: "center" }
const $inputWrapperStyle: ThemedStyle<ViewStyle> = ({ spacing }) => ({ marginBottom: spacing.md })
const $inputStyle: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.neutral100,
  borderRadius: 12,
  padding: spacing.md,
  color: colors.text,
  fontSize: 16,
  borderWidth: 1,
  borderColor: colors.border,
})
const $saveButtonStyle: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.primary500,
  marginTop: spacing.md,
  borderRadius: 16,
  height: 56,
  borderWidth: 0,
})