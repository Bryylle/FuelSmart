import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
  TextStyle,
} from "react-native"
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated"
import { formatDistanceToNow } from "date-fns"

import { Card } from "@/components/Card"
import { EmptyState } from "@/components/EmptyState"
import { Icon } from "@/components/Icon"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { ContributorModal } from "@/components/ContributorModal"
import { StationDetailModal } from "@/components/StationDetailModal"

import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import { $styles } from "@/theme/styles"
import { spacing } from "@/theme/spacing"
import type { ThemedStyle } from "@/theme/types"

import { delay } from "@/utils/delay"
import { supabase } from "@/services/supabase"
import { FUEL_BRAND_MAP } from "../utils/fuelMappings"

/**
 * Matches MapScreen behavior.
 */
const getDisplayName = (fullName: string | undefined, bShowName: boolean) => {
  if (!fullName) return "Anonymous"
  if (bShowName) return fullName
  return `${fullName.charAt(0)}*****`
}

type FuelType = "gas" | "diesel" | null

type FuelSubType =
  | "regular_gas"
  | "premium_gas"
  | "sports_gas"
  | "regular_diesel"
  | "premium_diesel"
  | null

const FUEL_SUBTYPE_LABELS: Record<Exclude<FuelSubType, null>, string> = {
  regular_gas: "Regular",
  premium_gas: "Premium",
  sports_gas: "Sports",
  regular_diesel: "Regular",
  premium_diesel: "Premium",
}

type SortOrder = "asc" | "desc"

/**
 * The StationDetailModal expects `last_updated_by`.
 * Favorites query returns joined user record as `users` (alias).
 */
export type NormalizedStation = any & {
  last_updated_by?: {
    id: string
    full_name: string
    b_show_name: boolean
  }
  isPending?: boolean
  isLoading?: boolean
  fetchError?: boolean
}

type ActiveChip = {
  key: "fuelType" | "fuel" | "sort"
  label: string
}

