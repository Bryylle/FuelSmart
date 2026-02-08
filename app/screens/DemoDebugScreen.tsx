import { FC, useCallback, useMemo, useState } from "react"
import {
  LayoutAnimation,
  Linking,
  Platform,
  TextStyle,
  useColorScheme,
  View,
  ViewStyle,
  Modal, Pressable, PixelRatio, ScrollView, Dimensions
} from "react-native"
import * as Application from "expo-application"

import { Button } from "@/components/Button"
import { ListItem } from "@/components/ListItem"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useAuth } from "@/context/AuthContext"
import { isRTL } from "@/i18n"
import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import { $styles } from "@/theme/styles"
import type { ThemedStyle } from "@/theme/types"
import { Switch } from "@/components/Toggle/Switch"
import { colors } from "@/theme/colors"


/**
 * @param {string} url - The URL to open in the browser.
 * @returns {void} - No return value.
 */
function openLinkInBrowser(url: string) {
  Linking.canOpenURL(url).then((canOpen) => canOpen && Linking.openURL(url))
}

const usingHermes = typeof HermesInternal === "object" && HermesInternal !== null
const HAIRLINE = 1 / PixelRatio.get()
export const DemoDebugScreen: FC<DemoTabScreenProps<"DemoDebug">> = function DemoDebugScreen(
  _props,
) {
  const { setThemeContextOverride, themeContext, themed } = useAppTheme()
  const { logout } = useAuth()
  const toggleTheme = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut) // Animate the transition
    setThemeContextOverride(themeContext === "dark" ? "light" : "dark")
  }, [themeContext, setThemeContextOverride])

  // Resets the theme to the system theme
  const colorScheme = useColorScheme()
  const resetTheme = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setThemeContextOverride(undefined)
  }, [setThemeContextOverride])

  // Dummy values
  const fuelOptions = useMemo(() => ["None", "Shell", "Petron", "Caltex", "1st Auto Gas", "Phoenix", "Diatoms Fuel", "Fuel Tech", "Seaoil", "Fuel 1", "Fuel 2", "Fuel 3"], [])
  // Multi-select state
  const [preferredStations, setPreferredStations] = useState<string[]>([])
  const [isFuelPickerOpen, setFuelPickerOpen] = useState(false)
  // Snapshot so Cancel can restore
  const [snapshotPreferred, setSnapshotPreferred] = useState<string[] | null>(null)
  // Dummy privacy toggle (UI only)
  const [showFirstNameOnly, setShowFirstNameOnly] = useState<boolean>(false)
  const [showGcash, setShowGcash] = useState<boolean>(false)
  const [showMaya, setShowMaya] = useState<boolean>(false)
  const [showPreferredStationsOnly, setShowPreferredStationsOnly] = useState<boolean>(false)

  // Open modal AND snapshot current selection
  const openFuelPicker = useCallback(() => {
    setSnapshotPreferred(preferredStations)
    setFuelPickerOpen(true)
  }, [preferredStations])

  const closeFuelPicker = useCallback(() => setFuelPickerOpen(false), [])

  // Helpers for special "None" semantics
  const hasAnyReal = preferredStations.some((s) => s !== "None")
  const isOnlyNoneSelected = preferredStations.length === 0 || (preferredStations.length === 1 && preferredStations[0] === "None")

  // Toggle add/remove with "None" exclusivity
  const handleSelectFuel = useCallback((value: string) => {
    setPreferredStations((prev) => {
      const isNone = value === "None"
      const currentlyHasAnyReal = prev.some((s) => s !== "None")
      const currentlyHasNone = prev.includes("None")

      // If tapping "None":
      if (isNone) {
        // If any real is selected, "None" should be unclickable (do nothing)
        if (currentlyHasAnyReal) return prev
        // Otherwise, select "None" exclusively
        return ["None"]
      }

      // If tapping a real station:
      // If "None" is currently selected, remove it first
      const base = currentlyHasNone ? [] : prev
      const exists = base.includes(value)
      if (exists) {
        return base.filter((v) => v !== value)
      }
      return [...base, value]
    })
  }, [])

  // Disable map filter switch when none or only "None" is selected
  const isFuelFilterDisabled = isOnlyNoneSelected

  // OK: when pressing OK with nothing selected, default to ["None"], then close and clear snapshot
  const handleDone = useCallback(() => {
    setPreferredStations((prev) => {
      if (prev.length === 0) return ["None"]
      return prev
    })
    setSnapshotPreferred(null)
    setFuelPickerOpen(false)
  }, [])

  // Cancel: restore snapshot and close
  const handleCancel = useCallback(() => {
    setPreferredStations(snapshotPreferred ?? preferredStations)
    setSnapshotPreferred(null)
    setFuelPickerOpen(false)
  }, [snapshotPreferred, preferredStations])

  /**
   * Compute the label for the dropdown with a compact "+N" badge.
   * - Shows "None" when empty or only "None"
   * - Otherwise shows up to MAX_LABEL_ITEMS, then "… (+N)"
   */
  const MAX_LABEL_ITEMS = 3 // tweak as needed
  const dropdownText = useMemo(() => {
    if (preferredStations.length === 0) return "None"
    if (preferredStations.length === 1 && preferredStations[0] === "None") return "None"

    const real = preferredStations.filter((s) => s !== "None")
    if (real.length === 0) return "None"

    const head = real.slice(0, MAX_LABEL_ITEMS)
    const remaining = real.length - head.length
    const base = head.join(", ")
    return remaining > 0 ? `${base} … (+${remaining})` : base
  }, [preferredStations])

  // "Select all" control state + toggle behavior
  const realOptions = useMemo(() => fuelOptions.filter((o) => o !== "None"), [fuelOptions])
  const isAllSelected = useMemo(() => {
    const selectedReal = preferredStations.filter((s) => s !== "None")
    return selectedReal.length === realOptions.length && realOptions.every((o) => selectedReal.includes(o))
  }, [preferredStations, realOptions])

  const handleToggleAll = useCallback((checked: boolean) => {
    if (checked) {
      setPreferredStations(realOptions) // Select all real options
    } else {
      setPreferredStations(["None"]) // Clear all -> default to ["None"]
    }
  }, [realOptions])

  // ===== Scrollable list max height (e.g., 60% of screen) =====
  const maxListHeight = Math.floor(Dimensions.get("window").height * 0.6)

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top"]}
      contentContainerStyle={[$styles.container, themed($container)]}
    >
      <View style={themed($card)}>
        <View style={{flex:1, flexDirection: "row"}}>
          <Text preset="subheading" style={themed($name)}>
            Juan Dela Cruz
            <View style={themed($badge)}>
             <Text style={themed($badgeText)}>GOLD</Text>
            </View>
          </Text>
        </View>
        <Text style={themed($subtle)}>+69123456789</Text>
        <View style={themed($statsRow)}>
          <View style={themed($statBox)}>
            <Text preset="bold" style={{color: "white"}}>123</Text>
            <Text style={themed($statLabel)}>Contributions</Text>
          </View>

          <View style={themed($statBox)}>
            <Text preset="bold" style={{color: "white"}}>21</Text>
            <Text style={themed($statLabel)}>Likes</Text>
          </View>
        </View>
      </View>

      <View style={themed($card)}>
        <Text preset="bold">Preferred Fuel Stations</Text>
        <Pressable
          onPress={openFuelPicker}
          accessibilityRole="button"
          accessibilityLabel="Preferred fuel stations"
          style={themed($dropdownField)}
        >
          <Text
            style={themed($dropdownFieldText)}
            numberOfLines={1}
            ellipsizeMode="tail"           
          >
            {dropdownText}
          </Text>
          <Text style={themed($dropdownChevron)}>{isRTL ? "◀" : "▶"}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (isFuelFilterDisabled) return
            setShowPreferredStationsOnly((v) => !v)
          }}
          accessibilityRole="switch"
          accessibilityState={{ checked: showPreferredStationsOnly, disabled: isFuelFilterDisabled }}
          style={themed($switchRow)}
          disabled={isFuelFilterDisabled}
        >
          <Text style={themed($switchLabel)}>
            Show only preferred fuel stations on Map
          </Text>
          <Switch
            value={showPreferredStationsOnly}
            onValueChange={(v) => {
              if (isFuelFilterDisabled) return
              setShowPreferredStationsOnly(v)
            }}
            label=""
            disabled={isFuelFilterDisabled}
          />
        </Pressable>
      </View>

      <View style={themed($card)}>
        <View style={themed($indicatorRow)}>
          <Text style={themed($indicatorLabel)}>Shown to others as:</Text>
          <Text style={themed($indicatorValue)}>
            {showFirstNameOnly ? "First name only" : "Full name"}
          </Text>
        </View>

        <View style={themed($divider)} />

        <Pressable
          onPress={() => setShowFirstNameOnly((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: showFirstNameOnly }}
          style={themed($switchRow)}
        >
          <Text style={themed($switchLabel)}>
            Show my first name only
          </Text>

          <Switch
            value={showFirstNameOnly}
            onValueChange={setShowFirstNameOnly}
            label=""
          />
        </Pressable>
        <Pressable
          onPress={() => setShowGcash((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: showFirstNameOnly }}
          style={themed($switchRow)}
        >
          <Text style={themed($switchLabel)}>
            Show my Gcash number
          </Text>
          <Switch
            value={showGcash}
            onValueChange={setShowGcash}
            label=""
          />
        </Pressable>
        <Pressable
          onPress={() => setShowMaya((v) => !v)}
          accessibilityRole="switch"
          accessibilityState={{ checked: showFirstNameOnly }}
          style={themed($switchRow)}
        >
          <Text style={themed($switchLabel)}>
            Show my Maya number
          </Text>
          <Switch
            value={showMaya}
            onValueChange={setShowMaya}
            label=""
          />
        </Pressable>
      </View>

      <Modal
        visible={isFuelPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={closeFuelPicker}
      >
        <View style={themed($modalCenteredContainer)}>
          <Pressable style={themed($backdrop)} onPress={handleCancel} />
          <View style={themed($centerCard)}>
            <Text preset="subheading" style={themed($sheetTitle)}>
              Select Fuel Stations
            </Text>
            <View style={themed($topSelectAllRow)}>
              <Pressable
                onPress={() => handleToggleAll(!isAllSelected)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isAllSelected }}
                style={themed($selectAllPressable)}
              >
                <View style={themed([$checkboxBox, isAllSelected && $checkboxBoxChecked])}>
                  {isAllSelected ? <Text style={themed($checkboxTick)}>✓</Text> : null}
                </View>
                <Text style={themed($checkboxLabel)}>Select all</Text>
              </Pressable>
            </View>
            <View style={themed($optionsSection)}>
              <ScrollView
                style={themed($optionsScroll)}
                contentContainerStyle={themed($optionsScrollContent)}
                showsVerticalScrollIndicator={false}
              >

                {fuelOptions.map((opt, idx) => {
                  const isNone = opt === "None"
                  const selected = preferredStations.includes(opt)
                  // "None" is disabled if there is at least one real selection
                  const isDisabled = isNone && preferredStations.some((s) => s !== "None")

                  return (
                    <Pressable
                      key={opt}
                      onPress={() => {
                        if (isDisabled) return
                        handleSelectFuel(opt)
                      }}
                     style={themed([
                        $optionRow,
                        idx === 0 && $optionRowFirst,
                        isDisabled && $disabledItem,
                      ])}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected, disabled: isDisabled }}
                      disabled={isDisabled}
                    >
                      <Text style={themed([
                        $optionText,
                        selected && $optionTextSelected,
                        isDisabled && $optionTextDisabled,
                      ])}>
                        {opt}
                      </Text>
                      {selected ? <Text style={themed($checkmark)}>✓</Text> : null}
                    </Pressable>
                  )
                })}
              </ScrollView>
            </View>
            <View style={themed($sheetCancelContainer)}>
              <View style={themed($actionsRow)}>
                <Pressable onPress={handleCancel} accessibilityRole="button" style={themed([$pillButton, $pillButtonGhost])}>
                  <Text style={themed([$pillButtonText, $pillButtonTextGhost])}>Cancel</Text>
                </Pressable>

                <Pressable onPress={handleDone} accessibilityRole="button" style={themed([$pillButton, $pillButtonPrimary])}>
                  <Text style={themed([$pillButtonText, $pillButtonTextPrimary])}>OK</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
      <View style={themed($itemsContainer)}>
        <Switch
          value={themeContext === "dark"}          // reflects current theme
          onValueChange={toggleTheme}              // keep your existing logic
          label="Dark Mode"                        // left label, iOS-style row
          labelPosition="left"
          accessibilityLabel="Toggle dark mode"
        />
      </View>

      <View style={themed($itemsContainer)}>
        <ListItem
          LeftComponent={
            <View>
              <Text preset="bold">App Version</Text>
              <Text>{Application.nativeApplicationVersion}</Text>
            </View>
          }
        />

      <ListItem
          LeftComponent={
            <View>
              <Text preset="bold">Fuel Station Data</Text>
              <Text>OpenStreetMap</Text>
            </View>
          }
        />
      </View>
      
      <View style={themed($buttonContainer)}>
        {/* Log out */}
        <Button
          style={themed($logoutButton)}
          tx="common:logOut"
          onPress={logout}
        />
      </View>
    </Screen>
  )
}
// #region Styles
const $divider: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  height: HAIRLINE,
  backgroundColor: colors.palette.neutral300,
  marginVertical: spacing.sm,
})
const $indicatorRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.md,
})

