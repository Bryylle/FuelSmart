import { FC, useCallback, useMemo, useState } from "react"
import {
  LayoutAnimation, View, ViewStyle, TextStyle, Pressable, 
  PixelRatio, Modal, ScrollView, Platform, Image
} from "react-native"
import * as Application from "expo-application"

import { Button } from "@/components/Button"
import { ListItem } from "@/components/ListItem"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { useAuth } from "@/context/AuthContext"
import { useAppTheme } from "@/theme/context"
import { Switch } from "@/components/Toggle/Switch"
import { colors } from "@/theme/colors"
import type { ThemedStyle } from "@/theme/types"
import { spacing } from "@/theme/spacing"
import { Icon } from "@/components/Icon"

const HAIRLINE = 1 / PixelRatio.get()

export const DemoDebugScreen: FC = function DemoDebugScreen() {
  const { setThemeContextOverride, themeContext, themed } = useAppTheme()
  const { logout } = useAuth()

  // --- State ---
  const fuelOptions = useMemo(() => ["None", "Shell", "Petron", "Caltex", "Phoenix", "Seaoil"], [])
  const [preferredStations, setPreferredStations] = useState<string[]>(["None"])
  const [isFuelPickerOpen, setFuelPickerOpen] = useState(false)
  const [showFirstNameOnly, setShowFirstNameOnly] = useState(false)
  const [showGcash, setShowGcash] = useState(false)
  const [showMaya, setShowMaya] = useState(false)

  // --- Logic ---
  const toggleTheme = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setThemeContextOverride(themeContext === "dark" ? "light" : "dark")
  }, [themeContext, setThemeContextOverride])

  const handleSelectFuel = (opt: string) => {
    if (opt === "None") {
      setPreferredStations(["None"])
    } else {
      const filtered = preferredStations.filter(s => s !== "None")
      const exists = filtered.includes(opt)
      const next = exists ? filtered.filter(s => s !== opt) : [...filtered, opt]
      setPreferredStations(next.length === 0 ? ["None"] : next)
    }
  }

  const dropdownText = useMemo(() => {
    const real = preferredStations.filter(s => s !== "None")
    if (real.length === 0) return "None"
    return real.join(", ")
  }, [preferredStations])

  return (
    <Screen safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      
      {/* --- HERO SECTION --- */}
      <View style={themed($heroSection)}>
        <View style={$profileHeader}>
          <View style={$avatarCircle} />
          <View style={$nameContainer}>
            <View style={$tierRow}>
              <Text preset="subheading" weight="bold" style={themed($profileText)}>Juan Dela Cruz</Text>
              {/* <View style={themed($goldBadge)}><Text style={$goldText}>GOLD</Text></View> */}
              <>
               <Image 
                  source={require("@assets/icons/download/medal-gold.png")} 
                  style={{ 
                    width: 30, 
                    height: 30, 
                    marginLeft: 8 
                  }} 
                  resizeMode="contain" // Options: 'contain', 'cover', 'stretch', 'center'
                />
              </>
              {/* <ListItem
                text="Juan Dela Cruz"
                rightIcon="medalGold"
              /> */}
            </View>
            <Text style={themed($subtext)}>+63 912 345 6789</Text>
          </View>
        </View>

        <View style={themed($statsCard)}>
          <View style={$statBox}>
            <Text weight="bold" style={$statValue}>123</Text>
            <Text size="xxs" style={$statLabel}>CONTRIBUTIONS</Text>
          </View>
          <View style={$statDivider} />
          <View style={$statBox}>
            <Text weight="bold" style={$statValue}>21</Text>
            <Text size="xxs" style={$statLabel}>LIKES</Text>
          </View>
        </View>
      </View>
    
      <ScrollView style={themed($subContainer)} showsVerticalScrollIndicator={false}>
        {/* --- PREFERENCES --- */}
        <Text preset="formLabel" style={$sectionHeader}>ACCOUNT</Text>
        <View style={themed($insetGroup)}>
          <ListItem
            text="Preferred Stations"
            onPress={() => setFuelPickerOpen(true)}
            rightIcon="caretRight"
            style={themed($listItemStyle)}
          />
          <View style={themed($separator)} />
          <ListItem
            text="Privacy"
            onPress={() => ''}
            rightIcon="caretRight"
            style={themed($listItemStyle)}
          />
        </View>

        {/* --- PRIVACY --- */}
        {/* <Text preset="formLabel" style={$sectionHeader}>PRIVACY</Text>
        <View style={themed($insetGroup)}>
          <ListItem
            text="Show first name only"
            RightComponent={<Switch value={showFirstNameOnly} onValueChange={setShowFirstNameOnly} />}
          />
          <View style={themed($separator)} />
          <ListItem
            text="Show GCash Number"
            RightComponent={<Switch value={showGcash} onValueChange={setShowGcash} />}
          />
          <View style={themed($separator)} />
          <ListItem
            text="Show Maya Number"
            RightComponent={<Switch value={showMaya} onValueChange={setShowMaya} />}
          />
        </View> */}

        {/* --- APP SETTINGS --- */}
        <Text preset="formLabel" style={$sectionHeader}>APP SETTINGS</Text>
        <View style={themed($insetGroup)}>
          <ListItem
            text="Dark Mode"
            RightComponent={<Switch value={themeContext === "dark"} onValueChange={toggleTheme} />}
          />
          <View style={themed($separator)} />
          <ListItem
            text="Version"
            RightComponent={<Text size="xs" style={{ color: colors.palette.neutral500 }}>{Application.nativeApplicationVersion}</Text>}
          />
        </View>

        {/* --- LOGOUT --- */}
        <View style={$footer}>
          <Button
            style={themed($logoutButton)}
            text="Log Out"
            onPress={logout}
          />
        </View>
      </ScrollView>

      {/* Fuel Station Modal */}
      <Modal visible={isFuelPickerOpen} transparent animationType="slide">
        <View style={$modalOverlay}>
          <View style={themed($modalContent)}>
            <Text preset="subheading" style={{ marginBottom: 16 }}>Select Stations</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {fuelOptions.map(opt => (
                <Pressable key={opt} onPress={() => handleSelectFuel(opt)} style={$modalOption}>
                  <Text style={preferredStations.includes(opt) ? { color: colors.tint, fontWeight: 'bold' } : {}}>{opt}</Text>
                  {preferredStations.includes(opt) && <Text style={{ color: colors.tint }}>✓</Text>}
                </Pressable>
              ))}
            </ScrollView>
            <Button text="Done" onPress={() => setFuelPickerOpen(false)} style={{ marginTop: 16 }} />
          </View>
        </View>
      </Modal>

    </Screen>
  )
}

