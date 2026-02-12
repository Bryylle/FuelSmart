import { FC, useCallback, useMemo, useState } from "react"
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TextInput,
  View,
  ViewStyle,
  TextStyle,
} from "react-native"
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated"

import { Button } from "@/components/Button"
import { Card } from "@/components/Card"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import { $styles } from "@/theme/styles"
import type { ThemedStyle } from "@/theme/types"
import { delay } from "@/utils/delay"
import { Icon } from "@/components/Icon"
import { colors } from "@/theme/colors"
import { Switch } from "@/components/Toggle/Switch"
import { Header } from "@/components/Header"

export const PrivacyScreen: FC<DemoTabScreenProps<"Privacy">> = ({ navigation }) => {
  const { setThemeContextOverride, themeContext, themed } = useAppTheme()
  const [showFirstNameOnly, setShowFirstNameOnly] = useState<boolean>(false)
  const [showGcash, setShowGcash] = useState<boolean>(false)
  const [showMaya, setShowMaya] = useState<boolean>(false)

  return (
    <Screen  contentContainerStyle={$styles.flex1}>
      <Header
        title="Privacy"
        safeAreaEdges={["top"]}
        LeftActionComponent={
        <View style={$leftActionWrapper}>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityLabel="Go back"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Icon icon="back" size={24} color={"#fff"} />
          </Pressable>
        </View>
        }
        style={themed($headerStyle)}
        titleStyle={themed($headerTitle)}
      />
      <View style={themed($screenContainer)}>
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
      </View>
    </Screen>
  )
}

// #region Styles
const $headerStyle: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: "#1737ba",
  color: "#fff",
})

const $headerTitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: "#fff",
})
const $leftActionWrapper: ViewStyle = {
  position: "relative",
  justifyContent: "center",
  alignItems: "center",
  marginLeft: 16,
}
const $screenContainer: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
    padding: spacing.md,
})
const $divider: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
//   height: HAIRLINE,
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
// #endregion

