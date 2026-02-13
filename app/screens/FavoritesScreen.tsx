import { FC, useCallback, useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  ImageStyle,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
  TouchableOpacity,
} from "react-native"
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { Card } from "@/components/Card"
import { EmptyState } from "@/components/EmptyState"
import { Icon } from "@/components/Icon"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Switch } from "@/components/Toggle/Switch"
import { useEpisodes, useEpisode } from "@/context/EpisodeContext"
import { useGlobalModal } from "@/context/GlobalModalContext"
import { isRTL } from "@/i18n"
import { translate } from "@/i18n/translate"
import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import type { EpisodeItem } from "@/services/api/types"
import { useAppTheme } from "@/theme/context"
import { $styles } from "@/theme/styles"
import type { ThemedStyle } from "@/theme/types"
import { delay } from "@/utils/delay"

const ICON_SIZE = 14

export const FavoritesScreen: FC<DemoTabScreenProps<"Favorites">> = (_props) => {
  const { themed } = useAppTheme()
  const {
    totalEpisodes,
    totalFavorites,
    episodesForList,
    fetchEpisodes,
    favoritesOnly,
    toggleFavoritesOnly,
    toggleFavorite,
  } = useEpisodes()

  const [refreshing, setRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    ;(async function load() {
      setIsLoading(true)
      await fetchEpisodes()
      setIsLoading(false)
    })()
  }, [fetchEpisodes])

  async function manualRefresh() {
    setRefreshing(true)
    await Promise.allSettled([fetchEpisodes(), delay(750)])
    setRefreshing(false)
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={$styles.flex1}>
      <FlatList<EpisodeItem>
        contentContainerStyle={themed([$styles.container, $listContentContainer])}
        data={episodesForList}
        extraData={totalEpisodes + totalFavorites}
        refreshing={refreshing}
        onRefresh={manualRefresh}
        keyExtractor={(item) => item.guid}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator />
          ) : (
            <EmptyState
              preset="generic"
              style={themed($emptyState)}
              headingTx={favoritesOnly ? "demoPodcastListScreen:noFavoritesEmptyState.heading" : undefined}
              contentTx={favoritesOnly ? "demoPodcastListScreen:noFavoritesEmptyState.content" : undefined}
              buttonOnPress={manualRefresh}
              imageStyle={$emptyStateImage}
              ImageProps={{ resizeMode: "contain" }}
            />
          )
        }
        ListHeaderComponent={
          <View style={themed($heading)}>
            <Text preset="heading" text="Favorites" />
            {(favoritesOnly || episodesForList.length > 0) && (
              <View style={themed($toggle)}>
                <Switch
                  value={favoritesOnly}
                  onValueChange={() => toggleFavoritesOnly()}
                  labelTx="demoPodcastListScreen:onlyFavorites"
                  labelPosition="left"
                  labelStyle={$labelStyle}
                />
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <EpisodeCard episode={item} onPressFavorite={() => toggleFavorite(item)} />
        )}
      />
    </Screen>
  )
}

