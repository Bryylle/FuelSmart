import { FC, useCallback, useMemo, useState, useEffect } from "react"
import {
  LayoutAnimation, View, ViewStyle, TextStyle, Pressable, 
  PixelRatio, Modal, ScrollView, Platform, Image, ActivityIndicator, Alert, TextInput
} from "react-native"
import * as Application from "expo-application"
import { useNavigation, NavigationProp } from "@react-navigation/native"

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
import type { DemoTabScreenProps } from "@/navigators/navigationTypes"
import type { AppStackParamList } from "@/navigators/navigationTypes"

// Import supabase client
import { supabase } from "@/services/supabase" 

const HAIRLINE = 1 / PixelRatio.get()

export const ProfileScreen: FC = function ProfileScreen() {
  const { setThemeContextOverride, themeContext, themed } = useAppTheme()
  const { logout } = useAuth()
  const navigation = useNavigation<NavigationProp<AppStackParamList>>()

  // --- State ---
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [userData, setUserData] = useState<any>(null)
  const [fuelOptions, setFuelOptions] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  
  const [preferredStations, setPreferredStations] = useState<string[]>(["None"])
  const [tempPreferredStations, setTempPreferredStations] = useState<string[]>(["None"])
  
  const [isFuelPickerOpen, setFuelPickerOpen] = useState(false)

  // --- Data Fetching ---
  useEffect(() => {
    fetchInitialData()
  }, [])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single()

        if (profile) {
          setUserData(profile)
          if (profile.preferred_stations?.length > 0) {
            setPreferredStations(profile.preferred_stations)
          }
        }
      }

      const { data: stations } = await supabase
        .from('fuel_stations')
        .select('brand')
      
      if (stations) {
        const uniqueBrands = Array.from(new Set(stations.map(s => s.brand))).sort()
        setFuelOptions(uniqueBrands)
      }

    } catch (e) {
      console.error("Error fetching data:", e)
    } finally {
      setLoading(false)
    }
  }

  // --- Logic ---
  const toggleTheme = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setThemeContextOverride(themeContext === "dark" ? "light" : "dark")
  }, [themeContext, setThemeContextOverride])

  const openFuelPicker = () => {
    setTempPreferredStations([...preferredStations])
    setSearchQuery("")
    setFuelPickerOpen(true)
  }

  const handleToggleTempFuel = (opt: string) => {
    const filtered = tempPreferredStations.filter(s => s !== "None")
    const exists = filtered.includes(opt)

    if (exists) {
      const next = filtered.filter(s => s !== opt)
      setTempPreferredStations(next.length === 0 ? ["None"] : next)
    } else {
      if (filtered.length >= 5) {
        Alert.alert("Limit Reached", "You can only select up to 5 preferred stations.")
        return
      }
      setTempPreferredStations([...filtered, opt])
    }
  }

  const handleSaveStations = async () => {
    try {
      setIsSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { error } = await supabase
          .from('users')
          .update({ preferred_stations: tempPreferredStations })
          .eq('id', user.id)

        if (error) throw error
        
        setPreferredStations([...tempPreferredStations])
        setFuelPickerOpen(false)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredOptions = useMemo(() => {
    return fuelOptions.filter(opt => 
      opt.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [fuelOptions, searchQuery])

  const dropdownText = useMemo(() => {
    const real = preferredStations.filter(s => s !== "None")
    return real.length === 0 ? "None" : real.join(", ")
  }, [preferredStations])

  if (loading) {
    return (
      <Screen style={{ justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={colors.palette.primary500} />
      </Screen>
    )
  }

  return (
    <Screen safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      
      <View style={themed($heroSection)}>
        <View style={$profileHeader}>
          <View style={$avatarCircle}>
            <Text 
              style={themed($avatarText)} 
              text={userData?.firstname ? userData.firstname.substring(0, 1) + (userData.lastname?.substring(0, 1) || "") : "JD"} 
              size="xl" 
              weight="bold"
            />
          </View>
          <View style={$nameContainer}>
            <View style={$tierRow}>
              <Text preset="subheading" weight="bold" style={themed($profileText)}>
                {userData?.firstname} {userData?.lastname}
              </Text>
               <Image 
                  source={require("@assets/icons/download/medal-gold.png")} 
                  style={{ width: 30, height: 30, marginLeft: 8 }} 
                  resizeMode="contain"
                />
            </View>
            <Text style={themed($subtext)}>{userData?.phone || "No phone number"}</Text>
          </View>
        </View>

        <View style={themed($statsCard)}>
          <View style={$statBox}>
            <Text weight="bold" style={$statValue}>{userData?.no_contributions || 0}</Text>
            <Text size="xxs" style={$statLabel}>CONTRIBUTIONS</Text>
          </View>
          <View style={$statDivider} />
          <View style={$statBox}>
            <Text weight="bold" style={$statValue}>{userData?.no_likes || 0}</Text>
            <Text size="xxs" style={$statLabel}>LIKES</Text>
          </View>
        </View>
      </View>
    
      <ScrollView style={themed($subContainer)} showsVerticalScrollIndicator={false}>
        <Text preset="formLabel" style={$sectionHeader}>ACCOUNT</Text>
        <View style={themed($insetGroup)}>
          <ListItem
            text="Preferred Stations"
            onPress={openFuelPicker}
            rightIcon="caretRight"
            style={themed($listItemStyle)}
          />
          <View style={themed($separator)} />
          <ListItem
            text="Privacy"
            onPress={() => navigation.navigate("Privacy")}
            rightIcon="caretRight"
            style={themed($listItemStyle)}
          />
          <View style={themed($separator)} />
          <ListItem
            text="Terms And Conditions"
            onPress={() => navigation.navigate("TermsAndConditions")}
            rightIcon="caretRight"
            style={themed($listItemStyle)}
          />
        </View>

        <Text preset="formLabel" style={$sectionHeader}>APP SETTINGS</Text>
        <View style={themed($insetGroup)}>
          <ListItem
            text="Dark Mode"
            RightComponent={<Switch value={themeContext === "dark"} onValueChange={toggleTheme} />}
            style={themed($listItemStyle)}
          />
          <View style={themed($separator)} />
          <ListItem
            text="Version"
            style={themed($listItemStyle)}
            RightComponent={<Text size="xs" style={{ color: colors.palette.neutral500 }}>{Application.nativeApplicationVersion}</Text>}
          />
        </View>

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
        <Pressable style={$modalOverlay} onPress={() => setFuelPickerOpen(false)}>
          <Pressable style={themed($modalContent)}>
            <View style={$modalHeader}>
              <Text preset="subheading">Select Stations</Text>
              <Pressable onPress={() => setFuelPickerOpen(false)}>
                <Icon icon="close" size={24} color={colors.palette.neutral500} />
              </Pressable>
            </View>

            <View style={$searchContainer}>
              <Icon icon="search" size={18} color={colors.palette.neutral500} style={{ marginRight: 8 }} />
              <TextInput
                style={$searchInput}
                placeholder="Search brand..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor={colors.palette.neutral500}
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Icon icon="close" size={18} color={colors.palette.neutral500} />
                </Pressable>
              )}
            </View>
            
            <View style={$fixedListContainer}>
              <ScrollView showsVerticalScrollIndicator={true}>
                {filteredOptions.length > 0 ? (
                  filteredOptions.map(opt => (
                    <Pressable key={opt} onPress={() => handleToggleTempFuel(opt)} style={$modalOption}>
                      <Text style={tempPreferredStations.includes(opt) ? { color: colors.tint, fontWeight: 'bold' } : {}}>{opt}</Text>
                      {tempPreferredStations.includes(opt) && (
                        <Icon icon="check" size={18} color={colors.tint} />
                      )}
                    </Pressable>
                  ))
                ) : (
                  <View style={$noResults}>
                    <Text style={{ opacity: 0.5 }}>No results found</Text>
                  </View>
                )}
              </ScrollView>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Button 
                text="Cancel" 
                onPress={() => setFuelPickerOpen(false)} 
                style={[$modalBtn, { backgroundColor: '#F2F2F7', borderWidth: 0 }]} 
                textStyle={{ color: 'black' }}
                disabled={isSaving}
              />
              <Button 
                text="Save" 
                onPress={handleSaveStations} 
                style={[$modalBtn, { backgroundColor: colors.palette.primary500, borderWidth: 0 }]} 
                textStyle={{ color: 'white' }}
                disabled={isSaving}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

    </Screen>
  )
}

// #region Styles
const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({ flex: 1 })
const $subContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({ padding: spacing.md, flex: 1 })
const $heroSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.lg,
  backgroundColor: "#1737ba",
  paddingTop: 50,
  height: 250,
  paddingHorizontal: spacing.md,
})
const $profileText: ThemedStyle<TextStyle> = ({ colors }) => ({ color: "#fff" })
const $subtext: ThemedStyle<TextStyle> = ({ colors }) => ({ color: "#fff", fontSize: 14 })
const $statsCard: ThemedStyle<ViewStyle> = ({ colors }) => ({
  flexDirection: "row",
  backgroundColor: colors.palette.neutral800,
  borderRadius: 16,
  padding: 16,
})
const $profileHeader: ViewStyle = { flexDirection: "row", alignItems: "center", marginBottom: 20 }
const $avatarCircle: ViewStyle = {
  width: 64, height: 64, borderRadius: 32,
  backgroundColor: colors.palette.neutral300,
  marginRight: 16, alignItems: "center", justifyContent: "center"
}
const $avatarText: ThemedStyle<TextStyle> = ({ colors }) => ({ color: "blue" })
const $nameContainer: ViewStyle = { flex: 1, justifyContent: "center" }
const $tierRow: ViewStyle = { flexDirection: "row", alignItems: "center" }
const $statBox: ViewStyle = { flex: 1, alignItems: "center" }
const $statValue: TextStyle = { color: "white", fontSize: 20 }
const $statLabel: TextStyle = { color: "#999", marginTop: 4 }
const $statDivider: ViewStyle = { width: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 4 }
const $sectionHeader: TextStyle = { fontSize: 12, letterSpacing: 1, opacity: 0.5, marginBottom: 8, marginLeft: 4 }
const $insetGroup: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.background,
  borderRadius: 12, overflow: "hidden",
  borderWidth: HAIRLINE, borderColor: colors.palette.neutral300,
  marginBottom: 20,
})
const $listItemStyle: ThemedStyle<ViewStyle> = ({ colors }) => ({
  borderBottomWidth: HAIRLINE, borderBottomColor: colors.palette.neutral300,
  paddingHorizontal: 16, alignItems: "center",
})
const $separator: ThemedStyle<ViewStyle> = ({ colors }) => ({ height: HAIRLINE, backgroundColor: colors.palette.neutral300 })
const $footer: ViewStyle = { marginTop: 10, marginBottom: 40 }
const $logoutButton: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: "transparent", borderColor: "red", borderWidth: 2, color: "red",
})
const $modalOverlay: ViewStyle = { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }
const $modalContent: ThemedStyle<ViewStyle> = ({ colors }) => ({ backgroundColor: colors.background, width: '85%', borderRadius: 16, padding: 20 })
const $modalHeader: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }
const $searchContainer: ViewStyle = { 
  flexDirection: 'row', 
  alignItems: 'center', 
  backgroundColor: '#F2F2F7', 
  borderRadius: 10, 
  paddingHorizontal: 10, 
  marginBottom: 16,
  height: 45 
}
const $searchInput: TextStyle = { flex: 1, height: '100%', color: 'black', fontSize: 14 }
const $fixedListContainer: ViewStyle = { height: 350 } // Maintains modal height regardless of item count
const $modalOption: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: HAIRLINE, borderBottomColor: '#ccc', alignItems: 'center' }
const $noResults: ViewStyle = { padding: 40, alignItems: 'center', justifyContent: 'center' }
const $modalBtn: ViewStyle = { flex: 1, borderRadius: 25, height: 45 }
// #endregion