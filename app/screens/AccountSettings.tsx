import { FC, useState, useEffect } from "react"
import {
  Pressable,
  View,
  ViewStyle,
  TextStyle,
  PixelRatio,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from "react-native"
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import { Icon } from "@/components/Icon"
import { Switch } from "@/components/Toggle/Switch"
import { Header } from "@/components/Header"
import type { ThemedStyle } from "@/theme/types"
import { supabase } from "@/services/supabase"

const HAIRLINE = 1 / PixelRatio.get()

export const AccountSettingsScreen: FC<DemoTabScreenProps<"AccountSettings">> = ({ navigation }) => {
  const { themed, theme: { colors, spacing } } = useAppTheme()
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isModalVisible, setIsModalVisible] = useState(false)
  
  const [fullName, setFullName] = useState("")
  const [showName, setShowName] = useState<boolean>(true)
  const [showGcash, setShowGcash] = useState<boolean>(false)
  const [showMaya, setShowMaya] = useState<boolean>(false)
  const [phone, setPhone] = useState("") // Stores the 10 digits (e.g., 9171234567)
  const [tempPhone, setTempPhone] = useState("") 

  const [initialState, setInitialState] = useState({ 
    name: true, 
    gcash: false, 
    maya: false, 
    phone: "" 
  })

  useEffect(() => {
    fetchPrivacySettings()
  }, [])

  const fetchPrivacySettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('full_name, b_show_name, b_show_gcash, b_show_maya, phone')
          .eq('id', user.id)
          .single()
        
        if (profile) {
          setFullName(profile.full_name || "User")
          
          // Strip +63 for the local state if it exists
          const dbPhone = profile.phone || ""
          const cleanPhone = dbPhone.startsWith("+63") ? dbPhone.slice(3) : dbPhone

          const settings = {
            name: profile.b_show_name ?? true,
            gcash: profile.b_show_gcash ?? false,
            maya: profile.b_show_maya ?? false,
            phone: cleanPhone 
          }
          setShowName(settings.name)
          setShowGcash(settings.gcash)
          setShowMaya(settings.maya)
          setPhone(settings.phone)
          setInitialState(settings)
        }
      }
    } catch (e) {
      console.error("Error loading privacy:", e)
    } finally {
      setLoading(false)
    }
  }

  const handlePhoneChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, "")
    if (numericValue.length <= 10) {
      setTempPhone(numericValue)
    }
  }

  const handleModalConfirm = () => {
    if (tempPhone.length > 0 && tempPhone.length < 10) {
      Alert.alert("Invalid Number", "Please enter the 10 digits after +63.")
      return
    }
    setPhone(tempPhone)
    setIsModalVisible(false)
  }

  const handleGlobalSave = async () => {
    setIsSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Prepend +63 only if there is a number present
      const phoneWithPrefix = phone.length === 10 ? `+63${phone}` : phone

      const { error } = await supabase
        .from('users')
        .update({
          b_show_name: showName,
          b_show_gcash: showGcash,
          b_show_maya: showMaya,
          phone: phoneWithPrefix 
        })
        .eq('id', user.id)

      if (error) throw error
      
      setInitialState({ name: showName, gcash: showGcash, maya: showMaya, phone })
      Alert.alert("Success", "Settings updated.")
    } catch (e) {
      Alert.alert("Error", "Failed to save changes.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setShowName(initialState.name)
    setShowGcash(initialState.gcash)
    setShowMaya(initialState.maya)
    setPhone(initialState.phone)
  }

  const hasChanges = showName !== initialState.name || 
                   showGcash !== initialState.gcash || 
                   showMaya !== initialState.maya ||
                   phone !== initialState.phone

  return (
    <View style={{ flex: 1 }}>
      <Screen preset="scroll" contentContainerStyle={themed($screenContainer)}>
        <Header
          title="Account Settings"
          safeAreaEdges={["top"]}
          style={themed($headerStyle)}
          titleStyle={themed($headerTitle)}
          LeftActionComponent={
            <Pressable onPress={() => navigation.goBack()} style={$leftAction}>
              <Icon icon="arrowLeft" size={24} color="#fff" />
            </Pressable>
          }
        />

        {loading ? (
           <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.palette.primary500} />
        ) : (
          <View style={[themed($card), hasChanges && { marginBottom: 120 }]}>
            <Pressable 
              style={themed($footerItem)} 
              onPress={() => {
                setTempPhone(phone)
                setIsModalVisible(true)
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={themed($switchLabel)}>Change mobile number</Text>
                <Text size="xxs" style={themed($labelDim)}>
                  {phone ? `+63 ${phone}` : "No number added"}
                </Text>
              </View>
              <Icon icon="caretRight" size={20} />
            </Pressable>
            <View style={themed($divider)} />
            <View style={themed($indicatorSection)}>
              <Text size="xs" style={themed($labelDim)}>Shown to others as:</Text>
              <Text weight="semiBold" style={themed($valueText)}>
                {showName ? fullName : `${fullName.charAt(0)}*****`}
              </Text>
            </View>

            

            <View style={themed($controlsSection)}>
              <View style={themed($switchRow)}>
                <Text style={themed($switchLabel)}>Show my name</Text>
                <Switch value={showName} onValueChange={setShowName} />
              </View>

              <View style={themed($switchRow)}>
                <Text style={themed($switchLabel)}>Show my Gcash number</Text>
                <Switch value={showGcash} onValueChange={setShowGcash} />
              </View>

              <View style={themed($switchRow)}>
                <Text style={themed($switchLabel)}>Show my Maya number</Text>
                <Switch value={showMaya} onValueChange={setShowMaya} />
              </View>
            </View>
          </View>
        )}
      </Screen>

      {/* Input Modal */}
      <Modal transparent visible={isModalVisible} animationType="fade">
        <View style={$modalOverlay}>
          <View style={themed($modalContent)}>
            <Text preset="subheading" style={{ marginBottom: spacing.sm }}>Update Mobile Number</Text>
            <Text size="xs" style={[themed($labelDim), { marginBottom: spacing.md }]}>Enter the 10 digits after +63</Text>
            
            <View style={themed($phoneInputContainer)}>
              <Text style={themed($prefix)}>+63</Text>
              <TextInput
                style={themed($phoneInput)}
                value={tempPhone}
                onChangeText={handlePhoneChange}
                placeholder="9123456789"
                placeholderTextColor={colors.textDim}
                keyboardType="number-pad"
                autoFocus
                maxLength={10}
              />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.xl }}>
              <Button 
                text="Cancel" 
                onPress={() => setIsModalVisible(false)} 
                style={$modalCancelBtn}
                textStyle={{ color: colors.text }}
              />
              <Button 
                text="OK" 
                onPress={handleModalConfirm} 
                style={$modalOkBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Global Floating Action Bar */}
      {hasChanges && (
        <Animated.View 
          entering={FadeInDown} 
          exiting={FadeOutDown}
          style={[$floatingActionRow, { backgroundColor: colors.background }]}
        >
          <Button 
            text="Cancel" 
            onPress={handleCancel} 
            style={$cancelBtn} 
            textStyle={[$btnText, { color: colors.text }]} 
          />
          <Button 
            text={isSaving ? "Saving..." : "Save Changes"} 
            onPress={handleGlobalSave} 
            disabled={isSaving}
            style={$saveBtn}
            textStyle={[$btnText, { color: 'white' }]}
          />
        </Animated.View>
      )}
    </View>
  )
}

