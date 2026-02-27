import React, { FC, useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
  ViewStyle,
  TextStyle,
} from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { Icon } from "@/components/Icon"
import { ScreenHeader } from "@/components/ScreenHeader"
import { Switch } from "@/components/Toggle/Switch"
import { BrandListModal } from "@/components/BrandListModal"
import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import { spacing } from "@/theme/spacing"
import type { ThemedStyle } from "@/theme/types"
import { delay } from "@/utils/delay"
import { supabase } from "@/services/supabase"

// ✅ Same concept as MapScreen: fuel switches are derived from the in-app mapping,
// not from the DB config row.
import { initFuelMappings, FUEL_BRAND_MAP } from "@/utils/fuelMappings"

/**
 * UpdateAddBrandScreen.tsx
 *
 * Admin screen for adding/updating brand fuel config (marketing names per fuel).
 *
 * ✅ CHANGE REQUEST:
 * When selecting a brand, DO NOT fetch brand config from DB.
 * Instead, immediately toggle switches using FUEL_BRAND_MAP (same behavior as MapScreen).
 * Admin can still Save to DB via upsert.
 */

// ---- Configure these to match your Supabase schema ----
const BRAND_CONFIG_TABLE = "fuel_brand_configs" // TODO: change if your table name differs
const BRAND_UNIQUE_COL = "brand" // TODO: unique column used for upsert

// These column names are intentionally aligned with FUEL_BRAND_MAP keys in the app.
const COLS = {
  regular_gas: "regular_gas",
  premium_gas: "premium_gas",
  sports_gas: "sports_gas",
  regular_diesel: "regular_diesel",
  premium_diesel: "premium_diesel",
} as const

type FuelKey = keyof typeof COLS

type FormState = {
  brand: string
  has: Record<FuelKey, boolean>
  names: Record<FuelKey, string>
}

const fuelFields: { key: FuelKey; label: string; placeholder: string }[] = [
  { key: "regular_gas", label: "Regular Gasoline", placeholder: "e.g. Xtra Advance" },
  { key: "premium_gas", label: "Premium Gasoline", placeholder: "e.g. XCS" },
  { key: "sports_gas", label: "Sports Gasoline", placeholder: "e.g. Blaze" },
  { key: "regular_diesel", label: "Regular Diesel", placeholder: "e.g. Turbo Diesel" },
  { key: "premium_diesel", label: "Premium Diesel", placeholder: "e.g. V-Power Diesel" },
]

const normalizeBrandLabel = (brand: string) => {
  // If BrandListModal returns Add "X", extract X
  const m = /^Add\s+"(.+)"$/i.exec(brand.trim())
  return (m?.[1] ?? brand).trim()
}

const defaultForm: FormState = {
  brand: "",
  has: {
    regular_gas: false,
    premium_gas: false,
    sports_gas: false,
    regular_diesel: false,
    premium_diesel: false,
  },
  names: {
    regular_gas: "",
    premium_gas: "",
    sports_gas: "",
    regular_diesel: "",
    premium_diesel: "",
  },
}

// --- Helper: case-insensitive lookup against FUEL_BRAND_MAP (same pattern as MapScreen) ---
const getMappedBrandConfig = (brand: string) => {
  const brandLower = brand.trim().toLowerCase()
  const key = Object.keys(FUEL_BRAND_MAP).find((k) => k.toLowerCase() === brandLower)
  return key ? (FUEL_BRAND_MAP as any)[key] : null
}

// Reusable field row with Switch + conditional marketing name input
const FuelToggleField = React.memo(
  ({
    label,
    placeholder,
    enabled,
    value,
    onToggle,
    onChangeText,
    disabled,
    colors,
    themedStyles,
  }: any) => {
    return (
      <View style={themedStyles.$inputWrapper}>
        <View style={$rowJustify}>
          <Text preset="formLabel" text={label} size="md" style={[disabled && { opacity: 0.5 }]} />
          <Switch value={enabled} onValueChange={onToggle} disabled={disabled} />
        </View>
        {enabled && (
          <TextInput
            style={[themedStyles.$input, disabled && { opacity: 0.5 }]}
            value={value}
            placeholder={placeholder}
            placeholderTextColor={colors.textDim}
            onChangeText={onChangeText}
            maxLength={20}
            editable={!disabled}
          />
        )}
      </View>
    )
  },
)

