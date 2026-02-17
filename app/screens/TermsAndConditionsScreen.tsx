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

export const TermsAndConditionsScreen: FC<DemoTabScreenProps<"TermsAndConditions">> = ({ navigation }) => {
  const { themed, theme } = useAppTheme()
  const { height: screenHeight } = useWindowDimensions()
  const [scrollOffset, setScrollOffset] = useState(0)
  
  const scrollRef = useRef<ScrollView | null>(null);

  const setScrollRef = useCallback((node: ScrollView | null) => {
    scrollRef.current = node;
  }, []);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const handleScroll = (event: any) => {
    setScrollOffset(event.nativeEvent.contentOffset.y)
  }

  const isScrollButtonVisible = scrollOffset > screenHeight / 2

  return (
    <View style={$container}>
      <Screen
        preset="scroll"
        ScrollViewProps={
          {
            keyboardShouldPersistTaps: "handled",
            ref: setScrollRef,
            onScroll: handleScroll,
            scrollEventThrottle: 16,
          } as any
        }
      >

      <Header
        title="Terms and Conditions"
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
        <Text preset="subheading" style={{ marginBottom: 19 }}>TERMS AND CONDITIONS</Text>
        <Text size="xs" style={themed($lastUpdatedText)}>Last Updated: [Insert Date]</Text>

        <Text style={themed($paragraph)}>
          Welcome to **[Insert App Name]** (the "App"). By downloading, accessing, or using the App, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the service.
        </Text>

        <Text preset="bold" style={themed($sectionTitle)}>1. Description of Service</Text>
        <Text style={themed($paragraph)}>
          The App provides a platform for users to view fuel station locations, crowd-sourced fuel prices, and fuel price forecasts. It includes tools such as a trip cost calculator and allows users to contribute data by pinning new stations or updating fuel prices.
        </Text>

        <Text preset="bold" style={themed($sectionTitle)}>2. User Accounts and Privacy</Text>
        <View style={themed($bulletList)}>
          <Text style={themed($bulletItem)}>**Registration:** To access certain features, you must register for an account. You are responsible for maintaining the confidentiality of your credentials.</Text>
          <Text style={themed($bulletItem)}>**Data Privacy:** Your use of the App is also governed by our Privacy Policy.</Text>
          <Text style={themed($bulletItem)}>**Display Preferences:** When you update a price, your identity (Alias or Real Name) will be displayed based on your selected privacy settings within the App.</Text>
        </View>

        <Text preset="bold" style={themed($sectionTitle)}>3. Crowdsourced Data and Accuracy Disclaimer</Text>
        <View style={themed($bulletList)}>
          <Text style={themed($bulletItem)}>**"As-Is" Basis:** All information provided within the App—including fuel prices, station locations, and Facebook-linked forecasts—is provided on an "as-is" and "as-available" basis.</Text>
          <Text style={themed($bulletItem)}>**No Guarantee of Accuracy:** Because data is submitted by other users (crowdsourced), it may be outdated, incomplete, or inaccurate. The App does not verify the 100% accuracy of user-submitted data.</Text>
          <Text style={themed($bulletItem)}>**Price Discrepancies:** The App is a community tool and not a real-time official price ticker. We are not responsible for any discrepancies between the price displayed in the App and the actual price at the fuel pump.</Text>
        </View>

        <Text preset="bold" style={themed($sectionTitle)}>4. Limitation of Liability</Text>
        <Text style={themed($paragraph)}>
          To the maximum extent permitted by law, **[Insert App Name/Company Name]** shall not be held liable for:
        </Text>
        <View style={themed($bulletList)}>
          <Text style={themed($bulletItem)}>Any financial loss resulting from reliance on the fuel price data or trip cost calculator.</Text>
          <Text style={themed($bulletItem)}>Inconveniences or costs incurred (such as travel time or fuel consumption) due to inaccurate station locations or pricing.</Text>
          <Text style={themed($bulletItem)}>Any indirect, incidental, or consequential damages arising from your use of the App.</Text>
        </View>

        <Text preset="bold" style={themed($sectionTitle)}>5. User Conduct and Restrictions</Text>
        <Text style={themed($paragraph)}>
          Users are expected to contribute honestly and ethically. We reserve the right to ban accounts or restrict the ability to update/add stations if a user is found:
        </Text>
        <View style={themed($bulletList)}>
          <Text style={themed($bulletItem)}>Exploiting the App or its data for commercial gain.</Text>
          <Text style={themed($bulletItem)}>Providing intentionally false or misleading information.</Text>
          <Text style={themed($bulletItem)}>Abusing the App in an unethical or malicious manner.</Text>
          <Text style={themed($bulletItem)}>Violating any local laws or regulations.</Text>
        </View>

        <Text preset="bold" style={themed($sectionTitle)}>6. External Content</Text>
        <Text style={themed($paragraph)}>
          The App may display fuel price forecasts from third-party sources (e.g., Facebook). We do not control, endorse, or assume responsibility for the content, accuracy, or privacy practices of these external platforms.
        </Text>

        <Text preset="bold" style={themed($sectionTitle)}>7. Trip Cost Calculator</Text>
        <Text style={themed($paragraph)}>
          The estimated trip cost calculator is a tool for general estimation purposes only. Actual costs may vary based on driving habits, vehicle condition, traffic, and fluctuating fuel prices.
        </Text>

        <Text preset="bold" style={themed($sectionTitle)}>8. Account Deletion and Termination</Text>
        <Text style={themed($paragraph)}>
          Users may delete their accounts at any time through the App settings. We reserve the right to terminate or suspend access to the App without prior notice for any violation of these Terms.
        </Text>

        <Text preset="bold" style={themed($sectionTitle)}>9. Changes to Terms</Text>
        <Text style={themed($paragraph)}>
          We may update these Terms from time to time. Continued use of the App after changes are posted constitutes your acceptance of the new Terms.
        </Text>
        
        <Text preset="bold" style={themed($sectionTitle)}>Contact Us</Text>
        <Text style={themed($paragraph)}>
          If you have any questions regarding these Terms, please contact us at: **[Insert Contact Email]**
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