const EpisodeCard = ({
  episode,
  onPressFavorite,
}: {
  episode: EpisodeItem
  onPressFavorite: () => void
}) => {
  const {
    theme: { colors },
    themed,
  } = useAppTheme()
  const { isFavorite, datePublished, parsedTitleAndSubtitle } = useEpisode(episode)

  const liked = useSharedValue(isFavorite ? 1 : 0)

  const animatedLikeButtonStyles = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(liked.value, [0, 1], [1, 0], Extrapolation.EXTEND) }],
    opacity: interpolate(liked.value, [0, 1], [1, 0], Extrapolation.CLAMP),
  }))

  const animatedUnlikeButtonStyles = useAnimatedStyle(() => ({
    transform: [{ scale: liked.value }],
    opacity: liked.value,
  }))

  const { totalFavorites } = useEpisodes()
  const { show: showModal } = useGlobalModal()
  const MAX_FAVORITES = 3
  
  const handlePressFavorite = useCallback(() => {
    if (!isFavorite && totalFavorites >= MAX_FAVORITES) {
      showModal({
        type: "error",
        title: "Favorite Limit Reached",
        message: `You can only favorite up to ${MAX_FAVORITES} items.`,
        actions: [{ text: "OK" }],
      })
      return
    }
    onPressFavorite()
    liked.value = withSpring(liked.value ? 0 : 1)
  }, [isFavorite, totalFavorites, onPressFavorite, liked, showModal])

  const [expanded, setExpanded] = useState(false)
  const targetHeight = 300 
  const height = useSharedValue(0)

  const handlePressCard = () => {
    height.value = withTiming(expanded ? 0 : targetHeight, { duration: 250 })
    setExpanded(!expanded)
  }

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    overflow: "hidden",
  }))

  const FavoriteButton = useMemo(
    () =>
      function FavoriteButton() {
        return (
          <TouchableOpacity onPress={handlePressFavorite} style={$topRightButton}>
            <View>
              <Animated.View style={[StyleSheet.absoluteFill, animatedLikeButtonStyles, $centerIcon]}>
                <Icon icon="heart" size={30} color={colors.palette.neutral800} />
              </Animated.View>
              <Animated.View style={[animatedUnlikeButtonStyles, $centerIcon]}>
                <Icon icon="heart" size={30} color={colors.palette.primary400} />
              </Animated.View>
            </View>
          </TouchableOpacity>
        )
      },
    [animatedLikeButtonStyles, animatedUnlikeButtonStyles, colors, handlePressFavorite],
  )

  return (
    <Card
      style={themed([$item])}
      onPress={handlePressCard}
      HeadingComponent={
        <View style={$cardHeader}>
          {/* Station Name & Heart Row */}
          <View style={$titleRow}>
            <Text weight="bold" size="md" style={$stationName}>
              {parsedTitleAndSubtitle.title}
            </Text>
            <FavoriteButton />
          </View>
          
          {/* Metadata Row: Date and Contributor */}
          <Text size="xxs" style={$metadataText}>
            {datePublished.textLabel} by user123
          </Text>
        </View>
      }
      FooterComponent={
        <Animated.View style={animatedStyle}>
          <View style={$priceDashboard}>
            <View style={$priceGridContainer}>
              {[
                { label: "DIESEL", value: "60.00" },
                { label: "GAS 91", value: "55.00" },
                { label: "GAS 95", value: "56.00" }
              ].map((fuel, index) => (
                <View key={index} style={$dataEntry}>
                  <Text style={$dataLabel}>{fuel.label}</Text>
                  <Text style={$dataValue}>₱{fuel.value}</Text>
                  {index < 2 && <View style={$verticalDivider} />}
                </View>
              ))}
            </View>

            <View style={$motorcycleSection}>
              <View style={$separatorLine} />
              <Text weight="bold" size="xs" style={$sectionTitle}>Motorcycle Lane</Text>
              <View style={$priceGridContainer}>
                {[
                  { label: "RON 91", value: "54.00" },
                  { label: "RON 95", value: "55.00" },
                ].map((fuel, index) => (
                  <View key={index} style={$dataEntry}>
                    <Text style={$dataLabel}>{fuel.label}</Text>
                    <Text style={$dataValue}>₱{fuel.value}</Text>
                    {index === 0 && <View style={$verticalDivider} />}
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={$buttonRow}>
            <TouchableOpacity style={$directionsButton}>
              <Icon icon="gasStation" color="white" size={20} />
              <Text style={$buttonText}>Directions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={$directionsButton}>
              <Icon icon="gasStation" color="white" size={20} />
              <Text style={$buttonText}>Update Price</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      }
    />
  )
}

// #region Styles
const $cardHeader: ViewStyle = {
  marginBottom: 8,
}

const $titleRow: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
}

const $stationName: TextStyle = {
  flex: 1,
}

const $metadataText: TextStyle = {
  opacity: 0.6,
  marginTop: 4,
}

const $priceDashboard: ViewStyle = {
  backgroundColor: "#F2F2F7",
  borderRadius: 16,
  paddingVertical: 14,
  paddingHorizontal: 8,
  borderWidth: 1,
  borderColor: "#E5E5EA",
  marginVertical: 12,
}

const $priceGridContainer: ViewStyle = {
  flexDirection: "row",
  flexWrap: "wrap",
}

const $dataEntry: ViewStyle = {
  width: "33.33%", 
  alignItems: "center",
  justifyContent: "center",
  position: 'relative',
}

const $verticalDivider: ViewStyle = {
  position: 'absolute',
  right: 0,
  height: '60%',
  width: 1,
  backgroundColor: "#D1D1D6",
}

const $dataLabel: TextStyle = {
  color: "#8E8E93",
  fontSize: 10,
  fontWeight: "600",
}

const $dataValue: TextStyle = {
  color: "#1C1C1E",
  fontSize: 18,
  fontWeight: "700",
}

const $motorcycleSection: ViewStyle = {
  marginTop: 10,
}

const $separatorLine: ViewStyle = {
  height: 1, 
  backgroundColor: "#D1D1D6",
  marginVertical: 12,
  width: "90%",
  alignSelf: "center",
}

const $sectionTitle: TextStyle = {
  textAlign: 'center',
  color: "#8E8E93",
  marginBottom: 8,
  textTransform: 'uppercase',
  letterSpacing: 1,
}

const $buttonRow: ViewStyle = {
  flexDirection: "row", 
  justifyContent: "space-between",
  marginTop: 4,
}

const $directionsButton: ViewStyle = {
  flexDirection: "row",
  backgroundColor: "#605e5e",
  paddingVertical: 10,
  borderRadius: 20,
  alignItems: "center",
  width: '48%',
  justifyContent: "center"
}

const $buttonText: TextStyle = {
  color: "white",
  marginLeft: 8,
  fontWeight: "600",
  fontSize: 14,
}

const $topRightButton: ViewStyle = {
  paddingLeft: 8,
}

const $centerIcon: ViewStyle = {
  justifyContent: "center",
  alignItems: "center",
}

const $listContentContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.lg + spacing.xl,
  paddingBottom: spacing.lg,
})

const $heading: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginBottom: spacing.md,
})

const $item: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  padding: spacing.md,
  marginTop: spacing.md,
  minHeight: 120,
  backgroundColor: colors.palette.neutral100,
  borderRadius: 20,
})

const $toggle: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.md,
})

const $labelStyle: TextStyle = {
  textAlign: "left",
}

const $emptyState: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginTop: spacing.xxl,
})

const $emptyStateImage: ImageStyle = {
  transform: [{ scaleX: isRTL ? -1 : 1 }],
}
// #endregion