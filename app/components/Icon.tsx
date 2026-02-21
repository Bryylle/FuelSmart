import {
  Image,
  ImageStyle,
  StyleProp,
  TouchableOpacity,
  TouchableOpacityProps,
  View,
  ViewProps,
  ViewStyle,
} from "react-native"

import { useAppTheme } from "@/theme/context"

export type IconTypes = keyof typeof iconRegistry

type BaseIconProps = {
  /**
   * The name of the icon
   */
  icon: IconTypes

  /**
   * An optional tint color for the icon
   */
  color?: string

  /**
   * An optional size for the icon. If not provided, the icon will be sized to the icon's resolution.
   */
  size?: number

  /**
   * Style overrides for the icon image
   */
  style?: StyleProp<ImageStyle>

  /**
   * Style overrides for the icon container
   */
  containerStyle?: StyleProp<ViewStyle>
}

type PressableIconProps = Omit<TouchableOpacityProps, "style"> & BaseIconProps
type IconProps = Omit<ViewProps, "style"> & BaseIconProps

/**
 * A component to render a registered icon.
 * It is wrapped in a <TouchableOpacity />
 * @see [Documentation and Examples]{@link https://docs.infinite.red/ignite-cli/boilerplate/app/components/Icon/}
 * @param {PressableIconProps} props - The props for the `PressableIcon` component.
 * @returns {JSX.Element} The rendered `PressableIcon` component.
 */
export function PressableIcon(props: PressableIconProps) {
  const {
    icon,
    color,
    size,
    style: $imageStyleOverride,
    containerStyle: $containerStyleOverride,
    ...pressableProps
  } = props

  const { theme } = useAppTheme()

  const $imageStyle: StyleProp<ImageStyle> = [
    $imageStyleBase,
    { tintColor: color ?? theme.colors.text },
    size !== undefined && { width: size, height: size },
    $imageStyleOverride,
  ]

  return (
    <TouchableOpacity {...pressableProps} style={$containerStyleOverride}>
      <Image style={$imageStyle} source={iconRegistry[icon]} />
    </TouchableOpacity>
  )
}

/**
 * A component to render a registered icon.
 * It is wrapped in a <View />, use `PressableIcon` if you want to react to input
 * @see [Documentation and Examples]{@link https://docs.infinite.red/ignite-cli/boilerplate/app/components/Icon/}
 * @param {IconProps} props - The props for the `Icon` component.
 * @returns {JSX.Element} The rendered `Icon` component.
 */
export function Icon(props: IconProps) {
  const {
    icon,
    color,
    size,
    style: $imageStyleOverride,
    containerStyle: $containerStyleOverride,
    ...viewProps
  } = props

  const { theme } = useAppTheme()

  const $imageStyle: StyleProp<ImageStyle> = [
    $imageStyleBase,
    { tintColor: color ?? theme.colors.text },
    size !== undefined && { width: size, height: size },
    $imageStyleOverride,
  ]

  return (
    <View {...viewProps} style={$containerStyleOverride}>
      <Image style={$imageStyle} source={iconRegistry[icon]} />
    </View>
  )
}

export const iconRegistry = {
  
  caretRight: require("@assets/icons/caret_right.png"),
  ladybug: require("@assets/icons/ladybug.png"),
  settings: require("@assets/icons/settings.png"),
  close: require("@assets/icons/close.png"),
  gasStation: require("@assets/icons/download/gas-station.png"),
  marker: require("@assets/icons/marker_isolated.png"),
  heart: require("@assets/icons/download/heart.png"),
  heartFilled: require("@assets/icons/download/heart-filled.png"),
  caretDown: require("@assets/icons/download/caret-down.png"),
  caretUp: require("@assets/icons/download/caret-down.png"),
  medalGold: require("@assets/icons/download/medal-gold.png"),
  medalSilver: require("@assets/icons/download/medal-silver.png"),
  medalBronze: require("@assets/icons/download/medal-bronze.png"),
  search: require("@assets/icons/search.png"),
  information: require("@assets/icons/information.png"),
  carWash: require("@assets/icons/car_wash.png"),
  towing: require("@assets/icons/towing.png"),
  tireRepair: require("@assets/icons/tire_repair.png"),
  carRepair: require("@assets/icons/car_repair.png"),
  map: require("@assets/icons/map.png"),
  parking: require("@assets/icons/parking.png"),
  profile: require("@assets/icons/profile.png"),
  phone: require("@assets/icons/phone.png"),
  arrowDown: require("@assets/icons/arrow_down.png"),
  arrowLeft: require("@assets/icons/arrow_left.png"),
  arrowUp: require("@assets/icons/arrow_up.png"),
  directions: require("@assets/icons/directions.png"),
  logout: require("@assets/icons/logout.png"),
  star: require("@assets/icons/star.png"),
  home: require("@assets/icons/home.png"),
  check: require("@assets/icons/check.png"),
  priceUpdate: require("@assets/icons/price_update.png"),
  layers: require("@assets/icons/layers.png"),  
  reset_focus: require("@assets/icons/reset_focus.png"),  
  add_marker: require("@assets/icons/add_marker.png"),  
}

const $imageStyleBase: ImageStyle = {
  resizeMode: "contain",
}
