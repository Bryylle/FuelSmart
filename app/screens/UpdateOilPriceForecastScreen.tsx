import React, { FC, useEffect, useState, useCallback, memo } from "react"
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
  RefreshControl, // Added RefreshControl import
} from "react-native"
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

// Memoized Input Field to prevent unnecessary re-renders when other fields change
const InputField = memo(({ label, value, onChangeText, isIncrease, onToggle, colors, themedStyles }: any) => {
  return (
    <View style={themedStyles.$inputWrapper}>
      <View style={$rowJustify}>
        <Text preset="formLabel" text={label} />
        <View style={$rowAlignCenter}>
          <Text 
            size="xs" 
            text={isIncrease ? "Increase" : "Decrease"} 
            style={{ marginRight: 8, color: isIncrease ? colors.error : colors.palette.accent500 }} 
          />
          <Switch value={isIncrease} onValueChange={onToggle} />
        </View>
      </View>
      <TextInput
        style={themedStyles.$input}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        placeholder="0.00"
        placeholderTextColor={colors.textDim}
        autoCorrect={false}
        spellCheck={false}
      />
    </View>
  )
})

export const UpdateOilPriceForecastScreen: FC<DemoTabScreenProps<"UpdateOilPriceForecast">> = ({ navigation }) => {
  const { themed, theme: { colors } } = useAppTheme()
  
  // State Management
  const [recordId, setRecordId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false) // Added refreshing state
  const [updating, setUpdating] = useState(false)
  
  const [gasAmount, setGasAmount] = useState("")
  const [isGasIncrease, setIsGasIncrease] = useState(true)
  const [dieselAmount, setDieselAmount] = useState("")
  const [isDieselIncrease, setIsDieselIncrease] = useState(true)
  const [keroseneAmount, setKeroseneAmount] = useState("")
  const [isKeroseneIncrease, setIsKeroseneIncrease] = useState(true)
  const [effectiveDate, setEffectiveDate] = useState("")

  const themedStyles = {
    $inputWrapper: themed($inputWrapperStyle),
    $input: themed($inputStyle),
    $saveButton: themed($saveButtonStyle),
  }

  const fetchCurrentForecast = useCallback(async () => {
    try {
      // Don't show the large activity indicator if we are just refreshing
      if (!refreshing) setLoading(true) 
      
      const { data, error } = await supabase
        .from("fuel_price_forecast")
        .select("*")
        .order("last_updated", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      if (data) {
        setRecordId(data.id)
        setGasAmount(String(data.gas_amount))
        setIsGasIncrease(data.b_gas_increase)
        setDieselAmount(String(data.diesel_amount))
        setIsDieselIncrease(data.b_diesel_increase)
        setKeroseneAmount(String(data.kerosene_amount))
        setIsKeroseneIncrease(data.b_kerosene_increase)
        setEffectiveDate(data.effective_date || "")
      }
    } catch (e) {
      Alert.alert("Error", "Could not load existing data")
    } finally {
      setLoading(false)
      setRefreshing(false) // Stop the refresh animation
    }
  }, [refreshing])

  // pull-to-refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true)
    fetchCurrentForecast()
  }, [fetchCurrentForecast])

  useEffect(() => { fetchCurrentForecast() }, [])

  const handleUpdate = async () => {
    if (!recordId) return
    setUpdating(true)
    const { error } = await supabase
      .from("fuel_price_forecast")
      .update({
        gas_amount: parseFloat(gasAmount),
        b_gas_increase: isGasIncrease,
        diesel_amount: parseFloat(dieselAmount),
        b_diesel_increase: isDieselIncrease,
        kerosene_amount: parseFloat(keroseneAmount),
        b_kerosene_increase: isKeroseneIncrease,
        effective_date: effectiveDate,
        last_updated: new Date().toISOString(),
      })
      .eq("id", recordId)

    setUpdating(false)
    if (error) {
      Alert.alert("Failed", error.message)
    } else {
      Alert.alert("Success", "Price forecast updated!", [{ text: "OK", onPress: () => navigation.goBack() }])
    }
  }

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screenContainer)}>
      <Header
        title="Update Oil Price Forecast"
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
            removeClippedSubviews={true}
            // Added RefreshControl
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh} 
                colors={[colors.palette.primary500]} // Android color
                tintColor={colors.palette.primary500} // iOS color
              />
            }
          >
            <Text preset="subheading" text="Fuel Adjustment Details" style={{ marginBottom: spacing.md }} />
            
            <InputField 
              label="Gasoline Amount" 
              value={gasAmount} 
              onChangeText={setGasAmount} 
              isIncrease={isGasIncrease} 
              onToggle={setIsGasIncrease} 
              colors={colors}
              themedStyles={themedStyles}
            />
            
            <InputField 
              label="Diesel Amount" 
              value={dieselAmount} 
              onChangeText={setDieselAmount} 
              isIncrease={isDieselIncrease} 
              onToggle={setIsDieselIncrease} 
              colors={colors}
              themedStyles={themedStyles}
            />
            
            <InputField 
              label="Kerosene Amount" 
              value={keroseneAmount} 
              onChangeText={setKeroseneAmount} 
              isIncrease={isKeroseneIncrease} 
              onToggle={setIsKeroseneIncrease} 
              colors={colors}
              themedStyles={themedStyles}
            />

            <View style={themedStyles.$inputWrapper}>
              <Text preset="formLabel" text="Effective Date (e.g., Feb 18)" />
              <TextInput
                style={themedStyles.$input}
                value={effectiveDate}
                onChangeText={setEffectiveDate}
                placeholder="Ex: Feb 18"
                placeholderTextColor={colors.textDim}
              />
            </View>

            <Button
              preset="filled"
              onPress={handleUpdate}
              style={themedStyles.$saveButton}
              disabled={updating}
              RightAccessory={(props) => updating ? <ActivityIndicator color="#fff" /> : <Icon icon="caretRight" color="#fff" {...props} />}
            >
              <Text text={updating ? "Saving..." : "Save Changes"} style={{ color: "#fff" }} preset="bold" />
            </Button>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Screen>
  )
}

// Static Styles remain unchanged
const $screenContainer: ThemedStyle<ViewStyle> = () => ({ flex: 1 })
const $headerStyle: ThemedStyle<ViewStyle> = () => ({ backgroundColor: "#1737ba" })
const $headerTitle: ThemedStyle<TextStyle> = () => ({ color: "#fff" })
const $leftActionWrapper: ViewStyle = { justifyContent: "center", alignItems: "center", marginLeft: 16 }
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
  marginTop: spacing.xl,
  borderRadius: 16,
  height: 56,
  borderWidth: 0,
})