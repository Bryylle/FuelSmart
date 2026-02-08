import { FC, useState } from "react"
import { ViewStyle, ActivityIndicator, Alert, TouchableOpacity, View } from "react-native"
import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { supabase } from "@/services/supabase"

interface RegisterScreenProps extends AppStackScreenProps<"Register"> {}

export const RegisterScreen: FC<RegisterScreenProps> = ({ navigation }) => {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const { themed, theme: { colors, spacing } } = useAppTheme()

  async function handleRegister() {
    if (!email || !password || !phone || !firstName || !lastName) {
      Alert.alert("Error", "Please fill in all fields.")
      return
    }

    setIsLoading(true)
    try {
      let formattedPhone = phone.trim()
      if (!formattedPhone.startsWith("+")) {
        const clean = formattedPhone.startsWith("0") ? formattedPhone.slice(1) : formattedPhone
        formattedPhone = `+63${clean}`
      }

      // Trigger handles the profile insert automatically via metadata
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            phone: formattedPhone,
            firstname: firstName,
            lastname: lastName,
          }
        }
      })

      if (error) throw error

      Alert.alert("Success", "Account created! Please log in.")
      navigation.navigate("Login")

    } catch (err: any) {
      Alert.alert("Registration Error", err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Screen preset="auto" contentContainerStyle={themed($container)} safeAreaEdges={["top", "bottom"]}>
      <Text text="Create Account" preset="heading" style={{ marginBottom: spacing.lg }} />
      <TextField label="First Name" value={firstName} onChangeText={setFirstName} placeholder="Juan" containerStyle={{ marginBottom: spacing.md }} />
      <TextField label="Last Name" value={lastName} onChangeText={setLastName} placeholder="Dela Cruz" containerStyle={{ marginBottom: spacing.md }} />
      <TextField label="Phone Number" value={phone} onChangeText={setPhone} placeholder="09123456789" keyboardType="phone-pad" containerStyle={{ marginBottom: spacing.md }} />
      <TextField label="Email" value={email} onChangeText={setEmail} placeholder="email@example.com" keyboardType="email-address" autoCapitalize="none" containerStyle={{ marginBottom: spacing.md }} />
      <TextField label="Password" value={password} onChangeText={setPassword} placeholder="Min 6 characters" secureTextEntry containerStyle={{ marginBottom: spacing.xl }} />
      <Button style={themed($btn)} preset="reversed" onPress={handleRegister} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="white" /> : <Text text="Sign Up" style={{ color: 'white', fontWeight: 'bold' }} />}
      </Button>
      <View style={$footer}>
        <Text text="Already have an account? " size="xs" />
        <TouchableOpacity onPress={() => navigation.navigate("Login")}>
          <Text text="Log In" size="xs" style={{ color: colors.palette.primary500, fontWeight: 'bold' }} />
        </TouchableOpacity>
      </View>
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({ padding: spacing.lg })
const $btn: ThemedStyle<ViewStyle> = ({ spacing }) => ({ marginTop: spacing.md, height: 56, justifyContent: 'center' })
const $footer: ViewStyle = { flexDirection: 'row', justifyContent: 'center', marginTop: 30, paddingBottom: 50 }