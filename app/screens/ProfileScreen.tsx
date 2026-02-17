import { FC, useCallback, useMemo, useState, useEffect } from "react"
import {
  LayoutAnimation, View, ViewStyle, TextStyle, Pressable, 
  PixelRatio, Modal, ScrollView, Platform, Image, ActivityIndicator, Alert, TextInput, RefreshControl,
  KeyboardAvoidingView
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
import { EmptyState } from "@/components/EmptyState"
import type { AppStackParamList } from "@/navigators/navigationTypes"

import { supabase } from "@/services/supabase" 

const HAIRLINE = 1 / PixelRatio.get()

export const ProfileScreen: FC = function ProfileScreen() {
  const { setThemeContextOverride, themeContext, themed } = useAppTheme()
  const { logout } = useAuth()
  const navigation = useNavigation<NavigationProp<AppStackParamList>>()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [userData, setUserData] = useState<any>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [fuelOptions, setFuelOptions] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [preferredStations, setPreferredStations] = useState<string[]>(["None"])
  const [tempPreferredStations, setTempPreferredStations] = useState<string[]>(["None"])
  const [isFuelPickerOpen, setFuelPickerOpen] = useState(false)

  // Security States
  const [dbPin, setDbPin] = useState<string | null>(null)
  const [isPinModalVisible, setIsPinModalVisible] = useState(false)
  const [pinInput, setPinInput] = useState("")
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null)

  const fetchInitialData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
        if (profile) {
          setUserData(profile)
          setUserRole(profile.role)
          if (profile.preferred_stations?.length > 0) setPreferredStations(profile.preferred_stations)
        }
      }

      // Explicitly fetch PIN from 'update_pin' table, first row
      const { data: pinData, error: pinError } = await supabase
        .from("update_pin")
        .select("pin")
        .limit(1)
        .maybeSingle()
      
      if (pinData && !pinError) {
        // Convert to string and trim any hidden whitespace/newlines
        const fetchedPin = String(pinData.pin).trim()
        setDbPin(fetchedPin)
      }

      const { data: stations } = await supabase.from('fuel_stations').select('brand')
      if (stations) {
        const uniqueBrands = Array.from(new Set(stations.map(s => s.brand))).sort()
        setFuelOptions(uniqueBrands)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchInitialData() }, [])

  const handleAdminPress = (screenName: string) => {
    setPendingNavigation(screenName)
    setPinInput("")
    setIsPinModalVisible(true)
  }

  const verifyPin = () => {
    // Compare trimmed strings
    if (dbPin && pinInput.trim() === dbPin) {
      setIsPinModalVisible(false)
      if (pendingNavigation) (navigation as any).navigate(pendingNavigation)
    } else {
      Alert.alert("Access Denied", "Incorrect Admin PIN")
      setPinInput("")
    }
  }

  const onRefresh = () => {
    setRefreshing(true)
    fetchInitialData()
  }

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
    if (filtered.includes(opt)) {
      const next = filtered.filter(s => s !== opt)
      setTempPreferredStations(next.length === 0 ? ["None"] : next)
    } else {
      if (filtered.length >= 5) {
        Alert.alert("Limit Reached", "Max 5 stations.")
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
        await supabase.from('users').update({ preferred_stations: tempPreferredStations }).eq('id', user.id)
        setPreferredStations([...tempPreferredStations])
        setFuelPickerOpen(false)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  const filteredOptions = useMemo(() => fuelOptions.filter(opt => opt.toLowerCase().includes(searchQuery.toLowerCase())), [fuelOptions, searchQuery])

  const getInitials = (name: string) => {
    if (!name) return "JD"
    const parts = name.split(" ")
    return parts.length >= 2 ? (parts[0][0] + parts[1][0]).toUpperCase() : name.substring(0, 2).toUpperCase()
  }

  if (loading && !refreshing) {
    return <Screen style={{ justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={colors.palette.primary500} /></Screen>
  }

  return (
    <Screen safeAreaEdges={["top"]} contentContainerStyle={themed($container)}>
      {!userData ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <EmptyState preset="generic" heading="Connection Error" button="Refresh" buttonOnPress={onRefresh} />
        </ScrollView>
      ) : (
        <ScrollView style={themed($subContainer)} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={themed($heroSection)}>
            <View style={$profileHeader}>
              <View style={$avatarCircle}><Text style={themed($avatarText)} text={getInitials(userData?.full_name)} size="xl" weight="bold"/></View>
              <View style={$nameContainer}>
                <View style={$tierRow}>
                  <Text preset="subheading" weight="bold" style={themed($profileText)}>{userData?.full_name}</Text>
                  <Image source={require("@assets/icons/download/medal-gold.png")} style={{ width: 30, height: 30, marginLeft: 8 }} resizeMode="contain" />
                </View>
                <Text style={themed($subtext)}>{userData?.phone || "No phone number"}</Text>
              </View>
            </View>
            <View style={themed($statsCard)}>
              <View style={$statBox}><Text weight="bold" style={$statValue}>{userData?.no_contributions || 0}</Text><Text size="xxs" style={$statLabel}>CONTRIBUTIONS</Text></View>
              <View style={$statDivider} />
              <View style={$statBox}><Text weight="bold" style={$statValue}>{userData?.no_likes || 0}</Text><Text size="xxs" style={$statLabel}>LIKES</Text></View>
            </View>
          </View>

          <Text preset="formLabel" style={$sectionHeader}>ACCOUNT</Text>
          <View style={themed($insetGroup)}>
            <ListItem text="Account Settings" onPress={() => navigation.navigate("AccountSettings")} rightIcon="caretRight" style={themed($listItemStyle)} />
            <View style={themed($separator)} />
            <ListItem text="Privacy Policy" onPress={() => navigation.navigate("PrivacyPolicy")} rightIcon="caretRight" style={themed($listItemStyle)} />
            <View style={themed($separator)} />
            <ListItem text="Terms And Conditions" onPress={() => navigation.navigate("TermsAndConditions")} rightIcon="caretRight" style={themed($listItemStyle)} />
          </View>

          <Text preset="formLabel" style={$sectionHeader}>APP SETTINGS</Text>
          <View style={themed($insetGroup)}>
            <ListItem text="Preferred Stations" onPress={openFuelPicker} rightIcon="caretRight" style={themed($listItemStyle)} />
            <View style={themed($separator)} />
            <ListItem text="Dark Mode" RightComponent={<Switch value={themeContext === "dark"} onValueChange={toggleTheme} />} style={themed($listItemStyle)} />
            <View style={themed($separator)} />
            <ListItem text="Version" style={themed($listItemStyle)} RightComponent={<Text size="xs">{Application.nativeApplicationVersion}</Text>} />
          </View>

          {userRole?.toLowerCase() === "admin" && (
            <>
              <Text preset="formLabel" style={$sectionHeader}>ADMIN WORKS</Text>
              <View style={themed($insetGroup)}>
                <ListItem 
                  text="Update Oil Price Forecast" 
                  onPress={() => handleAdminPress("UpdateOilPriceForecast")} 
                  rightIcon="caretRight" 
                  style={themed($listItemStyle)} 
                />
              </View>
            </>
          )}

          <View style={$footer}>
            <Button style={themed($logoutButton)} text="Log Out" onPress={logout} textStyle={{color: 'red'}} />
          </View>
        </ScrollView>
      )}

      {/* PIN MODAL */}
      <Modal visible={isPinModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : undefined} 
          style={$modalOverlay}
        >
          <View style={themed($pinModalContent)}>
            <Text preset="subheading" text="Admin Confirmation" />
            <TextInput
              style={themed($pinInput)}
              value={pinInput}
              onChangeText={setPinInput}
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Button text="Cancel" onPress={() => setIsPinModalVisible(false)} style={{ flex: 1 }} />
              <Button text="Verify" onPress={verifyPin} style={{ flex: 1, backgroundColor: colors.palette.primary500 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* FUEL PICKER MODAL */}
      <Modal visible={isFuelPickerOpen} transparent animationType="slide">
        <Pressable style={$modalOverlay} onPress={() => setFuelPickerOpen(false)}>
          <Pressable style={themed($modalContent)}>
            <View style={$modalHeader}>
              <Text preset="subheading">Select Stations</Text>
              <Pressable onPress={() => setFuelPickerOpen(false)}><Icon icon="close" size={24} /></Pressable>
            </View>
            <View style={$searchContainer}>
              <Icon icon="search" size={18} style={{ marginRight: 8 }} /><TextInput style={$searchInput} placeholder="Search..." value={searchQuery} onChangeText={setSearchQuery} />
            </View>
            <View style={$fixedListContainer}>
              <ScrollView>{filteredOptions.map(opt => (
                  <Pressable key={opt} onPress={() => handleToggleTempFuel(opt)} style={$modalOption}>
                    <Text style={tempPreferredStations.includes(opt) ? { color: colors.tint, fontWeight: 'bold' } : {}}>{opt}</Text>
                    {tempPreferredStations.includes(opt) && <Icon icon="check" size={18} color={colors.tint} />}
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <Button text="Cancel" onPress={() => setFuelPickerOpen(false)} style={{ flex: 1 }} />
              <Button text="Save" onPress={handleSaveStations} style={{ flex: 1, backgroundColor: colors.palette.primary500 }} disabled={isSaving} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = () => ({ flex: 1 })
const $subContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({ paddingHorizontal: spacing.md, flex: 1 })
const $heroSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({ marginBottom: spacing.lg, backgroundColor: "#1737ba", paddingTop: 50, height: 250, marginHorizontal: -spacing.md, paddingHorizontal: spacing.md })
const $profileText: ThemedStyle<TextStyle> = () => ({ color: "#fff" })
const $subtext: ThemedStyle<TextStyle> = () => ({ color: "#fff", fontSize: 14 })
const $statsCard: ThemedStyle<ViewStyle> = ({ colors }) => ({ flexDirection: "row", backgroundColor: colors.palette.neutral800, borderRadius: 16, padding: 16 })
const $profileHeader: ViewStyle = { flexDirection: "row", alignItems: "center", marginBottom: 20 }
const $avatarCircle: ViewStyle = { width: 64, height: 64, borderRadius: 32, backgroundColor: "white", marginRight: 16, alignItems: "center", justifyContent: "center" }
const $avatarText: ThemedStyle<TextStyle> = () => ({ color: "blue" })
const $nameContainer: ViewStyle = { flex: 1 }
const $tierRow: ViewStyle = { flexDirection: "row", alignItems: "center" }
const $statBox: ViewStyle = { flex: 1, alignItems: "center" }
const $statValue: TextStyle = { color: "white", fontSize: 20 }
const $statLabel: TextStyle = { color: "#999", marginTop: 4 }
const $statDivider: ViewStyle = { width: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: 4 }
const $sectionHeader: TextStyle = { fontSize: 12, letterSpacing: 1, opacity: 0.5, marginBottom: 8, marginLeft: 4, marginTop: 20 }
const $insetGroup: ThemedStyle<ViewStyle> = ({ colors }) => ({ backgroundColor: colors.background, borderRadius: 12, overflow: "hidden", borderWidth: HAIRLINE, borderColor: colors.palette.neutral300, marginBottom: 10 })
const $listItemStyle: ThemedStyle<ViewStyle> = ({ colors }) => ({ borderBottomWidth: HAIRLINE, borderBottomColor: colors.palette.neutral300, paddingHorizontal: 16, alignItems: "center" })
const $separator: ThemedStyle<ViewStyle> = ({ colors }) => ({ height: HAIRLINE, backgroundColor: colors.palette.neutral300 })
const $footer: ViewStyle = { marginTop: 10, marginBottom: 40 }
const $logoutButton: ThemedStyle<ViewStyle> = () => ({ backgroundColor: "transparent", borderColor: "red", borderWidth: 2, marginTop: 10 })
const $modalOverlay: ViewStyle = { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }
const $pinModalContent: ThemedStyle<ViewStyle> = ({ colors }) => ({ backgroundColor: colors.background, width: '80%', borderRadius: 20, padding: 24, alignItems: 'center' })
const $pinInput: ThemedStyle<TextStyle> = ({ colors }) => ({ backgroundColor: colors.palette.neutral100, borderRadius: 12, width: '100%', height: 60, textAlign: 'center', fontSize: 24, marginTop: 20, letterSpacing: 10, color: colors.text, borderWidth: 1, borderColor: colors.palette.neutral300 })
const $modalContent: ThemedStyle<ViewStyle> = ({ colors }) => ({ backgroundColor: colors.background, width: '85%', borderRadius: 16, padding: 20 })
const $modalHeader: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }
const $searchContainer: ViewStyle = { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 10, paddingHorizontal: 10, marginBottom: 16, height: 45 }
const $searchInput: TextStyle = { flex: 1, height: '100%', color: 'black', fontSize: 14 }
const $fixedListContainer: ViewStyle = { height: 350 }
const $modalOption: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: HAIRLINE, borderBottomColor: '#ccc' }