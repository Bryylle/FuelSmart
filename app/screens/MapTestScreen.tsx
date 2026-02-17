import { FC, useMemo, useState, useRef } from "react"
import {
  Platform,
  Pressable,
  View,
  ViewStyle,
  TextStyle,
  Image,
  ImageStyle,
  ScrollView,
  TouchableOpacity,
  PixelRatio,
  Linking,
} from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import { Icon } from "@/components/Icon"
import { Header } from "@/components/Header"
import MapView, { PROVIDER_GOOGLE, Marker, Region } from "react-native-maps"
import { supabase } from "@/services/supabase"
import { debounce } from "lodash"
import type { ThemedStyle } from "@/theme/types"
import Animated, { SlideInDown, SlideOutDown } from "react-native-reanimated"

// --- CONSTANTS FROM MAPSCREEN.TSX ---
const ZOOM_THRESHOLD = 0.05 
const DEBOUNCE_TIME = 500
const MAX_STATIONS = 300
const FUEL_MARKER = require("@assets/icons/marker_isolated.png")
const HAIRLINE = 1 / PixelRatio.get()

// Fuel mapping logic from MapScreen's design
const FUEL_TYPES = [
  { key: "regular_gas", label: "REGULAR" },
  { key: "premium_gas", label: "PREMIUM" },
  { key: "sports_gas", label: "SPORTS" },
  { key: "regular_diesel", label: "DIESEL" },
  { key: "premium_diesel", label: "PREMIUM D." },
]

