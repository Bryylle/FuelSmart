import React, { FC, useRef, useCallback, useState } from "react"
import {
  Pressable,
  View,
  ViewStyle,
  TextStyle,
  ScrollView,
  useWindowDimensions,
} from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { Icon } from "@/components/Icon"
import { Header } from "@/components/Header"

export const PrivacyPolicyScreen: FC<DemoTabScreenProps<"PrivacyPolicy">> = ({ navigation }) => {
  const { themed, theme } = useAppTheme()
  const { height: screenHeight } = useWindowDimensions()
  const [scrollOffset, setScrollOffset] = useState(0)
  
  const scrollRef = useRef<ScrollView | null>(null)

  const setScrollRef = useCallback((node: ScrollView | null) => {
    scrollRef.current = node
  }, [])

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true })
  }

  const handleScroll = (event: any) => {
    setScrollOffset(event.nativeEvent.contentOffset.y)
  }

  // Button appears when scrolled more than half the screen height
  const isScrollButtonVisible = scrollOffset > screenHeight / 2

  return (
    <View style={$container}>
      <Screen
        preset="scroll"
        ScrollViewProps={{
          keyboardShouldPersistTaps: "handled",
          ref: setScrollRef,
          onScroll: handleScroll,
          scrollEventThrottle: 16,
        } as any}
      >
        <Header
          title="Privacy Policy"
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

        <View style={themed($contentWrapper)}>
          <Text preset="subheading" style={{ marginBottom: 19 }}>PRIVACY POLICY [cite: 1]</Text>
          <Text size="xs" style={themed($lastUpdatedText)}>Last Updated: [Insert Date] [cite: 2]</Text>

          <Text style={themed($paragraph)}>
            [Insert App Name] ("we," "us," or "our") is committed to protecting your privacy[cite: 3]. 
            This Privacy Policy explains how we collect, use, and safeguard your information when you use our mobile application[cite: 4].
          </Text>

          <Text preset="bold" style={themed($sectionTitle)}>1. Information We Collect [cite: 5]</Text>
          <View style={themed($bulletList)}>
            <Text style={themed($bulletItem)}>• **Account Information:** Email address, username, and password provided during registration[cite: 7].</Text>
            <Text style={themed($bulletItem)}>• **User-Contributed Content:** Fuel prices, station locations, and markers you add to the map[cite: 8].</Text>
            <Text style={themed($bulletItem)}>• **Profile Preferences:** Your choice to display an Alias or Real Name when contributing data[cite: 9].</Text>
            <Text style={themed($bulletItem)}>• **Location Data:** We may access your device's precise or approximate location to show nearby fuel stations[cite: 10].</Text>
            <Text style={themed($bulletItem)}>• **Calculator Inputs:** Data entered into the trip cost calculator is processed locally[cite: 11].</Text>
          </View>

          <Text preset="bold" style={themed($sectionTitle)}>2. How We Use Your Information [cite: 12]</Text>
          <View style={themed($bulletList)}>
            <Text style={themed($bulletItem)}>• To operate and maintain the interactive fuel station map[cite: 14].</Text>
            <Text style={themed($bulletItem)}>• To display contributor names/aliases alongside price updates based on settings[cite: 15].</Text>
            <Text style={themed($bulletItem)}>• To identify and prevent fraudulent activity or unethical use of the platform[cite: 16].</Text>
            <Text style={themed($bulletItem)}>• To improve App functionality and user experience[cite: 17].</Text>
          </View>

          <Text preset="bold" style={themed($sectionTitle)}>3. Data Sharing and Public Display [cite: 18]</Text>
          <Text style={themed($paragraph)}>
            When you update a price or add a marker, the name/alias you selected will be visible to all App users[cite: 19]. 
            Our dashboard displays fuel price forecasts via Facebook; interacting with this content may involve data collection by Meta[cite: 20, 21].
          </Text>

          <Text preset="bold" style={themed($sectionTitle)}>4. Your Privacy Choices [cite: 23]</Text>
          <View style={themed($bulletList)}>
            <Text style={themed($bulletItem)}>• **Identity Control:** Switch between displaying your Real Name or an Alias at any time in settings[cite: 24].</Text>
            <Text style={themed($bulletItem)}>• **Location Permissions:** Enable or disable location services through device settings[cite: 25].</Text>
            <Text style={themed($bulletItem)}>• **Account Deletion:** You may delete your account and associated personal data at any time via the App[cite: 26].</Text>
          </View>

          <Text preset="bold" style={themed($sectionTitle)}>5. Security [cite: 27]</Text>
          <Text style={themed($paragraph)}>
            We implement reasonable security measures to protect your personal information[cite: 28]. 
            However, please be aware that no transmission over the internet or mobile network is 100% secure[cite: 29].
          </Text>

          <Text preset="bold" style={themed($sectionTitle)}>6. Changes to This Policy [cite: 30]</Text>
          <Text style={themed($paragraph)}>
            We may update this Privacy Policy periodically. We will notify you of any material changes by posting the new policy within the App[cite: 31].
          </Text>

          <Text preset="bold" style={themed($sectionTitle)}>Contact Us [cite: 32]</Text>
          <Text style={themed($paragraph)}>
            For questions regarding your data, contact us at: **[Insert Contact Email]** [cite: 33]
          </Text>
        </View>
      </Screen>

      {isScrollButtonVisible && (
        <Pressable 
          onPress={scrollToTop} 
          style={[$fab, { backgroundColor: theme.colors.palette.primary500 }]}
        >
          <Icon icon="caretUp" size={24} color="#fff" />
        </Pressable>
      )}
    </View>
  )
}

// #region Styles
const $container: ViewStyle = {
  flex: 1,
}

const $headerStyle: ThemedStyle<ViewStyle> = () => ({
  backgroundColor: "#1737ba",
})

const $headerTitle: ThemedStyle<TextStyle> = () => ({
  color: "#fff",
})

const $leftActionWrapper: ViewStyle = {
  justifyContent: "center",
  alignItems: "center",
  marginLeft: 16,
}

const $contentWrapper: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.md,
  paddingBottom: spacing.xxl,
})

const $paragraph: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginVertical: spacing.sm,
  lineHeight: 20,
})

const $lastUpdatedText: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  marginBottom: spacing.md,
})

const $sectionTitle: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginTop: spacing.md,
  marginBottom: spacing.xs,
  fontSize: 16,
})

const $bulletList: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginLeft: spacing.md,
})

const $bulletItem: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginVertical: spacing.xs,
})

const $fab: ViewStyle = {
  position: "absolute",
  bottom: 24,
  right: 24,
  width: 48,
  height: 48,
  borderRadius: 24,
  justifyContent: "center",
  alignItems: "center",
  elevation: 5,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
}
// #endregion