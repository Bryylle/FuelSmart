import React from "react"
import { Pressable, View, ViewStyle, TextStyle } from "react-native"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import { Header } from "@/components/Header"
import { Icon, IconTypes } from "@/components/Icon" 
import { colors } from "@/theme/colors"

interface ScreenHeaderProps {
  title: string
  leftIcon?: IconTypes
  onLeftPress?: () => void
  rightIcon?: IconTypes
  onRightPress?: () => void
}

export const ScreenHeader = ({ 
  title, 
  leftIcon, 
  onLeftPress, 
  rightIcon, 
  onRightPress 
}: ScreenHeaderProps) => {
  const { themed } = useAppTheme()

  return (
    <Header
      title={title}
      safeAreaEdges={["top"]}
      style={themed($headerStyle)}
      titleStyle={themed($headerTitle)}
      // Only renders the wrapper and icon if leftIcon exists
      LeftActionComponent={
        leftIcon ? (
          <View style={$leftActionWrapper}>
            <Pressable
              onPress={onLeftPress}
              accessibilityLabel="Left action"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Icon icon={leftIcon} size={24} color={"#fff"} />
            </Pressable>
          </View>
        ) : undefined
      }
      // Only renders the wrapper and icon if rightIcon exists
      RightActionComponent={
        rightIcon ? (
          <View style={$rightActionWrapper}>
            <Pressable
              onPress={onRightPress}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Icon icon={rightIcon} size={24} color={"#fff"} />
            </Pressable>
          </View>
        ) : undefined
      }
    />
  )
}

const $headerStyle: ThemedStyle<ViewStyle> = () => ({
  backgroundColor: colors.palette.primary500,
})

const $headerTitle: ThemedStyle<TextStyle> = () => ({
  color: "#fff",
})

const $leftActionWrapper: ViewStyle = {
  justifyContent: "center",
  alignItems: "center",
  marginLeft: 16,
}

const $rightActionWrapper: ViewStyle = {
  justifyContent: "center",
  alignItems: "center",
  marginRight: 16,
}