export const MapTestScreen: FC<DemoTabScreenProps<"MapTest">> = ({ navigation }) => {
  const { themed } = useAppTheme()
  const mapRef = useRef<MapView>(null)

  const [stations, setStations] = useState<any[]>([])
  const [region, setRegion] = useState<Region | null>(null)
  const [selectedStation, setSelectedStation] = useState<any>(null)

  const fetchStations = async (currentRegion: Region) => {
    if (currentRegion.latitudeDelta > ZOOM_THRESHOLD) return
    try {
      const minLat = currentRegion.latitude - currentRegion.latitudeDelta / 2
      const maxLat = currentRegion.latitude + currentRegion.latitudeDelta / 2
      const minLng = currentRegion.longitude - currentRegion.longitudeDelta / 2
      const maxLng = currentRegion.longitude + currentRegion.longitudeDelta / 2

      const { data } = await supabase
        .from("fuel_stations")
        .select(`id, brand, latitude, longitude`)
        .gte("latitude", minLat)
        .lte("latitude", maxLat)
        .gte("longitude", minLng)
        .lte("longitude", maxLng)
        .limit(MAX_STATIONS)

      if (data) {
        setStations((prev) => {
          const stationMap = new Map(prev.map((s) => [s.id, s]))
          data.forEach((s) => stationMap.set(s.id, s))
          return Array.from(stationMap.values())
        })
      }
    } catch (e) { console.error(e) }
  }

  const handleMarkerPress = async (stationId: string) => {
    try {
      const { data } = await supabase
        .from("fuel_stations")
        .select("*")
        .eq("id", stationId)
        .single()
      if (data) setSelectedStation(data)
    } catch (e) { console.error(e) }
  }

  const openDirections = () => {
    if (!selectedStation) return
    const { latitude, longitude, brand } = selectedStation
    const label = encodeURIComponent(brand)
    const url = Platform.select({
      ios: `maps:0,0?q=${label}@${latitude},${longitude}`,
      android: `geo:0,0?q=${latitude},${longitude}(${label})`,
    })
    if (url) Linking.openURL(url)
  }

  const debouncedFetch = useMemo(() => debounce((r: Region) => fetchStations(r), DEBOUNCE_TIME), [])
  const onRegionChangeComplete = (newRegion: Region) => {
    setRegion(newRegion)
    debouncedFetch(newRegion)
  }

  // Filter fuel types that actually have a value (Source of Truth logic)
  const availableFuels = useMemo(() => {
    if (!selectedStation) return []
    return FUEL_TYPES.filter(f => selectedStation[f.key] !== null && selectedStation[f.key] !== undefined)
  }, [selectedStation])

  return (
    <View style={themed($container)}>
      <Header
        title="Map Testing"
        safeAreaEdges={["top"]}
        LeftActionComponent={
          <View style={$leftActionWrapper}>
            <Pressable onPress={() => navigation.goBack()}>
              <Icon icon="arrowLeft" size={24} color={"#fff"} />
            </Pressable>
          </View>
        }
        style={themed($headerStyle)}
        titleStyle={themed($headerTitle)}
      />

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={themed($map)}
        initialRegion={{ latitude: 14.5995, longitude: 120.9842, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        onRegionChangeComplete={onRegionChangeComplete}
        onPress={() => setSelectedStation(null)}
        showsUserLocation
      >
        {stations.map((s) => (
          <Marker
            key={s.id}
            coordinate={{ latitude: Number(s.latitude), longitude: Number(s.longitude) }}
            onPress={() => handleMarkerPress(s.id)}
            tracksViewChanges={false}
            image={FUEL_MARKER}
          />
        ))}
      </MapView>

      {selectedStation && (
        <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={themed($stationCardContainer)}>
          <View style={themed($dragHandle)} />
          
          <View style={themed($headerContainer)}>
            <View style={{ flex: 1 }}>
              <Text text={selectedStation.brand} preset="subheading" weight="bold" />
              <Text text="Reported by Verified User • Just now" size="xxs" style={{ color: "#8E8E93" }} />
            </View>
            <TouchableOpacity onPress={openDirections} style={themed($directionsBtn)}>
              <Icon icon="directions" size={20} color="#007AFF" />
              <Text text="Directions" size="xs" style={{ color: "#007AFF", marginLeft: 4 }} />
            </TouchableOpacity>
          </View>

          <View style={themed($priceDashboard)}>
            <ScrollView contentContainerStyle={themed($scrollContentInternal)} showsVerticalScrollIndicator={false}>
              <View style={themed($priceGridContainer)}>
                {availableFuels.map((fuel, index) => (
                  <View key={fuel.key} style={$dataEntry}>
                    <Text text={fuel.label} style={$dataLabel} />
                    <Text text={`₱${Number(selectedStation[fuel.key]).toFixed(2)}`} style={$dataValue} />
                    {(index + 1) % 3 !== 0 && index !== availableFuels.length - 1 && <View style={$verticalDivider} />}
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          <TouchableOpacity style={themed($updateButton)}>
             <Text text="Update Prices" weight="semiBold" style={{ color: "white" }} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {region && region.latitudeDelta > ZOOM_THRESHOLD && (
        <View style={themed($zoomNotice)}>
          <Text text="Zoom in to see gas stations" size="xs" weight="semiBold" style={{ color: "white" }} />
        </View>
      )}
    </View>
  )
}

// --- IDENTICAL STYLES FROM MAPSCREEN.TSX ---
const $container: ThemedStyle<ViewStyle> = () => ({ flex: 1 })
const $map: ThemedStyle<ViewStyle> = () => ({ flex: 1 })
const $headerStyle: ThemedStyle<ViewStyle> = () => ({ backgroundColor: "#1737ba" })
const $headerTitle: ThemedStyle<TextStyle> = () => ({ color: "#fff" })
const $leftActionWrapper: ViewStyle = { justifyContent: "center", alignItems: "center", marginLeft: 16 }

const $stationCardContainer: ThemedStyle<ViewStyle> = ({ colors }) => ({
  position: "absolute", bottom: 0, left: 0, right: 0,
  backgroundColor: colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32,
  paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 40 : 24,
  shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 20,
})

const $dragHandle: ThemedStyle<ViewStyle> = () => ({
  width: 38, height: 5, backgroundColor: "#E5E5EA", borderRadius: 3, alignSelf: "center", marginTop: 10,
})

const $headerContainer: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingTop: 12, marginBottom: 10,
})

const $directionsBtn: ThemedStyle<ViewStyle> = () => ({
  flexDirection: "row", alignItems: "center", backgroundColor: "#F2F2F7",
  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
})

const $priceDashboard: ThemedStyle<ViewStyle> = () => ({
  backgroundColor: "#F2F2F7", borderRadius: 16, marginTop: 10, height: 160, borderWidth: 1, borderColor: "#E5E5EA",
})

const $scrollContentInternal: ViewStyle = { paddingVertical: 14, paddingHorizontal: 8 }
const $priceGridContainer: ViewStyle = { flexDirection: "row", flexWrap: "wrap", rowGap: 16 }
const $dataEntry: ViewStyle = { width: "33.33%", alignItems: "center" }
const $verticalDivider: ViewStyle = { position: 'absolute', right: 0, height: '60%', width: 1, backgroundColor: "#D1D1D6", top: '20%' }
const $dataLabel: TextStyle = { color: "#8E8E93", fontSize: 10, fontWeight: "600" }
const $dataValue: TextStyle = { color: "#1C1C1E", fontSize: 18, fontWeight: "700" }
const $updateButton: ThemedStyle<ViewStyle> = () => ({
  backgroundColor: "#007AFF", height: 56, borderRadius: 16, justifyContent: "center", alignItems: "center", marginTop: 20,
})

const $zoomNotice: ThemedStyle<ViewStyle> = () => ({
  position: "absolute", top: Platform.OS === "ios" ? 120 : 100, alignSelf: "center",
  backgroundColor: "rgba(0,0,0,0.6)", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20,
})