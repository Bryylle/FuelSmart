import { FC, useCallback, useState } from "react"
import {
  Pressable,
  View,
  ViewStyle,
  TextStyle,
  PixelRatio,
} from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import { Icon } from "@/components/Icon"
import { Switch } from "@/components/Toggle/Switch"
import { Header } from "@/components/Header"
import type { ThemedStyle } from "@/theme/types"

const HAIRLINE = 1 / PixelRatio.get()

export const PrivacyScreen: FC<DemoTabScreenProps<"Privacy">> = ({ navigation }) => {
  const { themed } = useAppTheme()
  const [showFirstNameOnly, setShowFirstNameOnly] = useState<boolean>(false)
  const [showGcash, setShowGcash] = useState<boolean>(false)
  const [showMaya, setShowMaya] = useState<boolean>(false)

  const onPressPrivacyDetail = useCallback(() => {
    // Navigate to sub-policy if needed
  }, [])

  return (
    <Screen preset="scroll" contentContainerStyle={themed($screenContainer)}>
      <Header
        title="Privacy"
        safeAreaEdges={["top"]}
        style={themed($headerStyle)}
        titleStyle={themed($headerTitle)}
        LeftActionComponent={
          <Pressable onPress={() => navigation.goBack()} style={$leftAction}>
            <Icon icon="arrowLeft" size={24} color="#fff" />
          </Pressable>
        }
      />

      <View style={themed($card)}>
        {/* Status Section */}
        <View style={themed($indicatorSection)}>
          <Text size="xs" style={themed($labelDim)}>Shown to others as:</Text>
          <Text weight="semiBold" style={themed($valueText)}>
            {showFirstNameOnly ? "First name only" : "Full name"}
          </Text>
        </View>

        {/* Toggle Controls */}
        <View style={themed($controlsSection)}>
          <View style={themed($switchRow)}>
            <Text style={themed($switchLabel)}>Show my first name only</Text>
            <Switch value={showFirstNameOnly} onValueChange={setShowFirstNameOnly} />
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

        <View style={themed($divider)} />

        {/* Navigation Link */}
        <Pressable onPress={onPressPrivacyDetail} style={themed($footerItem)}>
          <Text style={themed($switchLabel)}>Privacy Policy</Text>
          <Icon icon="caretRight" size={20} />
        </Pressable>
      </View>
    </Screen>
  )
}

// #region Styles
const $screenContainer: ThemedStyle<ViewStyle> = () => ({
  flex: 1,
})

const $headerStyle: ThemedStyle<ViewStyle> = () => ({
  backgroundColor: "#1737ba",
})

const $headerTitle: ThemedStyle<TextStyle> = () => ({
  color: "#fff",
})

const $leftAction: ViewStyle = {
  marginLeft: 16,
  justifyContent: "center",
}

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.background,
  borderRadius: spacing.md,
  margin: spacing.md,
  padding: spacing.lg,
  shadowColor: colors.palette.neutral800,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 3,
  borderWidth: HAIRLINE,
  borderColor: colors.palette.neutral300,
})

const $indicatorSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.md,
})

const $labelDim: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $valueText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
  fontSize: 16,
  marginTop: 4,
})

const $controlsSection: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.xs,
})

const $switchRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: spacing.sm,
})

const $switchLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

const $divider: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  height: HAIRLINE,
  backgroundColor: colors.palette.neutral300,
  marginVertical: spacing.xs,
})

const $footerItem: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  paddingVertical: spacing.sm,
  marginTop: spacing.xs,
})
// #endregion
