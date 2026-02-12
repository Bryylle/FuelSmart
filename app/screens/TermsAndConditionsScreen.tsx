import { FC } from "react"
import {
  Pressable,
  View,
  ViewStyle,
  TextStyle,
} from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import { $styles } from "@/theme/styles"
import type { ThemedStyle } from "@/theme/types"

import { Icon } from "@/components/Icon"
import { Header } from "@/components/Header"

export const TermsAndConditionsScreen: FC<DemoTabScreenProps<"TermsAndConditions">> = ({ navigation }) => {
  const { themed } = useAppTheme()

  return (
    <Screen contentContainerStyle={$styles.flex1}>
      <Header
        title="Terms and Conditions"
        // Ensure the header handles the status bar inset internally
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
        <Text>Terms</Text>
      </View>
    </Screen>
  )
}

// #region Styles
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

const $screenContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.md,
})
// #endregion