// Styles remain the same as previous professional version...
const $screenContainer: ThemedStyle<ViewStyle> = () => ({ flex: 1 })
const $headerStyle: ThemedStyle<ViewStyle> = () => ({ backgroundColor: "#1737ba" })
const $headerTitle: ThemedStyle<TextStyle> = () => ({ color: "#fff" })
const $leftAction: ViewStyle = { marginLeft: 16, justifyContent: "center" }
const $card: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.background, borderRadius: spacing.md, margin: spacing.md, padding: spacing.lg,
  elevation: 4, borderWidth: HAIRLINE, borderColor: colors.palette.neutral300,
})
const $indicatorSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({ marginBottom: spacing.md })
const $labelDim: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.textDim })
const $valueText: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.text, fontSize: 16, marginTop: 4 })
const $controlsSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({ marginBottom: spacing.xs })
const $switchRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm })
const $switchLabel: ThemedStyle<TextStyle> = ({ colors }) => ({ color: colors.text })
const $divider: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({ height: HAIRLINE, backgroundColor: colors.palette.neutral300, marginVertical: spacing.xs })
const $footerItem: ThemedStyle<ViewStyle> = ({ spacing }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.sm })
const $modalOverlay: ViewStyle = { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }
const $modalContent: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({ backgroundColor: colors.background, width: '85%', borderRadius: 16, padding: spacing.lg })
const $phoneInputContainer: ThemedStyle<ViewStyle> = ({ colors }) => ({ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: colors.palette.neutral300 })
const $prefix: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({ color: colors.text, fontSize: 16, paddingRight: spacing.xs, fontWeight: "600" })
const $phoneInput: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({ flex: 1, color: colors.text, paddingVertical: spacing.xs, fontSize: 16 })
const $modalOkBtn: ViewStyle = { backgroundColor: "#1737ba", borderRadius: 8, paddingHorizontal: 20, minWidth: 80, height: 40, borderWidth: 0 }
const $modalCancelBtn: ViewStyle = { backgroundColor: "#F2F2F7", borderRadius: 8, paddingHorizontal: 20, height: 40, borderWidth: 0 }
const $floatingActionRow: ViewStyle = { 
  position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingVertical: 24,
  borderTopWidth: HAIRLINE, borderTopColor: 'rgba(0,0,0,0.05)', shadowColor: '#000', elevation: 20,
}
const $btnText: TextStyle = { fontSize: 15, fontWeight: "700" }
const $saveBtn: ViewStyle = { flex: 2, borderRadius: 14, backgroundColor: "#1737ba", height: 54, borderWidth: 0 }
const $cancelBtn: ViewStyle = { flex: 1, borderRadius: 14, backgroundColor: "#F2F2F7", height: 54, borderWidth: 0 }