const $indicatorLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $indicatorValue: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  marginTop: spacing.xxs,
  color: colors.text,
  fontWeight: "600",
})

const $switchRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.sm,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
})

const $switchLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})
const $modalCenteredContainer: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
  justifyContent: "center",
  alignItems: "center",
})

const $centerCard: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  width: "86%",
  borderRadius: spacing.lg,
  backgroundColor: colors.background,
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.lg,
  shadowColor: "#000",
  shadowOpacity: 0.15,
  shadowRadius: 10,
  elevation: 6,
})

const $backdrop: ThemedStyle<ViewStyle> = () => ({
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  backgroundColor: "rgba(0,0,0,0.25)",
})

const $sheetTitle: ThemedStyle<TextStyle> = ({ spacing }) => ({
  paddingVertical: spacing.md,
})

const $topSelectAllRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingBottom: spacing.xs,
  marginBottom: spacing.xxs,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-start",
})

const $optionsSection: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.neutral100,
  borderRadius: spacing.md,
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
  paddingVertical: spacing.xs,
  paddingHorizontal: 0,
})

const $optionsScroll: ThemedStyle<ViewStyle> = () => ({
  maxHeight: Math.floor(Dimensions.get("window").height * 0.28),
})

const $optionsScrollContent: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingVertical: 2,
})

