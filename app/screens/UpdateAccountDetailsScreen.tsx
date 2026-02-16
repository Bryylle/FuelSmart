import { FC, useCallback, useMemo, useState } from "react"
import {
  Pressable,
  View,
  ViewStyle,
  TextStyle,
} from "react-native"
import { Card } from "@/components/Card"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import { $styles } from "@/theme/styles"
import type { ThemedStyle } from "@/theme/types"

import { Icon } from "@/components/Icon"
import { colors } from "@/theme/colors"

import { Header } from "@/components/Header"

export const UpdateAccountDetailsScreen: FC<DemoTabScreenProps<"UpdateAccountDetails">> = ({ navigation }) => {
  const { themed } = useAppTheme()

  return (
    <Screen safeAreaEdges={["top"]} contentContainerStyle={$styles.flex1}>
        <Header
            title="Update Account Details"
            LeftActionComponent={
            <View style={$leftActionWrapper}>
                <Pressable
                    onPress={() => navigation.navigate("Welcome")}
                    accessibilityLabel="Go back"
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <Icon icon="back" size={24} color={colors.tint} />
                </Pressable>
            </View>
            }
            style={themed($headerStyle)}
            titleStyle={themed($headerTitle)}
        />
        <View style={themed($screenContainer)}>
            <Text>Update Account Details</Text>
        </View>
    </Screen>
  )
}

// #region Styles
const $headerStyle: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.bottomNavigationBackground,
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

