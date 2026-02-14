import { FC, useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  ImageStyle,
  TextStyle,
  View,
  ViewStyle,
  TouchableOpacity,
  Linking,
  Alert,
  Modal,
  Image,
} from "react-native"
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated"
import { formatDistanceToNow } from "date-fns"

import { Card } from "@/components/Card"
import { EmptyState } from "@/components/EmptyState"
import { Icon } from "@/components/Icon"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { isRTL } from "@/i18n"
import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import { $styles } from "@/theme/styles"
import type { ThemedStyle } from "@/theme/types"
import { delay } from "@/utils/delay"

import { supabase } from "@/services/supabase"
import { FUEL_BRAND_MAP } from "../utils/fuelMappings"

export const FavoritesScreen: FC<DemoTabScreenProps<"Favorites">> = (_props) => {
  const { themed } = useAppTheme()
  const [favoriteStations, setFavoriteStations] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Local User Modal State
  const [showUserModal, setShowUserModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)

  const fetchFavorites = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return
      setCurrentUserId(authUser.id)

      const { data: userData } = await supabase
        .from('users')
        .select('favorite_stations')
        .eq('id', authUser.id)
        .single()

      const favoriteIds = userData?.favorite_stations || []

      if (favoriteIds.length > 0) {
        const { data: stations } = await supabase
          .from('fuel_stations')
          .select(`
            *, 
            users:last_updated_by (*)
          `)
          .in('id', favoriteIds)

        if (stations) {
          setFavoriteStations(stations)
        }
      } else {
        setFavoriteStations([])
      }
    } catch (e) {
      console.error("Error fetching favorites:", e)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      setIsLoading(true)
      await fetchFavorites()
      setIsLoading(false)
    })()
  }, [fetchFavorites])

  const openUserModal = (user: any) => {
    setSelectedUser(user)
    setShowUserModal(true)
  }

  const handleLikeUser = async (isLike: boolean) => {
    if (!selectedUser || !currentUserId) return
    if (selectedUser.id === currentUserId) return // Guard for self-interaction

    try {
      const { data: userProfile } = await supabase
        .from('users')
        .select('no_likes')
        .eq('id', selectedUser.id)
        .single()

      const currentLikes = userProfile?.no_likes || 0
      const newLikes = isLike ? currentLikes + 1 : Math.max(0, currentLikes - 1)

      const { error } = await supabase
        .from('users')
        .update({ no_likes: newLikes })
        .eq('id', selectedUser.id)

      if (!error) {
        setSelectedUser({ ...selectedUser, no_likes: newLikes })
        // Update local list state so the modal stays synced if opened again
        setFavoriteStations(prev => prev.map(item => {
          if (item.users?.id === selectedUser.id) {
            return { ...item, users: { ...item.users, no_likes: newLikes } }
          }
          return item
        }))
      }
    } catch (e) {
      console.error("Error updating likes:", e)
    }
  }

  const manualRefresh = async () => {
    setRefreshing(true)
    await Promise.allSettled([fetchFavorites(), delay(750)])
    setRefreshing(false)
  }

  const handleRemoveFavorite = async (stationId: string) => {
    if (!currentUserId) return
    const newFavs = favoriteStations.filter(s => s.id !== stationId).map(s => s.id)
    const { error } = await supabase.from('users').update({ favorite_stations: newFavs }).eq('id', currentUserId)
    if (!error) setFavoriteStations(prev => prev.filter(s => s.id !== stationId))
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={$styles.flex1}>
      <FlatList
        contentContainerStyle={themed([$styles.container, $listContentContainer])}
        data={favoriteStations}
        refreshing={refreshing}
        onRefresh={manualRefresh}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          isLoading ? <ActivityIndicator style={{ marginTop: 20 }} /> : (
            <EmptyState
              preset="generic"
              style={themed($emptyState)}
              heading="No Favorites Yet"
              content="Add gas stations to your favorites to see them here."
              buttonOnPress={manualRefresh}
            />
          )
        }
        ListHeaderComponent={<View style={themed($heading)}><Text preset="heading" text="Favorite Stations" /></View>}
        renderItem={({ item }) => (
          <StationCard 
            station={item} 
            onUnfavorite={() => handleRemoveFavorite(item.id)} 
            onPressUser={(user) => openUserModal(user)}
          />
        )}
      />

      {/* Contributor Modal */}
      <Modal visible={showUserModal} transparent animationType="fade" onRequestClose={() => setShowUserModal(false)}>
        <TouchableOpacity style={$modalOverlay} activeOpacity={1} onPress={() => setShowUserModal(false)}>
          <View style={$modalContent}>
             <View style={$profileHeader}>
                <View style={$avatarCircle}>
                  <Text style={$avatarText} text={selectedUser?.firstname?.substring(0,1)?.toUpperCase() + (selectedUser?.lastname?.substring(0,1)?.toUpperCase() || "")} size="xl" weight="bold" />
                </View>
                <View style={$nameContainer}>
                  <View style={$tierRow}>
                    <Text preset="subheading" weight="bold" style={{ color: "black" }}>
                      {selectedUser?.firstname} {selectedUser?.lastname}
                    </Text>
                    <Image source={require("@assets/icons/download/medal-gold.png")} style={{ width: 30, height: 30, marginLeft: 8 }} resizeMode="contain" />
                  </View>
                  <Text style={{ color: "#666", fontSize: 14 }}>Rank: Gold Contributor</Text>
                </View>
             </View>

             <View style={$statsRow}>
                <View style={$statBox}>
                  <Text weight="bold" style={$statValue}>{selectedUser?.no_contributions || 0}</Text>
                  <Text size="xxs" style={$statLabel}>CONTRIBUTIONS</Text>
                </View>
                <View style={$statBox}>
                  <Text weight="bold" style={$statValue}>{selectedUser?.no_likes || 0}</Text>
                  <Text size="xxs" style={$statLabel}>LIKES</Text>
                </View>
             </View>

             {/* Only show Like/Dislike if not viewing own profile */}
             {selectedUser?.id !== currentUserId && (
               <View style={$actionRow}>
                 <TouchableOpacity style={[$actionBtn, { backgroundColor: '#E8F5E9' }]} onPress={() => handleLikeUser(true)}>
                    <Icon icon="heart" size={24} color="#4CAF50" />
                    <Text style={{ color: "#4CAF50", fontWeight: 'bold', marginLeft: 8 }}>Like</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={[$actionBtn, { backgroundColor: '#FFEBEE' }]} onPress={() => handleLikeUser(false)}>
                    <Icon icon="close" size={24} color="#F44336" />
                    <Text style={{ color: "#F44336", fontWeight: 'bold', marginLeft: 8 }}>Dislike</Text>
                 </TouchableOpacity>
               </View>
             )}

             <TouchableOpacity style={$closeBtn} onPress={() => setShowUserModal(false)}>
                <Text style={{ color: "white", fontWeight: "600" }}>Close</Text>
             </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </Screen>
  )
}

