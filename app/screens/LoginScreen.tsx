import { FC, useState } from "react"
import { ViewStyle, ActivityIndicator, Alert, TouchableOpacity, View } from "react-native"
import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useAuth } from "@/context/AuthContext"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { supabase } from "@/services/supabase"

interface LoginScreenProps extends AppStackScreenProps<"Login"> {}

export const LoginScreen: FC<LoginScreenProps> = ({ navigation }) => {
  const [authPassword, setAuthPassword] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  const { authPhone, setAuthPhone, setAuthToken, validationError } = useAuth()
  const { themed, theme: { colors, spacing } } = useAppTheme()

  async function login() {
    setIsSubmitted(true)
    if (validationError) return

    setIsLoading(true)
    try {
      let formattedPhone = (authPhone || "").trim()
      if (!formattedPhone.startsWith("+")) {
        const clean = formattedPhone.startsWith("0") ? formattedPhone.slice(1) : formattedPhone
        formattedPhone = `+63${clean}`
      }

      // Lookup email by phone in the public users table
      const { data: userRow, error: fetchError } = await supabase
        .from("users")
        .select("email")
        .eq("phone", formattedPhone)
        .maybeSingle()

      if (fetchError || !userRow) throw new Error("Account not found. Please register first.")

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: userRow.email,
        password: authPassword,
      })

      if (authError) throw authError

      if (authData.session) {
        setAuthPhone(formattedPhone)
        setAuthToken(authData.session.access_token) // Use real JWT
      }
      
    } catch (err: any) {
      Alert.alert("Login Failed", err.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Screen preset="auto" contentContainerStyle={themed($container)} safeAreaEdges={["top", "bottom"]}>
      <Text text="Log In" preset="heading" />
      <TextField 
        value={authPhone} 
        onChangeText={setAuthPhone} 
        label="Phone" 
        placeholder="09XXXXXXXXX" 
        helper={isSubmitted ? validationError : ""} 
        status={isSubmitted && validationError ? "error" : undefined} 
      />
      <TextField value={authPassword} onChangeText={setAuthPassword} label="Password" secureTextEntry containerStyle={{ marginTop: spacing.md }} />
      <Button style={themed($btn)} preset="reversed" onPress={login} disabled={isLoading}>
        {isLoading ? <ActivityIndicator color="white" /> : <Text text="Login" style={{ color: 'white', fontWeight: 'bold' }} />}
      </Button>
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text text="No account? Sign Up" size="xs" style={{ color: colors.palette.primary500, fontWeight: 'bold' }} />
        </TouchableOpacity>
      </View>
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({ padding: spacing.lg })
const $btn: ThemedStyle<ViewStyle> = ({ spacing }) => ({ marginTop: spacing.xl, height: 56, justifyContent: 'center' })