export const UpdateAddBrandScreen: FC<DemoTabScreenProps<"UpdateAddBrand">> = ({ navigation }) => {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()

  const [availableBrands, setAvailableBrands] = useState<string[]>([])
  const [brandSearchQuery, setBrandSearchQuery] = useState("")
  const [isBrandPickerVisible, setIsBrandPickerVisible] = useState(false)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<FormState>(defaultForm)

  // UX helper
  const [isExistingBrand, setIsExistingBrand] = useState(false)

  // Ensure FUEL_BRAND_MAP is available (MapScreen calls initFuelMappings on mount)
  const [fuelMappingsReady, setFuelMappingsReady] = useState(false)

  const themedStyles = useMemo(
    () => ({
      $inputWrapper: themed($inputWrapperStyle),
      $input: themed($inputStyle),
      $saveButton: themed($saveButtonStyle),
      $card: themed($card),
      $muted: themed($mutedText),
    }),
    [themed],
  )

  const ensureFuelMappings = useCallback(async () => {
    if (fuelMappingsReady) return
    try {
      await initFuelMappings()
    } catch (e) {
      // Non-fatal: admin can still manually toggle.
      console.warn("initFuelMappings failed:", e)
    } finally {
      setFuelMappingsReady(true)
    }
  }, [fuelMappingsReady])

  const loadBrands = useCallback(async () => {
    // Fetch unique brands from fuel_stations (same idea as MapScreen)
    const { data, error } = await supabase.from("fuel_stations").select("brand")
    if (error) throw error
    const unique = Array.from(new Set((data ?? []).map((s: any) => s.brand).filter(Boolean))).sort()
    setAvailableBrands(unique)
  }, [])

  const initialize = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true)
        await Promise.allSettled([ensureFuelMappings(), loadBrands()])
      } catch (e: any) {
        console.error("Init failed:", e)
        Alert.alert("Error", "Could not load brands.")
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [ensureFuelMappings, loadBrands],
  )

  useEffect(() => {
    initialize(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onRefresh = useCallback(() => {
    setRefreshing(true)
    initialize(true)
  }, [initialize])

  // Brand picker options: allow custom entry like MapScreen
  const filteredBrandOptions = useMemo(() => {
    const query = brandSearchQuery.trim().toLowerCase()
    const exactMatchExists = availableBrands.some((b) => b.toLowerCase() === query)
    const filtered = availableBrands.filter((opt) => opt.toLowerCase().includes(query))
    if (query !== "" && !exactMatchExists) {
      return [`Add "${brandSearchQuery.trim()}"`, ...filtered]
    }
    return filtered
  }, [availableBrands, brandSearchQuery])

  // ✅ Apply mapping immediately when selecting a brand (NO DB fetch).
  const applyMappingForBrand = useCallback(
    async (brandRaw: string) => {
      const brand = normalizeBrandLabel(brandRaw)
      if (!brand) return

      await ensureFuelMappings()

      const exists = availableBrands.some((b) => b.toLowerCase() === brand.toLowerCase())
      setIsExistingBrand(exists)

      const mapped = getMappedBrandConfig(brand)

      if (mapped) {
        const nextHas: Record<FuelKey, boolean> = {
          regular_gas: !!mapped[COLS.regular_gas],
          premium_gas: !!mapped[COLS.premium_gas],
          sports_gas: !!mapped[COLS.sports_gas],
          regular_diesel: !!mapped[COLS.regular_diesel],
          premium_diesel: !!mapped[COLS.premium_diesel],
        }

        // If mapping values are strings, prefill names; if booleans, keep names empty.
        const nextNames: Record<FuelKey, string> = {
          regular_gas: typeof mapped[COLS.regular_gas] === "string" ? String(mapped[COLS.regular_gas] ?? "") : "",
          premium_gas: typeof mapped[COLS.premium_gas] === "string" ? String(mapped[COLS.premium_gas] ?? "") : "",
          sports_gas: typeof mapped[COLS.sports_gas] === "string" ? String(mapped[COLS.sports_gas] ?? "") : "",
          regular_diesel:
            typeof mapped[COLS.regular_diesel] === "string" ? String(mapped[COLS.regular_diesel] ?? "") : "",
          premium_diesel:
            typeof mapped[COLS.premium_diesel] === "string" ? String(mapped[COLS.premium_diesel] ?? "") : "",
        }

        setForm({ brand, has: nextHas, names: nextNames })
      } else {
        // No mapping found => treat as new brand
        setForm({ ...defaultForm, brand })
      }

      setBrandSearchQuery("")
      setIsBrandPickerVisible(false)
    },
    [availableBrands, ensureFuelMappings],
  )

  const toggleFuel = useCallback((key: FuelKey, val: boolean) => {
    setForm((p) => {
      const next = { ...p, has: { ...p.has, [key]: val } }
      // If turning OFF, clear marketing name to avoid accidental stale save
      if (!val) next.names = { ...p.names, [key]: "" }
      return next
    })
  }, [])

  const setFuelName = useCallback((key: FuelKey, text: string) => {
    setForm((p) => ({ ...p, names: { ...p.names, [key]: text } }))
  }, [])

  const validate = useCallback(() => {
    const brand = form.brand.trim()
    if (!brand) return "Brand is required."
    const anyFuel = Object.values(form.has).some(Boolean)
    if (!anyFuel) return "Please enable at least one fuel type for this brand."

    // For this admin screen we require names for enabled fuels (same as original behavior).
    const missingNames = (Object.keys(form.has) as FuelKey[])
      .filter((k) => form.has[k])
      .some((k) => !form.names[k].trim())
    if (missingNames) return "Please provide a marketing name for each enabled fuel type."

    return null
  }, [form])

  const onSave = useCallback(async () => {
    const errorMsg = validate()
    if (errorMsg) {
      Alert.alert("Missing Information", errorMsg)
      return
    }

    const payload: Record<string, any> = {
      [BRAND_UNIQUE_COL]: form.brand.trim(),
      [COLS.regular_gas]: form.has.regular_gas ? form.names.regular_gas.trim() : null,
      [COLS.premium_gas]: form.has.premium_gas ? form.names.premium_gas.trim() : null,
      [COLS.sports_gas]: form.has.sports_gas ? form.names.sports_gas.trim() : null,
      [COLS.regular_diesel]: form.has.regular_diesel ? form.names.regular_diesel.trim() : null,
      [COLS.premium_diesel]: form.has.premium_diesel ? form.names.premium_diesel.trim() : null,
    }

    try {
      setSaving(true)
      const { error } = await supabase
        .from(BRAND_CONFIG_TABLE)
        .upsert(payload, { onConflict: BRAND_UNIQUE_COL })

      if (error) throw error

      Alert.alert("Success", "Brand configuration saved!")

      // Refresh brand list (optional)
      await Promise.allSettled([initialize(true), delay(350)])
    } catch (e: any) {
      console.error("Save failed:", e)
      Alert.alert("Failed", e?.message ?? "Could not save brand configuration.")
    } finally {
      setSaving(false)
    }
  }, [form, validate, initialize])

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screenContainer)}>
      <ScreenHeader title="Update / Add Brand" leftIcon="arrow_left" onLeftPress={() => navigation.goBack()} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
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
            {/* Brand selector */}
            <View style={themedStyles.$card}>
              <Text preset="subheading" text="Brand Configuration" style={{ marginBottom: spacing.md }} />

              <View style={themedStyles.$inputWrapper}>
                <Text preset="formLabel" text="Brand" />

                <Pressable onPress={() => setIsBrandPickerVisible(true)}>
                  <View pointerEvents="none">
                    <TextInput
                      style={themedStyles.$input}
                      value={form.brand}
                      placeholder="Select or Type Brand"
                      placeholderTextColor={colors.textDim}
                      editable={false}
                    />
                  </View>
                </Pressable>

                <Text size="xxs" style={themedStyles.$muted}>
                  {isExistingBrand
                    ? "Existing brand detected. Switches are auto-toggled from the app mapping." 
                    : "New brand. Please enable available fuels and set marketing labels."}
                </Text>
              </View>

              <BrandListModal
                isVisible={isBrandPickerVisible}
                onClose={() => {
                  setIsBrandPickerVisible(false)
                  setBrandSearchQuery("")
                }}
                headerText="Select Brand"
                options={filteredBrandOptions}
                selectedValues={form.brand}
                singleSelect={true}
                upperRightIcon={true}
                searchQuery={brandSearchQuery}
                onSearchChange={setBrandSearchQuery}
                onSelect={(brand) => applyMappingForBrand(brand as string)}
              />

              {/* Fuel toggles */}
              <Text preset="subheading" text="Available Fuel Types" style={{ marginBottom: spacing.sm }} />

              {fuelFields.map((f) => (
                <FuelToggleField
                  key={f.key}
                  label={f.label}
                  placeholder={f.placeholder}
                  enabled={form.has[f.key]}
                  value={form.names[f.key]}
                  onToggle={(v: boolean) => toggleFuel(f.key, v)}
                  onChangeText={(t: string) => setFuelName(f.key, t)}
                  disabled={false}
                  colors={colors}
                  themedStyles={themedStyles}
                />
              ))}

              <View style={$hintBox(colors.border)}>
                <Icon icon="information" size={16} color={colors.textDim} />
                <Text
                  size="xxs"
                  style={[themedStyles.$muted, { flex: 1 }]}
                  text="Tip: Use the brand’s exact marketing label (e.g., XCS, Xtra Advance) so station details render consistently across the app."
                />
              </View>

              <Button
                preset="filled"
                onPress={onSave}
                style={themedStyles.$saveButton}
                disabled={saving}
                RightAccessory={() => (saving ? <ActivityIndicator color="#fff" /> : null)}
              >
                <Text
                  text={saving ? "Saving..." : "Save Changes"}
                  size="md"
                  style={{ color: "#fff" }}
                  preset="bold"
                />
              </Button>
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Screen>
  )
}

// #region STYLES
const $screenContainer: ThemedStyle<ViewStyle> = () => ({ flex: 1 })

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.background,
  borderRadius: 20,
  padding: spacing.md,
  borderWidth: 1,
  borderColor: colors.border,
})

const $rowJustify: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 6,
}

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

const $mutedText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  marginTop: 8,
})

const $hintBox = (border: string): ViewStyle => ({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: 8,
  padding: 12,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: border,
  backgroundColor: "rgba(0,0,0,0.03)",
  marginTop: spacing.xs,
})
// #endregion