export const FavoritesScreen: FC<DemoTabScreenProps<"Favorites">> = (_props) => {
  const {
    themed,
    theme: { colors },
  } = useAppTheme()

  const [favoriteStations, setFavoriteStations] = useState<any[]>([])
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isError, setIsError] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Contributor modal
  const [contributorIdToShow, setContributorIdToShow] = useState<string | null>(null)
  const [isContributorModalVisible, setIsContributorModalVisible] = useState(false)
  const handleOpenContributor = (id: string) => {
    setContributorIdToShow(id)
    setIsContributorModalVisible(true)
  }

  // Station detail modal
  const [selectedStation, setSelectedStation] = useState<NormalizedStation | null>(null)
  const [isReporting, setIsReporting] = useState(false)
  const priceInputsRef = useRef<Record<string, string>>({})

  // Filters + sort
  const [activeFuelType, setActiveFuelType] = useState<FuelType>(null)
  const [activeFuelSubType, setActiveFuelSubType] = useState<FuelSubType>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")

  // UX: users can collapse filters; header row is fully tappable
  const [filtersExpanded, setFiltersExpanded] = useState(true)

  // UX: auto-collapse filters after user makes a selection
  const collapseFiltersSoon = useCallback(() => {
    requestAnimationFrame(() => setFiltersExpanded(false))
  }, [])

  const fetchFavorites = useCallback(async () => {
    try {
      setIsError(false)

      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) throw new Error("Auth failed")
      setCurrentUserId(authData.user.id)

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("favorite_stations")
        .eq("id", authData.user.id)
        .single()

      if (userError) throw userError

      const ids = userData?.favorite_stations ?? []
      setFavoriteIds(ids)

      if (ids.length > 0) {
        // Alias becomes `station.users`
        const { data: stations, error: stationsError } = await supabase
          .from("fuel_stations")
          .select(`*, users:last_updated_by (*)`)
          .in("id", ids)

        if (stationsError) throw stationsError
        setFavoriteStations(stations ?? [])
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

    const newFavIds = favoriteIds.filter((id) => id !== stationId)
    const { error } = await supabase
      .from("users")
      .update({ favorite_stations: newFavIds })
      .eq("id", currentUserId)

    if (error) {
      Alert.alert("Error", "Could not update favorites.")
      return
    }

    setFavoriteIds(newFavIds)
    setFavoriteStations((prev) => prev.filter((s) => s.id !== stationId))

    // Close modal if user removed currently open station
    setSelectedStation((prev: NormalizedStation | null) => (prev?.id === stationId ? null : prev))
  }

  const showDirections = () => {
    if (!selectedStation) return
    const { latitude, longitude, brand } = selectedStation
    const label = encodeURIComponent(brand)
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}(${label})`,
    })
    if (url) Linking.openURL(url)
  }

  const toggleFavoriteFromModal = async () => {
    if (!selectedStation) return
    await handleRemoveFavorite(selectedStation.id)
  }

  const handleUpdatePrice = async () => {
    if (!selectedStation || !currentUserId) {
      Alert.alert("Error", "User or Station information is missing.")
      return
    }

    const getValidPrice = (key: string) => {
      const input = priceInputsRef.current[key]
      if (input && input.trim() !== "") {
        const parsed = parseFloat(input)
        if (!isNaN(parsed)) return parsed
      }
      return Number(selectedStation[key]) || 0
    }

    const rpcData = {
      _station_id: selectedStation.id,
      _user_id: currentUserId,
      _regular_gas: getValidPrice("regular_gas"),
      _premium_gas: getValidPrice("premium_gas"),
      _sports_gas: getValidPrice("sports_gas"),
      _regular_diesel: getValidPrice("regular_diesel"),
      _premium_diesel: getValidPrice("premium_diesel"),
    }

    try {
      const { error } = await supabase.rpc("submit_fuel_report", rpcData)
      if (error) {
        Alert.alert("Update Failed", error.message)
        return
      }

      Alert.alert("Success", "Station prices updated!")
      setIsReporting(false)
      priceInputsRef.current = {}

      await fetchFavorites()
      setSelectedStation(null)
    } catch (_err) {
      Alert.alert("Error", "A connection error occurred.")
    }
  }

  const availableSubTypes = useMemo(() => {
    if (activeFuelType === "gas") return ["regular_gas", "premium_gas", "sports_gas"] as const
    if (activeFuelType === "diesel") return ["regular_diesel", "premium_diesel"] as const
    return [] as const
  }, [activeFuelType])

  // Keep subtype valid/consistent when fuel type changes
  useEffect(() => {
    if (!activeFuelType) {
      setActiveFuelSubType(null)
      return
    }

    if (activeFuelType === "gas") {
      if (!activeFuelSubType || !["regular_gas", "premium_gas", "sports_gas"].includes(activeFuelSubType)) {
        setActiveFuelSubType("regular_gas")
      }
    }

    if (activeFuelType === "diesel") {
      if (!activeFuelSubType || !["regular_diesel", "premium_diesel"].includes(activeFuelSubType)) {
        setActiveFuelSubType("regular_diesel")
      }
    }
  }, [activeFuelType])

  const filteredAndSortedStations = useMemo(() => {
    if (!favoriteStations.length) return []

    const filtered = favoriteStations.filter((s) => {
      if (activeFuelType) {
        const cfg = FUEL_BRAND_MAP[s.brand] ?? {}
        const wants =
          activeFuelType === "gas"
            ? ["regular_gas", "premium_gas", "sports_gas"]
            : ["regular_diesel", "premium_diesel"]

        const hasAny = wants.some((k) => !!cfg[k])
        if (!hasAny) return false
      }
      return true
    })

    if (!activeFuelSubType) return filtered

    const withKey = filtered.map((s, idx) => ({ s, idx }))

    const getPrice = (st: any) => {
      const n = parseFloat(st[activeFuelSubType])
      return !isNaN(n) ? n : 0
    }

    withKey.sort((a, b) => {
      const pa = getPrice(a.s)
      const pb = getPrice(b.s)
      const aMissing = pa <= 0
      const bMissing = pb <= 0

      if (aMissing && bMissing) return a.idx - b.idx
      if (aMissing) return 1
      if (bMissing) return -1

      const diff = sortOrder === "asc" ? pa - pb : pb - pa
      if (diff != 0) return diff
      return a.idx - b.idx
    })

    return withKey.map((x) => x.s)
  }, [favoriteStations, activeFuelType, activeFuelSubType, sortOrder])

  const hasActiveFilters = activeFuelType !== null

  const clearFilters = () => {
    setActiveFuelType(null)
    setActiveFuelSubType(null)
    setSortOrder("asc")
    collapseFiltersSoon()
  }

  /**
   * Active filter chips:
   * - Show only non-default values (keeps UI clean).
   * - Sort chip shows only if user picked 'desc'.
   */
  const activeChips: ActiveChip[] = useMemo(() => {
    const chips: ActiveChip[] = []

    if (activeFuelType) {
      chips.push({
        key: "fuelType",
        label: activeFuelType === "gas" ? "Gasoline" : "Diesel",
      })
    }

    if (activeFuelSubType) {
      chips.push({
        key: "fuel",
        label: FUEL_SUBTYPE_LABELS[activeFuelSubType as Exclude<FuelSubType, null>],
      })
    }

    if (activeFuelSubType && sortOrder === "desc") {
      chips.push({
        key: "sort",
        label: "Highest → Lowest",
      })
    }

    return chips
  }, [activeFuelType, activeFuelSubType, sortOrder])

  const removeChip = useCallback(
    (key: ActiveChip["key"]) => {
      switch (key) {
        case "fuelType":
          setActiveFuelType(null)
          setActiveFuelSubType(null)
          setSortOrder("asc")
          break
        case "fuel":
          // Keep fuel type filter, but stop sorting by specific fuel
          setActiveFuelSubType(null)
          setSortOrder("asc")
          break
        case "sort":
          setSortOrder("asc")
          break
      }
    },
    [],
  )

  const normalizeForModal = useCallback((station: any): NormalizedStation => {
    return {
      ...station,
      last_updated_by: station.users
        ? {
            id: station.users.id,
            full_name: station.users.full_name,
            b_show_name: station.users.b_show_name,
          }
        : undefined,
      isPending: false,
      isLoading: false,
      fetchError: false,
    }
  }, [])

  const openStationDetail = useCallback(
    (station: any) => {
      setSelectedStation(normalizeForModal(station))
      setIsReporting(false)
      priceInputsRef.current = {}
    },
    [normalizeForModal],
  )

  // Filter selection handlers (auto-collapse)
  const onSelectFuelType = (type: FuelType) => {
    setActiveFuelType(type)
    if (!type) {
      setActiveFuelSubType(null)
      setSortOrder("asc")
    } else {
      setActiveFuelSubType(type === "gas" ? "regular_gas" : "regular_diesel")
    }
    collapseFiltersSoon()
  }

  const onSelectFuelSubType = (sub: Exclude<FuelSubType, null>) => {
    setActiveFuelSubType(sub)
    collapseFiltersSoon()
  }

  const onSelectSort = (order: SortOrder) => {
    setSortOrder(order)
    collapseFiltersSoon()
  }

  const ListHeader = (
    <View>
      {favoriteStations.length > 0 && (
        <View style={themed($heading)}>
          <View style={$headerRow}>
            <Text preset="heading" text="Favorite Stations" />
            <View style={$headerPills}>
              <View style={[$pill, { backgroundColor: colors.palette.neutral200 }]}> 
                <Text size="xxs" weight="bold" style={{ color: colors.text }}>
                  {filteredAndSortedStations.length}/{favoriteStations.length}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {favoriteStations.length > 0 && (
        <View style={themed($filterCard)}>
          {/* Filters header row: entire row (except Clear) toggles expand/collapse */}
          <View style={$filterHeaderRow}>
            <Pressable
              onPress={() => setFiltersExpanded((p) => !p)}
              style={$filterHeaderPressable}
              accessibilityRole="button"
              accessibilityLabel={filtersExpanded ? "Collapse filters" : "Expand filters"}
              hitSlop={12}
            >
              <View style={$filterHeaderLeft}>
                <Text weight="bold" size="sm" style={{ color: colors.text }}>
                  Filters
                </Text>
                <Icon
                  icon={filtersExpanded ? "caret_down" : "caret_right"}
                  size={18}
                  color={colors.palette.neutral500}
                />
              </View>
            </Pressable>

            {hasActiveFilters && (
              <TouchableOpacity
                onPress={clearFilters}
                style={[$clearBtn, { borderColor: colors.palette.primary500 }]}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Clear all filters"
                hitSlop={12}
              >
                <Icon icon="close" size={14} color={colors.palette.primary500} />
                <Text size="xxs" weight="bold" style={{ color: colors.palette.primary500 }}>
                  Clear
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Active chips row (always visible if any filters applied) */}
          {activeChips.length > 0 && (
            <View style={$chipRow}>
              {activeChips.map((chip) => (
                <View
                  key={chip.key}
                  style={[$chipContainer, { borderColor: colors.palette.neutral300 }]}
                >
                  {/* Label area expands filters */}
                  <Pressable
                    onPress={() => setFiltersExpanded(true)}
                    style={({ pressed }) => [$chipLabelArea, pressed && { opacity: 0.85 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Active filter: ${chip.label}. Tap to edit.`}
                    hitSlop={8}
                  >
                    <Text size="xxs" weight="bold" style={{ color: colors.palette.neutral700 }}>
                      {chip.label}
                    </Text>
                  </Pressable>

                  {/* Close area removes this filter only */}
                  <Pressable
                    onPress={() => removeChip(chip.key)}
                    style={({ pressed }) => [$chipCloseArea, pressed && { opacity: 0.75 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${chip.label}`}
                    hitSlop={8}
                  >
                    <Text size="sm" style={{ color: colors.palette.neutral700, lineHeight: 16 }}>
                      ×
                    </Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {filtersExpanded && (
            <Animated.View entering={FadeInUp} exiting={FadeOutUp}>
              <View style={{ marginTop: spacing.sm }}>
                <Text weight="bold" size="xs" style={{ color: colors.text }}>
                  Fuel Type
                </Text>

                <View style={$segmentedControl(colors.palette.neutral200)}>
                  {([null, "gas", "diesel"] as const).map((type) => (
                    <TouchableOpacity
                      key={type ?? "none"}
                      style={[$segment, activeFuelType === type && $segmentActive]}
                      onPress={() => onSelectFuelType(type)}
                      activeOpacity={0.9}
                      accessibilityRole="button"
                      accessibilityLabel={type === "gas" ? "Fuel type Gasoline" : type === "diesel" ? "Fuel type Diesel" : "Fuel type None"}
                    >
                      <Text
                        size="xxs"
                        style={[
                          $segmentText(colors.palette.neutral500),
                          activeFuelType === type && $segmentTextActive(colors.palette.primary500),
                        ]}
                      >
                        {type === "gas" ? "Gasoline" : type === "diesel" ? "Diesel" : "None"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {activeFuelType && (
                  <>
                    <Text weight="bold" size="xs" style={{ color: colors.text, marginTop: spacing.sm }}>
                      Fuel
                    </Text>
                    <View style={$segmentedControl(colors.palette.neutral200)}>
                      {availableSubTypes.map((sub) => (
                        <TouchableOpacity
                          key={sub}
                          style={[$segment, activeFuelSubType === sub && $segmentActive, { paddingHorizontal: 12 }]}
                          onPress={() => onSelectFuelSubType(sub)}
                          activeOpacity={0.9}
                          accessibilityRole="button"
                          accessibilityLabel={`Fuel subtype ${FUEL_SUBTYPE_LABELS[sub]}`}
                        >
                          <Text
                            size="xxs"
                            style={[
                              $segmentText(colors.palette.neutral500),
                              activeFuelSubType === sub && $segmentTextActive(colors.palette.primary500),
                              { fontSize: 10 },
                            ]}
                          >
                            {FUEL_SUBTYPE_LABELS[sub]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text weight="bold" size="xs" style={{ color: colors.text, marginTop: spacing.sm }}>
                      Sort
                    </Text>
                    <View style={$segmentedControl(colors.palette.neutral200)}>
                      <TouchableOpacity
                        style={[$segment, sortOrder === "asc" && $segmentActive]}
                        onPress={() => onSelectSort("asc")}
                        activeOpacity={0.9}
                        accessibilityRole="button"
                        accessibilityLabel="Sort lowest to highest"
                      >
                        <Text
                          size="xxs"
                          style={[
                            $segmentText(colors.palette.neutral500),
                            sortOrder === "asc" && $segmentTextActive(colors.palette.primary500),
                          ]}
                        >
                          Lowest → Highest
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[$segment, sortOrder === "desc" && $segmentActive]}
                        onPress={() => onSelectSort("desc")}
                        activeOpacity={0.9}
                        accessibilityRole="button"
                        accessibilityLabel="Sort highest to lowest"
                      >
                        <Text
                          size="xxs"
                          style={[
                            $segmentText(colors.palette.neutral500),
                            sortOrder === "desc" && $segmentTextActive(colors.palette.primary500),
                          ]}
                        >
                          Highest → Lowest
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text size="xxs" style={$filterHint(colors.palette.neutral500)}>
                      Tip: Select a fuel type and we’ll sort your favorites by that fuel’s price.
                    </Text>
                  </>
                )}
              </View>
            </Animated.View>
          )}
        </View>
      )}
    </View>
  )

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={$styles.flex1}>
      <FlatList
        contentContainerStyle={[
          themed([$styles.container, $listContentContainer]),
          (filteredAndSortedStations.length === 0 || isError) && {
            flexGrow: 1,
            justifyContent: "center",
          },
        ]}
        data={isError ? [] : filteredAndSortedStations}
        refreshing={refreshing}
        onRefresh={manualRefresh}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={!isError ? ListHeader : null}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color={colors.palette.primary500} />
          ) : (
            <EmptyState
              preset="generic"
              style={{ marginTop: 0 }}
              heading={isError ? "Connection Error" : hasActiveFilters ? "No Matches" : "No Favorites Yet"}
              content={
                isError
                  ? "Cannot load your favorites. Please check your internet connection."
                  : hasActiveFilters
                    ? "Try adjusting your fuel filters."
                    : "Add gas stations to your favorites to see them here."
              }
              button={isError ? "Refresh" : hasActiveFilters ? "Clear Filters" : "Refresh"}
              buttonOnPress={
                isError
                  ? manualRefresh
                  : hasActiveFilters
                    ? clearFilters
                    : manualRefresh
              }
            />
          )
        }
        renderItem={({ item }) => (
          <FavoriteStationCard
            station={item}
            activeFuelSubType={activeFuelSubType}
            onOpenDetail={() => openStationDetail(item)}
            onOpenContributor={handleOpenContributor}
          />
        )}
      />

      <StationDetailModal
        selectedStation={selectedStation}
        setSelectedStation={setSelectedStation}
        isReporting={isReporting}
        setIsReporting={setIsReporting}
        favorites={favoriteIds}
        toggleFavorite={toggleFavoriteFromModal}
        handleUpdatePrice={handleUpdatePrice}
        priceInputsRef={priceInputsRef}
        showDirections={showDirections}
        onOpenContributor={handleOpenContributor}
        getDisplayName={getDisplayName}
        loggedInUserId={currentUserId}
        hasVoted={false}
        handleVerifyOrDenyPendingMarker={() => {}}
        handleCancelMyReport={() => {}}
      />

      <ContributorModal
        isVisible={isContributorModalVisible}
        contributorId={contributorIdToShow}
        onClose={() => {
          setIsContributorModalVisible(false)
          setContributorIdToShow(null)
        }}
      />
    </Screen>
  )
}

const FavoriteStationCard = ({
  station,
  activeFuelSubType,
  onOpenDetail,
  onOpenContributor,
}: {
  station: any
  activeFuelSubType: FuelSubType
  onOpenDetail: () => void
  onOpenContributor: (id: string) => void
}) => {
  const {
    theme: { colors },
    themed,
  } = useAppTheme()

  const badgePrice = useMemo(() => {
    if (!activeFuelSubType) return null
    const v = parseFloat(station[activeFuelSubType]) || 0
    return v > 0 ? v : null
  }, [activeFuelSubType, station])

  return (
    <Card
      style={themed([$item])}
      onPress={onOpenDetail}
      HeadingComponent={
        <View style={$cardHeader}>
          <View style={$titleRow}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text weight="bold" size="md" style={$stationName} numberOfLines={1}>
                {station.brand}
              </Text>

              {badgePrice !== null && (
                <View style={[$pricePill, { borderColor: colors.palette.primary500 }]}> 
                  <Text size="xxs" weight="bold" style={{ color: colors.palette.primary500 }}>
                    ₱{badgePrice.toFixed(2)}
                  </Text>
                </View>
              )}
            </View>

            <Icon icon="caret_right" size={18} color={colors.palette.neutral500} />
          </View>

          <View style={$metaRow}>
            <Text size="xxs" style={[$metadataText, { color: colors.palette.neutral500 }]}>
              {station.city} • Updated {station.updated_at ? formatDistanceToNow(new Date(station.updated_at), { addSuffix: true }) : "recently"}
            </Text>

            {station.users ? (
              <TouchableOpacity
                onPress={(e: any) => {
                  e?.stopPropagation?.()
                  onOpenContributor(station.users.id)
                }}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="View contributor"
              >
                <Text size="xxs" style={[$metadataText, { color: colors.palette.primary500, fontWeight: "700" }]}>
                  {" "}by {getDisplayName(station.users.full_name, station.users.b_show_name)}
                </Text>
              </TouchableOpacity>
            ) : (
              <Text size="xxs" style={[$metadataText, { color: colors.palette.neutral500, fontWeight: "700" }]}>
                {" "}by System
              </Text>
            )}
          </View>

          <Text size="xxs" style={[$tapHint, { color: colors.palette.neutral500 }]}>
            Tap to view details, directions, or update prices
          </Text>
        </View>
      }
    />
  )
}

// ---------------- Styles ----------------
const $listContentContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.lg,
  paddingBottom: spacing.lg,
})

const $heading: ThemedStyle<ViewStyle> = ({ spacing }) => ({ marginBottom: spacing.md })

const $item: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  padding: spacing.md,
  marginTop: spacing.md,
  backgroundColor: colors.palette.neutral100,
  borderRadius: 18,
})

const $cardHeader: ViewStyle = { gap: 6 }

const $titleRow: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
}

const $stationName: TextStyle = { flex: 1 }
const $metaRow: ViewStyle = { flexDirection: "row", flexWrap: "wrap", alignItems: "center" }
const $metadataText: TextStyle = { opacity: 0.85 }

const $tapHint: TextStyle = {
  opacity: 0.8,
  marginTop: 2,
}

const $headerRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
}

const $headerPills: ViewStyle = { flexDirection: "row", alignItems: "center" }
const $pill: ViewStyle = { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }

const $filterCard: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.neutral100,
  borderRadius: 16,
  padding: spacing.md,
  borderWidth: StyleSheet.hairlineWidth,
  borderColor: colors.palette.neutral300,
  marginBottom: spacing.md,
})

const $filterHeaderRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
}

const $filterHeaderPressable: ViewStyle = {
  flex: 1,
  paddingVertical: 10,
  paddingRight: 10,
}

const $filterHeaderLeft: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
}

const $clearBtn: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderRadius: 999,
  borderWidth: 1,
  backgroundColor: "rgba(23,55,186,0.06)",
}

const $chipRow: ViewStyle = {
  flexDirection: "row",
  flexWrap: "wrap",
  marginTop: 10,
}

// Chip container with separate label and close areas for reliable touch handling.
const $chipContainer: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  borderWidth: 1,
  borderRadius: 999,
  backgroundColor: "rgba(0,0,0,0.03)",
  marginRight: 8,
  marginBottom: 8,
  overflow: "hidden",
}

const $chipLabelArea: ViewStyle = {
  paddingHorizontal: 10,
  paddingVertical: 6,
}

const $chipCloseArea: ViewStyle = {
  paddingHorizontal: 10,
  paddingVertical: 6,
  borderLeftWidth: StyleSheet.hairlineWidth,
  borderLeftColor: "rgba(0,0,0,0.12)",
  alignItems: "center",
  justifyContent: "center",
}

const $segmentedControl = (bg: string): ViewStyle => ({
  flexDirection: "row",
  backgroundColor: bg,
  borderRadius: 10,
  padding: 2,
  marginTop: 8,
})

const $segment: ViewStyle = { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 }
const $segmentActive: ViewStyle = { backgroundColor: "white", elevation: 2 }
const $segmentText = (color: string): TextStyle => ({ fontSize: 12, color })
const $segmentTextActive = (color: string): TextStyle => ({ color, fontWeight: "bold" })

const $filterHint = (color: string): TextStyle => ({ opacity: 0.75, marginTop: 8, color })

const $pricePill: ViewStyle = {
  borderWidth: 1,
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 999,
  backgroundColor: "rgba(23,55,186,0.06)",
}