const $optionRow: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  paddingVertical: 14,
  paddingHorizontal: spacing.md,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  borderTopWidth: HAIRLINE,
  borderTopColor: colors.palette.neutral300,
})

const $optionRowFirst: ThemedStyle<ViewStyle> = () => ({
  borderTopWidth: 0,
})

const $optionText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

const $optionTextSelected: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
  fontWeight: "600",
})

const $checkmark: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.tint,
  fontSize: 16,
})

const $sheetCancelContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.xs,
  paddingVertical: spacing.md,
  alignItems: "center",
})

const $actionsRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  width: "100%",
  flexDirection: "row",
  justifyContent: "space-between",
  gap: spacing.sm,
  paddingVertical: spacing.sm,
})

const $dropdownField: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  marginTop: spacing.sm,
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
  backgroundColor: colors.palette.neutral100,
  borderRadius: spacing.sm,
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.md,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
})

const $dropdownFieldText: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.text,
  flex: 1,
  minWidth: 0,
  marginRight: spacing.xs,
})

const $dropdownChevron: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $logoutButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.sm,
})
const $card: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.background,
  borderRadius: spacing.md,
  padding: spacing.lg,
  marginBottom: spacing.lg,
  shadowColor: "#000",
  shadowOpacity: 0.5,
  shadowRadius: 6,
  elevation: 2,
})

