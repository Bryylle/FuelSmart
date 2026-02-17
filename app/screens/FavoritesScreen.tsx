import { FC, useCallback, useEffect, useState } from "react"
import {
  ActivityIndicator,
  FlatList,
  View,
  ViewStyle,
  TextStyle,
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
import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import { $styles } from "@/theme/styles"
import type { ThemedStyle } from "@/theme/types"
import { delay } from "@/utils/delay"

import { supabase } from "@/services/supabase"
import { FUEL_BRAND_MAP } from "../utils/fuelMappings"

const getDisplayName = (fullName: string | undefined, bShowName: boolean) => {
  if (!fullName) return "Anonymous"
  if (bShowName) return fullName
  return `${fullName.charAt(0)}*****`
}

export const FavoritesScreen: FC<DemoTabScreenProps<"Favorites">> = (_props) => {
  const { themed, theme: { colors } } = useAppTheme()
  const [favoriteStations, setFavoriteStations] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const [showUserModal, setShowUserModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)

  const fetchFavorites = useCallback(async () => {
    try {
      setIsError(false)
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) throw new Error("Auth failed")
      
      setCurrentUserId(authData.user.id)

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('favorite_stations')
        .eq('id', authData.user.id)
        .single()
      
      if (userError) throw userError

      const favoriteIds = userData?.favorite_stations || []

      if (favoriteIds.length > 0) {
        const { data: stations, error: stationsError } = await supabase
          .from('fuel_stations')
          .select(`*, users:last_updated_by (*)`)
          .in('id', favoriteIds)
        
        if (stationsError) throw stationsError
        setFavoriteStations(stations || [])
      } else {
        setFavoriteStations([])
      }
    } catch (e) {
      console.error("Error fetching favorites:", e)
      setIsError(true)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      setIsLoading(true)
      await fetchFavorites()
      setIsLoading(false)
    })()
  }, [fetchFavorites])

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

  const openUserModal = (user: any) => {
    setSelectedUser(user)
    setShowUserModal(true)
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={$styles.flex1}>
      <FlatList
        contentContainerStyle={[
          themed([$styles.container, $listContentContainer]),
          (favoriteStations.length === 0 || isError) && { flexGrow: 1, justifyContent: 'center' }
        ]}
        data={isError ? [] : favoriteStations}
        refreshing={refreshing}
        onRefresh={manualRefresh}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color={colors.palette.primary500} />
          ) : (
            <EmptyState
              preset="generic"
              style={{ marginTop: 0 }}
              heading={isError ? "Connection Error" : "No Favorites Yet"}
              content={isError 
                ? "Cannot load your favorites. Please check your internet connection." 
                : "Add gas stations to your favorites to see them here."
              }
              button="Refresh"
              buttonOnPress={manualRefresh}
            />
          )
        }
        ListHeaderComponent={(!isError && favoriteStations.length > 0) ? (
          <View style={themed($heading)}>
            <Text preset="heading" text="Favorite Stations" />
          </View>
        ) : null}
        renderItem={({ item }) => (
          <StationCard 
            station={item} 
            onUnfavorite={() => handleRemoveFavorite(item.id)} 
            onPressUser={(user) => openUserModal(user)}
          />
        )}
      />

      <Modal visible={showUserModal} transparent animationType="fade" onRequestClose={() => setShowUserModal(false)}>
        <TouchableOpacity style={$modalOverlay} activeOpacity={1} onPress={() => setShowUserModal(false)}>
          <View style={$modalContent}>
             <View style={$profileHeader}>
                <View style={$avatarCircle}>
                   <Text 
                      style={$avatarText} 
                      text={selectedUser?.full_name?.substring(0,1)?.toUpperCase() || ""} 
                      size="xl" 
                      weight="bold" 
                    />
                </View>
                <View style={$nameContainer}>
                  <View style={$tierRow}>
                    <Text preset="subheading" weight="bold" style={{ color: "black", flexShrink: 1 }} numberOfLines={1}>
                      {getDisplayName(selectedUser?.full_name, selectedUser?.b_show_name ?? true)}
                    </Text>
                    <Image source={require("@assets/icons/download/medal-gold.png")} style={{ width: 30, height: 30, marginLeft: 8 }} resizeMode="contain" />
                  </View>
                  <Text style={{ color: "#666", fontSize: 14 }}>Rank: Gold Contributor</Text>
                </View>
             </View>
             <View style={$statsRow}>
                <View style={$statBox}><Text weight="bold" style={$statValue}>{selectedUser?.no_contributions || 0}</Text><Text size="xxs" style={$statLabel}>CONTRIBUTIONS</Text></View>
                <View style={$statBox}><Text weight="bold" style={$statValue}>{selectedUser?.no_likes || 0}</Text><Text size="xxs" style={$statLabel}>LIKES</Text></View>
             </View>
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

  // We ensure fuelConfig is at least an empty object to prevent the "undefined" crash
  const fuelConfig = FUEL_BRAND_MAP[station.brand] || {}

  const handlePressCard = () => {
    const fuelKeys = Object.keys(fuelConfig)
    
    // Determine height: If brand not found (length 0), we give it a default height 
    // so it still expands to show "No data" or at least doesn't stay frozen.
    const targetHeight = fuelKeys.length > 3 ? 280 : 220 
    
    height.value = withTiming(expanded ? 0 : targetHeight, { duration: 250 })
    setExpanded(!expanded)
  }

  const animatedStyle = useAnimatedStyle(() => ({ height: height.value, overflow: "hidden" }))
  const getRankColor = (contributions: number = 0) => contributions > 70 ? "#FFD700" : "#4CD964"

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
            <Text size="xxs" style={$metadataText}>
                {station.city} • Updated {station.updated_at ? formatDistanceToNow(new Date(station.updated_at), { addSuffix: true }) : "recently"}
            </Text>
            {station.users ?  (
              <TouchableOpacity onPress={() => onPressUser(station.users)}>
                <Text size="xxs" style={[{ color: getRankColor(station.users.no_contributions), fontWeight: 'bold' }, $metadataText]}>
                  {" "}by {getDisplayName(station.users.full_name, station.users.b_show_name)}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text size="xxs" style={[{ color: "#8E8E93", fontWeight: 'bold' }, $metadataText]}>
                {" "}by System
              </Text>
            )}
          </View>
        </View>
      }
      FooterComponent={
        <Animated.View style={animatedStyle}>
          <View style={$priceDashboard}>
            <View style={$priceGridContainer}>
              {Object.keys(fuelConfig).length > 0 ? (
                Object.keys(fuelConfig).map((key, index) => (
                  <View key={key} style={$dataEntry}>
                    <Text style={$dataLabel}>{fuelConfig[key]}</Text>
                    <Text style={$dataValue}>₱{(Number(station[key]) || 0).toFixed(2)}</Text>
                    {(index + 1) % 3 !== 0 && <View style={$verticalDivider} />}
                  </View>
                ))
              ) : (
                <Text style={{ textAlign: 'center', width: '100%', opacity: 0.5 }}>Price data unavailable</Text>
              )}
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

// Styles remain unchanged
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
const $closeBtn: ViewStyle = { backgroundColor: "#1737ba", paddingVertical: 14, borderRadius: 16, alignItems: "center" }