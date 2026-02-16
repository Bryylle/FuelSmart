import { FC, useState, useEffect } from "react"
import { ViewStyle, ActivityIndicator, Alert, View, Platform, TextStyle, Dimensions } from "react-native"
import * as Linking from "expo-linking"
import * as WebBrowser from "expo-web-browser"
import { FontAwesome } from "@expo/vector-icons"
import { useAuth } from "@/context/AuthContext"
import type { AppStackScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import { Text } from "@/components/Text"
import { Screen } from "@/components/Screen"
import { Button } from "@/components/Button"
import { supabase } from "@/services/supabase"

WebBrowser.maybeCompleteAuthSession()

const { width: SCREEN_WIDTH } = Dimensions.get("window")
const BRAND_BLUE = "#1737BA"
const ACCENT_TEAL = "#17BABA"

interface LoginScreenProps extends AppStackScreenProps<"Login"> {}

const OAUTH_REDIRECT_URL = Platform.OS === "web" 
  ? "http://localhost:8081" 
  : "fuel://auth/callback"

export const LoginScreen: FC<LoginScreenProps> = ({ navigation }) => {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const { setAuthToken } = useAuth()
  const { theme } = useAppTheme()
  const { spacing, colors } = theme

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      const { data } = await supabase.auth.getSession()
      if (data?.session) {
        setAuthToken(data.session.access_token)
      }
      setIsGoogleLoading(false)
    }

    const subscription = Linking.addEventListener("url", (event) => {
      handleDeepLink(event.url)
    })

    return () => subscription.remove()
  }, [setAuthToken])

  const extractParam = (url: string, param: string) => {
    const match = url.match(new RegExp(`${param}=([^&]+)`))
    return match ? match[1] : ""
  }

  async function loginWithGoogle() {
    setIsGoogleLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: OAUTH_REDIRECT_URL,
          skipBrowserRedirect: false, 
        },
      })

      if (error) throw error

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, OAUTH_REDIRECT_URL)
        
        if (result.type === "success" && result.url) {
          const { data: sessionData } = await supabase.auth.setSession({
            access_token: extractParam(result.url, "access_token"),
            refresh_token: extractParam(result.url, "refresh_token"),
          })
          if (sessionData.session) setAuthToken(sessionData.session.access_token)
        }
      }
    } catch (err: any) {
      Alert.alert("Login Error", err.message)
    } finally {
      setIsGoogleLoading(false)
    }
  }

  // --- STYLES DEFINED INSIDE TO ACCESS THEME DIRECTLY ---
  const $screenContainer: ViewStyle = { flex: 1, backgroundColor: "#080A0F" }
  
  const $glowOrb: ViewStyle = {
    position: 'absolute', top: -100, right: -50, width: SCREEN_WIDTH * 0.8, height: SCREEN_WIDTH * 0.8,
    borderRadius: SCREEN_WIDTH, backgroundColor: BRAND_BLUE, opacity: 0.12,
  }

  const $accentSquare: ViewStyle = {
    position: 'absolute', bottom: '15%', left: -20, width: 100, height: 100, borderRadius: 20,
    backgroundColor: ACCENT_TEAL, opacity: 0.08, transform: [{ rotate: '45deg' }]
  }

  const $mainContent: ViewStyle = {
    flex: 1, justifyContent: "center", paddingHorizontal: spacing.xl, zIndex: 1,
  }

  const $headerSection: ViewStyle = { alignItems: "center", marginBottom: 50 }

  const $brandTitle: TextStyle = {
    fontSize: 48, fontWeight: "900", color: "#FFFFFF", letterSpacing: -1, textAlign: "center",
  }

  const $tagline: TextStyle = {
    marginTop: 8, fontSize: 17, color: "#94A3B8", textAlign: "center",
  }

  const $actionSection: ViewStyle = { width: "100%", gap: 14 }

  const $buttonInner: ViewStyle = { flexDirection: "row", alignItems: "center", justifyContent: "center", width: "100%" }

  const $googleButton: ViewStyle = { 
    height: 60, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 0, 
  }

  const $googleButtonText: TextStyle = { color: "#0F172A", fontWeight: "700", fontSize: 15 }

  const $facebookButton: ViewStyle = {
    height: 60, borderRadius: 16, backgroundColor: "#1877F2", borderWidth: 0,
  }

  const $facebookButtonText: TextStyle = { color: "#FFFFFF", fontWeight: "700", fontSize: 15 }

  const $footerSection: ViewStyle = { paddingBottom: spacing.xl, paddingHorizontal: spacing.xl }

  const $legalText: TextStyle = { color: "#475569", textAlign: "center", lineHeight: 18 }

  const $link: TextStyle = { color: "#94A3B8", fontWeight: "700", textDecorationLine: 'underline' }

  return (
    <Screen preset="fixed" contentContainerStyle={$screenContainer} safeAreaEdges={["top", "bottom"]}>
      <View style={$glowOrb} />
      <View style={$accentSquare} />

      <View style={$mainContent}>
        <View style={$headerSection}>
          <Text text="Fuel Smart" preset="heading" style={$brandTitle} />
          <Text text="Navigate smarter.&#10;Save faster." style={$tagline} />
        </View>

        <View style={$actionSection}>
          <Button 
            style={$googleButton} 
            onPress={loginWithGoogle} 
            disabled={isGoogleLoading}
          >
            <View style={$buttonInner}>
              {isGoogleLoading ? (
                <ActivityIndicator color={BRAND_BLUE} />
              ) : (
                <>
                  <FontAwesome name="google" size={20} color="#EA4335" style={{ marginRight: 12 }} />
                  <Text text="Continue with Google" style={$googleButtonText} />
                </>
              )}
            </View>
          </Button>

          <Button 
            style={$facebookButton} 
            onPress={() => Alert.alert("Coming Soon", "Facebook integration in progress.")}
          >
            <View style={$buttonInner}>
              <FontAwesome name="facebook-official" size={20} color="#FFFFFF" style={{ marginRight: 12 }} />
              <Text text="Continue with Facebook" style={$facebookButtonText} />
            </View>
          </Button>
        </View>
      </View>

      <View style={$footerSection}>
        <Text size="xxs" style={$legalText}>
          By continuing, you agree to our{" "}
          <Text text="Terms" size="xxs" style={$link} onPress={() => navigation.navigate("TermsAndConditions")} />
          {" and "}
          <Text text="Privacy Policy" size="xxs" style={$link} onPress={() => navigation.navigate("Privacy")} />.
        </Text>
      </View>
    </Screen>
  )
}