const $name: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.xs,
})

const $subtle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 15,
  marginBottom: 5,
})

const $badge: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.tint,
  borderRadius: spacing.xs,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xxs,
  height: 28,
  justifyContent: "center",
  marginLeft: 10,
})

const $badgeText: ThemedStyle<TextStyle> = () => ({
  color: "white",
  fontSize: 12,
  fontWeight: "600",
})

const $statsRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  backgroundColor: colors.palette.neutral800,
  borderRadius: 10,
})

const $statBox: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flex: 1,
  marginHorizontal: spacing.xs,
  backgroundColor: "inherit",
  borderRadius: spacing.md,
  padding: spacing.md,
  alignItems: "center",
  color: "white",
})

const $statLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: "white",
  marginTop: 4,
})

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingBottom: spacing.xxl,
})

const $itemsContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginVertical: spacing.xl,
})

const $buttonContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.md,
})

// Extra styles for disabled option in the modal
const $disabledItem: ThemedStyle<ViewStyle> = () => ({
  opacity: 0.5,
})

const $optionTextDisabled: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

/** ===== Checkbox visuals for "Select all" ===== */
const $selectAllPressable: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: spacing.xs,
  paddingHorizontal: spacing.xs,
  borderRadius: 10,
})

const $checkboxBox: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 22,
  height: 22,
  borderRadius: 4,
  borderWidth: 2,
  borderColor: colors.palette.neutral300,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "transparent",
  marginRight: 10,
})

const $checkboxBoxChecked: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderColor: colors.tint,
  backgroundColor: colors.tint,
})

const $checkboxTick: ThemedStyle<TextStyle> = () => ({
  color: "white",
  fontSize: 14,
  lineHeight: 16,
  fontWeight: "800",
})

/** ===== Professional pill buttons for Cancel / OK ===== */
const $pillButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexGrow: 1,
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.lg,
  borderRadius: 999,
  alignItems: "center",
  justifyContent: "center",
})

const $pillButtonPrimary: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.tint,
  shadowColor: "#000",
  shadowOpacity: Platform.select({ ios: 0.12, android: 0.2, default: 0.12 }),
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 3 },
  elevation: 2,
})

const $pillButtonGhost: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: "transparent",
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
})

const $pillButtonText: ThemedStyle<TextStyle> = () => ({
  fontWeight: "700",
})

const $pillButtonTextPrimary: ThemedStyle<TextStyle> = () => ({
  color: "white",
})

const $pillButtonTextGhost: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

/** Label style for "Select all" */
const $checkboxLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontWeight: "600",
})
// #endregion