const StationCard = ({ station, onUnfavorite, onPressUser }: { station: any, onUnfavorite: () => void, onPressUser: (user: any) => void }) => {
  const { theme: { colors }, themed } = useAppTheme()
  const [expanded, setExpanded] = useState(false)
  const height = useSharedValue(0)

  const handlePressCard = () => {
    const config = FUEL_BRAND_MAP[station.brand] || FUEL_BRAND_MAP["Default"]
    const fuelCount = Object.keys(config).length
    const targetHeight = fuelCount > 3 ? 280 : 220 
    height.value = withTiming(expanded ? 0 : targetHeight, { duration: 250 })
    setExpanded(!expanded)
  }

  const animatedStyle = useAnimatedStyle(() => ({ height: height.value, overflow: "hidden" }))

  const getRankColor = (contributions: number = 0) => {
    if (contributions <= 30) return "#4CD964"
    if (contributions <= 50) return "#007AFF"
    if (contributions <= 70) return "#AF52DE"
    return "#FFD700"
  }

  const fuelConfig = FUEL_BRAND_MAP[station.brand] || FUEL_BRAND_MAP["Default"]

  return (
    <Card
      style={themed([$item])}
      onPress={handlePressCard}
      HeadingComponent={
        <View style={$cardHeader}>
          <View style={$titleRow}>
            <Text weight="bold" size="md" style={$stationName}>{station.brand}</Text>
            <TouchableOpacity onPress={onUnfavorite} style={$topRightButton}>
              <Icon icon="heart" size={30} color={colors.palette.primary500} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
            <Text size="xxs" style={$metadataText}>{station.city} • Updated {formatDistanceToNow(new Date(station.updated_at), { addSuffix: true })}</Text>
            {station.users && (
              <TouchableOpacity onPress={() => onPressUser(station.users)}>
                <Text size="xxs" style={[{ color: getRankColor(station.users.no_contributions), fontWeight: 'bold' }, $metadataText]}>
                  {" "}by {station.users.b_show_firstname ? station.users.firstname : `${station.users.firstname} ${station.users.lastname || ""}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      }
      FooterComponent={
        <Animated.View style={animatedStyle}>
          <View style={$priceDashboard}>
            <View style={$priceGridContainer}>
              {Object.keys(fuelConfig).map((key, index) => (
                <View key={key} style={$dataEntry}>
                  <Text style={$dataLabel}>{fuelConfig[key]}</Text>
                  <Text style={$dataValue}>₱{(Number(station[key]) || 0).toFixed(2)}</Text>
                  {(index + 1) % 3 !== 0 && <View style={$verticalDivider} />}
                </View>
              ))}
            </View>
          </View>
          <View style={$buttonRow}>
            <TouchableOpacity style={$directionsButton} onPress={() => Linking.openURL(`google.navigation:q=${station.latitude},${station.longitude}`)}>
              <Icon icon="directions" color="white" size={20} /><Text style={$buttonText}>Directions</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[$directionsButton, { backgroundColor: colors.palette.primary500 }]} onPress={() => Alert.alert("Update", "Navigate to Map to update prices.")}>
              <Icon icon="priceUpdate" color="white" size={20} /><Text style={$buttonText}>Update</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      }
    />
  )
}

// #region Styles
const $cardHeader: ViewStyle = { marginBottom: 8 }
const $titleRow: ViewStyle = { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }
const $stationName: TextStyle = { flex: 1 }
const $metadataText: TextStyle = { opacity: 0.6, marginTop: 4 }
const $priceDashboard: ViewStyle = { backgroundColor: "#F2F2F7", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8, borderWidth: 1, borderColor: "#E5E5EA", marginVertical: 12 }
const $priceGridContainer: ViewStyle = { flexDirection: "row", flexWrap: "wrap", rowGap: 16 }
const $dataEntry: ViewStyle = { width: "33.33%", alignItems: "center", justifyContent: "center" }
const $verticalDivider: ViewStyle = { position: 'absolute', right: 0, height: '60%', width: 1, backgroundColor: "#D1D1D6" }
const $dataLabel: TextStyle = { color: "#8E8E93", fontSize: 10, fontWeight: "600" }
const $dataValue: TextStyle = { color: "#1C1C1E", fontSize: 18, fontWeight: "700" }
const $buttonRow: ViewStyle = { flexDirection: "row", justifyContent: "space-between", marginTop: 4 }
const $directionsButton: ViewStyle = { flexDirection: "row", backgroundColor: "#605e5e", paddingVertical: 10, borderRadius: 20, alignItems: "center", width: '48%', justifyContent: "center" }
const $buttonText: TextStyle = { color: "white", marginLeft: 8, fontWeight: "600", fontSize: 14 }
const $topRightButton: ViewStyle = { paddingLeft: 8 }
const $listContentContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({ paddingHorizontal: spacing.lg, paddingTop: spacing.lg + spacing.xl, paddingBottom: spacing.lg })
const $heading: ThemedStyle<ViewStyle> = ({ spacing }) => ({ marginBottom: spacing.md })
const $item: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({ padding: spacing.md, marginTop: spacing.md, backgroundColor: colors.palette.neutral100, borderRadius: 20 })
const $emptyState: ThemedStyle<ViewStyle> = ({ spacing }) => ({ marginTop: spacing.xxl })

const $modalOverlay: ViewStyle = { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }
const $modalContent: ViewStyle = { backgroundColor: "white", width: "90%", borderRadius: 24, padding: 24 }
const $profileHeader: ViewStyle = { flexDirection: "row", alignItems: "center", marginBottom: 20 }
const $avatarCircle: ViewStyle = { width: 70, height: 70, borderRadius: 35, backgroundColor: "#E5E5EA", alignItems: "center", justifyContent: "center", marginRight: 16 }
const $avatarText: TextStyle = { color: "#1737ba" }
const $nameContainer: ViewStyle = { flex: 1 }
const $tierRow: ViewStyle = { flexDirection: "row", alignItems: "center" }
const $statsRow: ViewStyle = { flexDirection: "row", backgroundColor: "#F2F2F7", borderRadius: 16, padding: 16, marginBottom: 12 }
const $statBox: ViewStyle = { flex: 1, alignItems: "center" }
const $statValue: TextStyle = { color: "#1C1C1E", fontSize: 18 }
const $statLabel: TextStyle = { color: "#8E8E93", marginTop: 4 }
const $actionRow: ViewStyle = { flexDirection: 'row', gap: 12, marginBottom: 20 }
const $actionBtn: ViewStyle = { flex: 1, flexDirection: 'row', height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }
const $closeBtn: ViewStyle = { backgroundColor: "#1737ba", paddingVertical: 14, borderRadius: 16, alignItems: "center" }
// #endregion