// #region Styles
const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  // padding: spacing.md,
  flex: 1,
})

const $subContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.md,
  flex: 1,
})

const $heroSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.lg,
  backgroundColor: "#1737ba",
  paddingTop: 50,
  height: 250,
  top: 0,
  left: 0,
  paddingHorizontal: spacing.md,
})

const $profileText: ThemedStyle<TextStyle> = ({ colors }) => ({ 
  color: "#fff",
})


const $goldText: TextStyle = { color: "#B8860B", fontSize: 10, fontWeight: "bold" }
const $subtext: ThemedStyle<TextStyle> = ({ colors }) => ({ 
  color: "#fff",
  fontSize: 14
})

const $statsCard: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flexDirection: "row",
  backgroundColor: colors.palette.neutral800,
  borderRadius: 16,
  padding: 16,
})

const $profileHeader: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 20,
}

const $avatarCircle: ViewStyle = {
  width: 64,
  height: 64,
  borderRadius: 32,
  backgroundColor: colors.palette.neutral300,
  marginRight: 16,
}

const $nameContainer: ViewStyle = {
  flex: 1,
  justifyContent: "center",
}

const $tierRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
}

const $goldBadge: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: "#FFD70033",
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 4,
  marginLeft: 8,
  borderWidth: 1,
  borderColor: "#FFD700",
})


const $statBox: ViewStyle = { flex: 1, alignItems: "center" }
const $statValue: TextStyle = { color: "white", fontSize: 20 }
const $statLabel: TextStyle = { color: "#999", marginTop: 4 }
const $statDivider: ViewStyle = { width: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 4 }

const $sectionHeader: TextStyle = { fontSize: 12, letterSpacing: 1, opacity: 0.5, marginBottom: 8, marginLeft: 4 }

const $insetGroup: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.background,
  borderRadius: 12,
  overflow: "hidden",
  borderWidth: HAIRLINE,
  borderColor: colors.palette.neutral300,
  marginBottom: 20,
  flex: 1,
  justifyContent: "center",
})
const $listItemStyle: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderBottomWidth: HAIRLINE,
  borderBottomColor: colors.palette.neutral300,
  paddingHorizontal: 16,
})
const $separator: ThemedStyle<ViewStyle> = ({ colors }) => ({
  height: HAIRLINE,
  backgroundColor: colors.palette.neutral300,
  // marginHorizontal: spacing.sm,
})

const $footer: ViewStyle = { marginTop: 10, marginBottom: 40 }

const $logoutButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: "transparent",
  borderColor: colors.palette.angry500,
  borderWidth: 1,
  color: colors.palette.angry500,
})

const $modalOverlay: ViewStyle = { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }
const $modalContent: ThemedStyle<ViewStyle> = ({ colors }) => ({ backgroundColor: colors.background, width: '85%', borderRadius: 16, padding: 20 })
const $modalOption: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: HAIRLINE, borderBottomColor: '#ccc' }
// #endregion