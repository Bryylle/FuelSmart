import { FC, useEffect, useRef, useState, useMemo, useCallback } from "react"
import * as React from "react"
import Animated, { FadeIn, FadeInUp, FadeOutUp } from "react-native-reanimated"
import { 
  TextStyle, View, ViewStyle, TouchableOpacity, 
  Linking, ScrollView, StyleSheet, Pressable, TextInput, Alert, 
  KeyboardAvoidingView, Platform, Modal, ActivityIndicator, PixelRatio, Image
} from "react-native"
import * as Clipboard from "expo-clipboard"
import { formatDistanceToNow } from "date-fns"
import * as Location from "expo-location"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import MapView, { PROVIDER_GOOGLE, Marker } from "react-native-maps"
import { Icon, PressableIcon } from "@/components/Icon"
import { colors } from "@/theme/colorsDark"

import { supabase } from "@/services/supabase" 
import { initFuelMappings, FUEL_BRAND_MAP } from "../utils/fuelMappings"
import { useAppTheme } from "@/theme/context"
import { Header } from "@/components/Header"
import type { ThemedStyle } from "@/theme/types"
import Slider from '@react-native-community/slider'

const FUEL_MARKER = require("@assets/icons/marker_isolated.png")
const HAIRLINE = 1 / PixelRatio.get()

interface Station {
  id: string; brand: string; city: string; latitude: number; longitude: number;
  regular_gas?: number; premium_gas?: number; sports_gas?: number;
  regular_diesel?: number; premium_diesel?: number; 
  updated_at: string; is_verified: boolean; b_show_firstname: boolean;
  reporter_id?: string; // For pending stations
  isPending?: boolean;  // Added this
  last_updated_by?: string;
  users?: { 
    id: string;
    firstname: string; 
    lastname: string; 
    phone?: string; 
    no_contributions?: number; 
    no_likes?: number; 
    no_incorrect_reports?: number;
    b_show_gcash?: boolean;
    b_show_maya?: boolean;
  }; 
  [key: string]: any;
}
interface ReportData {
  brand: string;
  city: string;
  // Availability toggles
  has_regular_gas: boolean;
  has_premium_gas: boolean;
  has_sports_gas: boolean;
  has_regular_diesel: boolean;
  has_premium_diesel: boolean;
  // Marketing names
  regular_gas_name: string;
  premium_gas_name: string;
  sports_gas_name: string;
  regular_diesel_name: string;
  premium_diesel_name: string;
}

// 2. Initialize the state with the proper type


// Helper for distance calculation
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371 
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export const MapScreen: FC = () => {
  const mapRef = useRef<any>(null)
  // 1. Create a state to hold the map's layout height
  const [mapLayout, setMapLayout] = useState({ width: 0, height: 0 })
  const [reportData, setReportData] = useState<ReportData>({
    brand: "",
    city: "",
    has_regular_gas: false,
    has_premium_gas: false,
    has_sports_gas: false,
    has_regular_diesel: false,
    has_premium_diesel: false,
    regular_gas_name: "",
    premium_gas_name: "",
    sports_gas_name: "",
    regular_diesel_name: "",
    premium_diesel_name: "",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [stations, setStations] = useState<Station[]>([])
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [isMapReady, setIsMapReady] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null)

  const [activeFuelType, setActiveFuelType] = useState<"gas" | "diesel">("gas")
  const [activeMaxPrice, setActiveMaxPrice] = useState<string>("")
  const [activeBrands, setActiveBrands] = useState<string[]>([]) 
  const [activeDistance, setActiveDistance] = useState<number | null>(120) // Default to 120

  const [tempFuelType, setTempFuelType] = useState<"gas" | "diesel">("gas")
  const [tempMaxPrice, setTempMaxPrice] = useState<string>("")
  const [tempBrands, setTempBrands] = useState<string[]>([]) 
  const [tempDistance, setTempDistance] = useState<number | null>(120) // Default to 120

  const [isFilterVisible, setIsFilterVisible] = useState(false)
  const [isBrandPickerVisible, setIsBrandPickerVisible] = useState(false)
  const [isReporting, setIsReporting] = useState(false)
  const [reportPrices, setReportPrices] = useState<Record<string, string>>({})
  
  const [isUserInfoVisible, setIsUserInfoVisible] = useState(false)
  const [isVoting, setIsVoting] = useState(false)
  const [mappingsLoaded, setMappingsLoaded] = useState(false)

  useEffect(() => {
    const setup = async () => {
      await initFuelMappings()
      setMappingsLoaded(true) // Trigger a re-render once DB data is ready
    }
    setup()
  }, [])

  // 1. Update the initialization useEffect to restore Auth
  useEffect(() => {
    const initialize = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        let location = await Location.getCurrentPositionAsync({})
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        })
      }

      // RESTORED: Get the logged in user
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        fetchUserFavorites(user.id)
      }
    }
    initialize()
  }, [])

  useEffect(() => {
    if (userLocation) {
      fetchStations()
    }
  }, [userLocation])

  const fetchStations = async () => {
    if (!userLocation) return
    try {
      setIsLoading(true)
      const { data, error } = await supabase.rpc('get_stations_in_radius', {
        user_lat: userLocation.latitude,
        user_lon: userLocation.longitude,
        radius_km: 120 
      })

      if (error) throw error

      const formattedData = data?.map((station: any) => ({
        ...station,
        users: (station.users && station.users.id) ? station.users : null
      }))

      setStations(formattedData || [])
    } catch (e) {
      console.error("Fetch Error:", e)
    } finally {
      setIsLoading(false)
    }
  }

  const getRankColor = (contributions: number = 0) => {
    if (contributions <= 30) return "#4CD964"
    if (contributions <= 50) return "#007AFF"
    if (contributions <= 70) return "#AF52DE"
    return "#FFD700"
  }

  const handleVote = async (type: 'like' | 'dislike') => {
    const targetUserId = selectedStation?.users?.id
    if (!targetUserId || !currentUserId || targetUserId === currentUserId || isVoting) return

    setIsVoting(true)
    const { error } = await supabase.rpc('handle_user_vote', {
      _voter_id: currentUserId,
      _target_id: targetUserId,
      _vote_type: type
    })

    if (error) {
      if (error.code === '23505') {
        Alert.alert("Already Voted", "You have already provided feedback for this contributor.")
      } else {
        console.error("Voting error:", error)
        Alert.alert("Error", "Unable to process vote.")
      }
    } else {
      Alert.alert("Success", `You ${type}d this update.`)
      await fetchStations()
      if (selectedStation && selectedStation.users) {
        const field = type === 'like' ? 'no_likes' : 'no_incorrect_reports'
        setSelectedStation({
            ...selectedStation,
            users: {
                ...selectedStation.users,
                [field]: (selectedStation.users[field] || 0) + 1
            }
        })
      }
    }
    setIsVoting(false)
  }

  const handleVerifyOrDeny = async (reportId: string, isConfirm: boolean) => {
    if (!currentUserId || isVoting) return
    setIsVoting(true)

    const { data, error } = await supabase.rpc('verify_or_deny_report', {
      report_id: reportId,
      current_user_id: currentUserId,
      is_confirm: isConfirm
    })

    if (error) {
      Alert.alert("Error", error.message)
      setIsVoting(false)
      return
    }

    if (isConfirm) {
      if (data === 'STATION_PROMOTED') {
        Alert.alert("Success!", "Station verified and added to the map!")
        fetchStations() 
      } else {
        Alert.alert("Confirmed", "Your verification has been recorded.")
      }
    } else {
      // DENIAL / CORRECTION FLOW
      if (data === 'REPORT_DELETED_BY_DENIALS') {
        Alert.alert("Report Removed", "This station was deleted due to multiple denials.")
      } else {
        Alert.alert(
          "Incorrect Details?",
          "Would you like to provide the correct details for this location instead?",
          [
            { text: "No", style: "cancel" },
            { 
              text: "Yes, Correct it", 
              onPress: async () => {
                // Guard clause: If for some reason station is null, stop here
                if (!selectedStation) return;

                const eligible = await toggleAddMode()
                // Now TypeScript knows selectedStation exists here
                setTempMarker({ 
                  ...region, 
                  latitude: Number(selectedStation.latitude), 
                  longitude: Number(selectedStation.longitude) 
                })
                setReportModalVisible(true)
              }
            }
          ]
        )
      }
    }
    
    setSelectedStation(null)
    fetchPending()
    setIsVoting(false)
  }

  const availableBrands = useMemo(() => 
    Array.from(new Set(stations.map(s => s.brand))).filter(Boolean).sort(), 
  [stations])

  const filteredStations = useMemo(() => {
    return stations.filter((s) => {
      if (activeBrands.length > 0 && !activeBrands.includes(s.brand)) return false
      
      const price = activeFuelType === "gas" ? (s.regular_gas || 0) : (s.regular_diesel || 0)
      const limit = parseFloat(activeMaxPrice)
      if (!isNaN(limit) && limit > 0 && (price === 0 || price > limit)) return false

      if (activeDistance && userLocation) {
        const dist = getDistance(userLocation.latitude, userLocation.longitude, s.latitude, s.longitude)
        if (dist > activeDistance) return false
      }

      return true
    })
  }, [stations, activeFuelType, activeMaxPrice, activeBrands, activeDistance, userLocation])

  const handleMarkerPress = useCallback((station: Station) => {
    if (selectedStation?.id === station.id) return
    setTimeout(() => {
      setSelectedStation(station)
      setIsReporting(false)
      setReportPrices({})
    }, 100)
  }, [selectedStation])

  const hasFilterApplied = useMemo(() => {
    // Check if active values differ from their original defaults
    const isFuelChanged = activeFuelType !== "gas"
    const isPriceChanged = activeMaxPrice !== ""
    const isDistanceChanged = activeDistance !== 120 && activeDistance !== null
    const isBrandsChanged = activeBrands.length > 0

    return isFuelChanged || isPriceChanged || isDistanceChanged || isBrandsChanged
  }, [activeFuelType, activeMaxPrice, activeDistance, activeBrands])

  const handleApplyAll = () => { 
    setActiveFuelType(tempFuelType)
    setActiveMaxPrice(tempMaxPrice)
    setActiveBrands([...tempBrands])
    setActiveDistance(tempDistance)
    setIsFilterVisible(false) 
  }
  
  const handleCancelFilters = () => { 
    setTempFuelType(activeFuelType)
    setTempMaxPrice(activeMaxPrice)
    setTempBrands([...activeBrands])
    setTempDistance(activeDistance)
    setIsFilterVisible(false) 
  }

  // Update handleClearAll to reset to 120
  const handleClearAll = () => { 
    setTempFuelType("gas")
    setTempMaxPrice("")
    setTempBrands([])
    setTempDistance(120) // Reset to 120
    
    setActiveFuelType("gas")
    setActiveMaxPrice("")
    setActiveBrands([])
    setActiveDistance(120) // Reset to 120
  }

  const toggleFavorite = async () => {
    if (!selectedStation || !currentUserId) return
    const isFav = favorites.includes(selectedStation.id)
    if (!isFav && favorites.length >= 5) return Alert.alert("Limit Reached", "Max 5 favorites allowed.")
    const newFavs = isFav ? favorites.filter(id => id !== selectedStation.id) : [...favorites, selectedStation.id]
    
    const { error } = await supabase
      .from('users')
      .update({ favorite_stations: newFavs })
      .eq('id', currentUserId)

    if (error) {
      console.error("Favorite Error:", error)
      Alert.alert("Error", "Could not update favorites.")
    } else {
      setFavorites(newFavs)
    }
  }

  const fetchUserFavorites = async (userId: string) => {
    const { data } = await supabase.from('users').select('favorite_stations').eq('id', userId).single()
    if (data) setFavorites(data.favorite_stations || [])
  }

  const handleUpdatePrice = async () => {
    if (!selectedStation || !currentUserId) {
      Alert.alert("Error", "User or Station information is missing.");
      return;
    }

    const getValidPrice = (key: string) => {
      const input = reportPrices[key];
      const existing = Number(selectedStation[key]);
      if (input !== undefined && input.trim() !== "" && !isNaN(parseFloat(input))) {
        return parseFloat(input);
      }
      return existing || 0;
    };

    const rpcData = {
      _station_id: selectedStation.id,
      _user_id: currentUserId,
      _regular_gas: getValidPrice("regular_gas"),
      _premium_gas: getValidPrice("premium_gas"),
      _sports_gas: getValidPrice("sports_gas"),
      _regular_diesel: getValidPrice("regular_diesel"),
      _premium_diesel: getValidPrice("premium_diesel"),
    };

    try {
      const { error } = await supabase.rpc('submit_fuel_report', rpcData);
      if (error) {
        Alert.alert("Update Failed", error.message);
      } else {
        Alert.alert("Success", "Station prices updated!");
        setIsReporting(false);
        setSelectedStation(null);
        fetchStations();
      }
    } catch (err) {
      Alert.alert("Error", "A connection error occurred.");
    }
  };

  const handleCopyNumber = (number: string) => {
    Clipboard.setStringAsync(number)
    Alert.alert("Copied", "Mobile number copied to clipboard.")
  }

  const { themed } = useAppTheme()

  // Track the current region as the user moves the map
  const [region, setRegion] = useState({
    latitude: 12.8797,
    longitude: 121.7740,
    latitudeDelta: 15,
    longitudeDelta: 15,
  })
  // --- NEW REPORTING STATES ---
  const [isAddMode, setIsAddMode] = useState(false)
  const [pendingStations, setPendingStations] = useState<any[]>([])
  const [reportModalVisible, setReportModalVisible] = useState(false)
  const [tempMarker, setTempMarker] = useState(region) // Syncs with your line 249 'region'
  const [isSubmitting, setIsSubmitting] = useState(false)

  // --- FETCH PENDING REPORTS ---
  const fetchPending = useCallback(async () => {
    const { data } = await supabase.from('user_reported_locations').select('*')
    if (data) setPendingStations(data)
  }, [])

  useEffect(() => {
    fetchPending()
  }, [fetchPending])

  // --- ELIGIBILITY & SPAM CHECK ---
  const toggleAddMode = async () => {
    if (isAddMode) {
      setIsAddMode(false)
      return
    }

    if (!currentUserId) {
      Alert.alert("Authentication", "Please log in to report stations.")
      return
    }

    // 1. Check for Penalty (no_incorrect_reports >= 3)
    const { data: userData } = await supabase
      .from('users')
      .select('no_incorrect_reports')
      .eq('id', currentUserId)
      .single()

    if (userData && userData.no_incorrect_reports >= 3) {
      Alert.alert("Access Restricted", "You cannot add markers because you reached 3 incorrect reports.")
      return
    }

    // 2. Check for Active Report (Spam Prevention: Max 1)
    const { count } = await supabase
      .from('user_reported_locations')
      .select('*', { count: 'exact', head: true })
      .eq('reporter_id', currentUserId)

    if (count && count > 0) {
      Alert.alert("Action Required", "You have a pending report. Please wait for it to be confirmed before adding another.")
      return
    }

    setTempMarker(region) // Start the pin at current map center
    setIsAddMode(true)
  }

  const MAP_STYLE = [
    {
      featureType: "poi",
      elementType: "all", // This covers labels AND icons
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "transit",
      elementType: "all",
      stylers: [{ visibility: "off" }],
    }
  ]

  const zoomToMarkerVisibleLevel = () => {
    if (!mapRef.current) return
    
    mapRef.current.animateToRegion({
      ...region,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    }, 600)
  }
  const isNotAtMarkerLevel = Math.abs(region.latitudeDelta - 0.04) > 0.01;

  const handleFinalSubmit = async (data: ReportData, coords: any) => {
    // 1. Check for Brand and City
    if (!data.brand.trim() || !data.city.trim()) {
      Alert.alert("Missing Information", "Please provide both the Brand and the Municipality/City.")
      return
    }
    // 2. Check if at least one fuel toggle is active
    const hasAtLeastOneFuel = 
      data.has_regular_gas || 
      data.has_premium_gas || 
      data.has_sports_gas || 
      data.has_regular_diesel || 
      data.has_premium_diesel

    if (!hasAtLeastOneFuel) {
      Alert.alert(
        "No Fuels Selected", 
        "Please toggle at least one fuel type that is available at this station."
      )
      return
    }

    // 3. Optional: Check if the toggled fuel actually has a name typed in
    // This ensures they didn't just hit 'Yes' but left the label blank
    const activeTogglesWithoutNames = [
      data.has_regular_gas && !data.regular_gas_name,
      data.has_premium_gas && !data.premium_gas_name,
      data.has_sports_gas && !data.sports_gas_name,
      data.has_regular_diesel && !data.regular_diesel_name,
      data.has_premium_diesel && !data.premium_diesel_name,
    ].some(condition => condition === true)

    if (activeTogglesWithoutNames) {
      Alert.alert("Missing Names", "Please provide a marketing name for the fuel types you enabled.")
      return
    }

    setIsSubmitting(true)
    const { error } = await supabase.from('user_reported_locations').insert([{
      reporter_id: currentUserId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      brand: data.brand,
      city: data.city,
     // Only save names if the toggle was true
      regular_gas_name: data.has_regular_gas ? data.regular_gas_name : null,
      premium_gas_name: data.has_premium_gas ? data.premium_gas_name : null,
      sports_gas_name: data.has_sports_gas ? data.sports_gas_name : null,
      regular_diesel_name: data.has_regular_diesel ? data.regular_diesel_name : null,
      premium_diesel_name: data.has_premium_diesel ? data.premium_diesel_name : null,
    }])

    if (error) {
      Alert.alert("Error", error.message)
    } else {
      Alert.alert("Success", "Report submitted for verification.")
      setReportModalVisible(false)
      setIsAddMode(false)
      await fetchPending()
      // Reset form to empty strings
      setReportData({
        brand: "", city: "", 
        has_regular_gas: false, 
        has_premium_gas: false, 
        has_sports_gas: false, 
        has_regular_diesel: false, 
        has_premium_diesel: false,
        regular_gas_name: "", 
        premium_gas_name: "", 
        sports_gas_name: "",
        regular_diesel_name: "", 
        premium_diesel_name: ""
      })
    }
    setIsSubmitting(false)
  }

  const renderFuelToggle = (label: string, boolKey: keyof ReportData, nameKey: keyof ReportData, placeholder: string) => (
    <View style={{ marginTop: 12 }}>
      <View style={$toggleRow}>
        <Text text={label} style={{ flex: 1 }} />
        <TouchableOpacity 
          onPress={() => setReportData({ ...reportData, [boolKey]: !reportData[boolKey] })}
          style={[$toggleBtn, reportData[boolKey] && $toggleBtnActive]}
        >
          <Text text={reportData[boolKey] ? "YES" : "NO"} size="xs" style={{ color: "white", fontWeight: "bold" }} />
        </TouchableOpacity>
      </View>
      {reportData[boolKey] && (
        <Animated.View entering={FadeInUp}>
          <TextInput 
            placeholder={`Marketing Name (${placeholder})`} 
            style={$miniInput} 
            placeholderTextColor="#999"
            value={reportData[nameKey] as string}
            onChangeText={(t) => setReportData({ ...reportData, [nameKey]: t })} 
          />
        </Animated.View>
      )}
    </View>
  )
  const isAnimating = useRef(false)

  const toggle3DView = async () => {
    if (!mapRef.current) return

    isAnimating.current = true
    const currentCamera = await mapRef.current.getCamera()

    // If already tilted, flatten it. Otherwise, tilt it.
    const is3D = currentCamera.pitch > 0

    mapRef.current.animateCamera({
      center: {
        latitude: region.latitude,
        longitude: region.longitude,
      },
      heading: currentCamera.heading,
      pitch: is3D ? 0 : 55,      
      zoom: is3D ? 15 : 17,       
    }, { duration: 600 })
    // Release the lock after animation completes
    setTimeout(() => { isAnimating.current = false }, 650)
  }

  return (
    <Screen contentContainerStyle={{ flex: 1 }}>
      <Header
        safeAreaEdges={["top"]} 
        RightActionComponent={
          <View style={$leftActionWrapper}>
            <Pressable style={{ marginRight: 10 }}>
              <Icon icon="information" size={30} color={"#fff"} />
            </Pressable>
          </View>
        }
        style={themed($headerStyle)}
        titleStyle={themed($headerTitle)}
      />
      <View 
        style={{ flex: 1 }} 
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout
          setMapLayout({ width, height })
        }}
      >
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFill}
          showsUserLocation={true}
          // initialRegion={{ latitude: 12.8797, longitude: 121.7740, latitudeDelta: 15, longitudeDelta: 15 }}
          onMapReady={() => setIsMapReady(true)}
          mapPadding={{top: 110, left: 0, right:0, bottom: 0}}
          toolbarEnabled={false}
          initialRegion={region}
          customMapStyle={MAP_STYLE}
          onRegionChangeComplete={(newRegion) => {
            setRegion(newRegion)
            if (isAddMode) {
              setTempMarker(newRegion) // Reporting state
            }
          }}
        >
          {region.latitudeDelta < 0.05 && filteredStations.map((station) => (
            <Marker
              key={`marker-${station.id}-${station.updated_at}`}
              coordinate={{ latitude: Number(station.latitude), longitude: Number(station.longitude) }}
              onPress={() => handleMarkerPress(station)}
              onSelect={() => handleMarkerPress(station)}
              tracksViewChanges={false}
              image={FUEL_MARKER}
            />
          ))}
          {/* Loop 2: PENDING STATIONS (New verification logic) */}
          {region.latitudeDelta < 0.05 && pendingStations.map((ps) => (
            <Marker 
              key={`pending-${ps.id}`} 
              coordinate={{ latitude: Number(ps.latitude), longitude: Number(ps.longitude) }}
              pinColor="orange"
              onPress={() => setSelectedStation({ ...ps, isPending: true })} 
            />
          ))}
        </MapView>

        {/* 3. Place Crosshair inside the same View */}
        {isAddMode && (
          <View 
            style={[
              $crosshairContainer, 
              { 
                width: mapLayout.width,
                height: mapLayout.height,
                // OFFSET: Move the crosshair up by half of the bottom mapPadding
                // to stay aligned with Google's logical center
                marginTop: 55, 
              }
            ]} 
            pointerEvents="none"
          >
            <Icon icon="close" color={colors.palette.primary500} size={40} />
            <View style={$crosshairDot} />
          </View>
        )}
      </View>

      
      {isNotAtMarkerLevel && (
        <View style={$markerLevelButtonWrapper}>
          <TouchableOpacity 
            style={$markerLevelPill} 
            onPress={zoomToMarkerVisibleLevel}
            activeOpacity={0.9}
          >
            <Text style={$pillText}>Reset View</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={reportModalVisible} animationType="slide" transparent>
        <View style={$brandModalOverlay}>
          <View style={[$brandModalContent, { width: '90%' }]}>
            <Text preset="subheading" text="Report New Station" />
            <ScrollView style={{ maxHeight: 450, marginTop: 10 }} showsVerticalScrollIndicator={false}>
              <TextInput 
                placeholder="Brand (e.g. Shell)" 
                style={$filterInput} 
                value={reportData.brand}
                onChangeText={(t) => setReportData({ ...reportData, brand: t })} 
              />
              <TextInput 
                placeholder="Municipality/City" 
                style={$filterInput} 
                value={reportData.city}
                onChangeText={(t) => setReportData({ ...reportData, city: t })} 
              />
              
              <Text text="Available Fuel Types" weight="bold" style={{ marginTop: 20, marginBottom: 5 }} />
              
              {/* All 5 Toggles */}
              {renderFuelToggle("Regular Gasoline", "has_regular_gas", "regular_gas_name", "e.g. FuelSave")}
              {renderFuelToggle("Premium Gasoline", "has_premium_gas", "premium_gas_name", "e.g. V-Power")}
              {renderFuelToggle("Sports Gasoline", "has_sports_gas", "sports_gas_name", "e.g. V-Power Racing")}
              {renderFuelToggle("Regular Diesel", "has_regular_diesel", "regular_diesel_name", "e.g. FuelSave Diesel")}
              {renderFuelToggle("Premium Diesel", "has_premium_diesel", "premium_diesel_name", "e.g. V-Power Diesel")}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={$modalBtn} onPress={() => setReportModalVisible(false)}>
                <Text text="Cancel" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[$modalBtn, { backgroundColor: colors.palette.primary500 }]} 
                onPress={() => handleFinalSubmit(reportData, tempMarker)}
              >
                <Text text="Submit" style={{ color: 'white' }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 3D View Toggle Button */}
      {region.latitudeDelta < 0.05 && (
        <TouchableOpacity 
          style={[$utilityBtn, { bottom: 190 }]} 
          onPress={toggle3DView}
        >
        <Text style={$pillText}>3D</Text>
        </TouchableOpacity>
      )}

      {/* Floating Action Button to toggle Add Mode */}
      {region.latitudeDelta < 0.05 && (
        <TouchableOpacity 
          style={[$fab, { backgroundColor: isAddMode ? colors.palette.angry500 : colors.palette.primary500 }]} 
          onPress={toggleAddMode}
        >
          <Icon icon={isAddMode ? "close" : "search"} color="white" size={30} />
        </TouchableOpacity>
      )}

      {/* The Placement Bar that appears when in Add Mode */}
      {isAddMode && (
        <Animated.View entering={FadeInUp} style={$placementBar}>
          <Text text="Center the station on the crosshair" style={{ color: 'white', marginBottom: 8 }} />
          <TouchableOpacity 
            style={$confirmBtn} 
            onPress={() => setReportModalVisible(true)}
          >
            <Text text="Set Location" style={{ color: 'white', fontWeight: 'bold' }} />
          </TouchableOpacity>
        </Animated.View>
      )}

      <View style={$searchContainer}>
        <View style={$searchBar}>
          <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => setIsFilterVisible(!isFilterVisible)}>
            <Icon icon="search" color={colors.palette.primary500} size={24} />
            <Text style={$searchPlaceholder} numberOfLines={1}>
              {activeBrands.length === 0 ? "All Brands" : `${activeBrands.length} Selected`} • {activeDistance}km radius
            </Text>
            {hasFilterApplied && (
              <PressableIcon icon="close" size={24} onPress={handleClearAll}/>
            )}
          </Pressable>
        </View>

        {isFilterVisible && (
          <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={$filterDropdown}>
            <Text weight="bold" size="xs">Fuel Type</Text>
            <View style={$segmentedControl}>
              {(["gas", "diesel"] as const).map(type => (
                <TouchableOpacity key={type} style={[$segment, tempFuelType === type && $segmentActive]} onPress={() => setTempFuelType(type)}>
                  <Text style={[$segmentText, tempFuelType === type && $segmentTextActive]}>{type === 'gas' ? 'Gasoline' : 'Diesel'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={{ marginTop: 15 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text weight="bold" size="xs">Distance Radius</Text>
                <Text weight="bold" size="xs" style={{ color: colors.palette.primary500 }}>
                  {tempDistance} km
                </Text>
              </View>
              
              <Slider
                style={{ width: '100%', height: 40 }}
                minimumValue={1}
                maximumValue={120}
                step={1}
                value={tempDistance || 120}
                onValueChange={(val: number) => setTempDistance(val)}
                minimumTrackTintColor={colors.palette.primary500}
                maximumTrackTintColor="#D1D1D6"
                thumbTintColor={colors.palette.primary500}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 }}>
                <Text size="xxs" style={{ color: '#8E8E93' }}>1km</Text>
                <Text size="xxs" style={{ color: '#8E8E93' }}>120km</Text>
              </View>
            </View>

            <Text weight="bold" size="xs" style={{ marginTop: 15 }}>Brands</Text>
            <TouchableOpacity style={$brandPickerTrigger} onPress={() => { setTempBrands([...activeBrands]); setIsBrandPickerVisible(true); }}>
               <Text size="sm" numberOfLines={1}>{tempBrands.length === 0 ? "All Brands" : tempBrands.join(", ")}</Text>
               <Icon icon="caretRight" size={14} />
            </TouchableOpacity>

            <Text weight="bold" size="xs" style={{ marginTop: 15 }}>Max Price (₱)</Text>
            <TextInput style={$filterInput} keyboardType="numeric" placeholder="e.g. 65.00" value={tempMaxPrice} onChangeText={setTempMaxPrice} />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
              <TouchableOpacity style={[$modalBtn, { backgroundColor: '#F2F2F7' }]} onPress={handleCancelFilters}><Text style={{ color: 'black' }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[$modalBtn, { backgroundColor: colors.palette.primary500 }]} onPress={handleApplyAll}><Text style={{ color: "white", fontWeight: "bold" }}>Apply Filters</Text></TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </View>

      {/* Attribution Layer */}
      <View style={$attributionContainer}>
        <View style={{ flex: 1 }} /> 
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => Linking.openURL("https://www.openstreetmap.org/copyright")}
          style={$attributionBackground}
        >
          <Text style={$attributionText}>
            © <Text style={$linkText}>OpenStreetMap</Text> contributors
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={isBrandPickerVisible} transparent animationType="fade" onRequestClose={() => setIsBrandPickerVisible(false)}>
        <View style={$brandModalOverlay}>
          <View style={$brandModalContent}>
            <View style={$brandModalHeader}>
              <Text weight="bold">Filter Brands</Text>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => setTempBrands(tempBrands.length === availableBrands.length ? [] : [...availableBrands])}>
                 <Text size="xs" style={{ marginRight: 8 }}>Select All</Text>
                 <View style={[$checkbox, tempBrands.length === availableBrands.length && $checkboxActive]}>{tempBrands.length === availableBrands.length && <Icon icon="check" size={10} color="white" />}</View>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 350 }}>
              {availableBrands.map(brand => (
                <TouchableOpacity key={brand} style={$brandOption} onPress={() => setTempBrands(prev => prev.includes(brand) ? prev.filter(b => b !== brand) : [...prev, brand])}>
                  <Text style={{ color: tempBrands.includes(brand) ? colors.palette.primary500 : "black" }}>{brand}</Text>
                  <View style={[$checkbox, tempBrands.includes(brand) && $checkboxActive]}>{tempBrands.includes(brand) && <Icon icon="check" size={10} color="white" />}</View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={[$modalBtn, { backgroundColor: '#F2F2F7' }]} onPress={() => setIsBrandPickerVisible(false)}><Text style={{ color: 'black' }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[$modalBtn, { backgroundColor: colors.palette.primary500 }]} onPress={() => setIsBrandPickerVisible(false)}><Text style={{ color: 'white', fontWeight: 'bold' }}>Apply</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isUserInfoVisible} transparent animationType="fade" onRequestClose={() => setIsUserInfoVisible(false)}>
        <TouchableOpacity style={$brandModalOverlay} activeOpacity={1} onPress={() => setIsUserInfoVisible(false)}>
          <View style={$userInfoCard}>
            <View style={$profileHeader}>
              <View style={$avatarCircle}>
                <Text 
                  style={$avatarText} 
                  text={(selectedStation?.users?.firstname?.substring(0,1)?.toUpperCase() || "") + (selectedStation?.users?.lastname?.substring(0,1)?.toUpperCase() || "")} 
                  size="xl" 
                  weight="bold" 
                />
              </View>
              <View style={$nameContainer}>
                <View style={$tierRow}>
                  <Text preset="subheading" weight="bold" style={{ color: "black" }}>
                    {selectedStation?.users?.firstname} {selectedStation?.users?.lastname}
                  </Text>
                  <Image source={require("@assets/icons/download/medal-gold.png")} style={{ width: 30, height: 30, marginLeft: 8 }} resizeMode="contain" />
                </View>
                <Text style={{ color: "#666", fontSize: 14 }}>Rank: Gold Contributor</Text>
              </View>
            </View>

            <View style={$statsRow}>
              <View style={$statBox}>
                <Text weight="bold" style={$statValue}>{selectedStation?.users?.no_contributions || 0}</Text>
                <Text size="xxs" style={$statLabel}>CONTRIBUTIONS</Text>
              </View>
              <View style={$statBox}>
                <Text weight="bold" style={$statValue}>{selectedStation?.users?.no_likes || 0}</Text>
                <Text size="xxs" style={$statLabel}>LIKES</Text>
              </View>
            </View>

            {/* Logic: Only show voting if NOT the current user */}
            {selectedStation?.users?.id && selectedStation?.users?.id !== currentUserId && (
              <View style={[$feedbackRowExpanded, { marginTop: 10 }]}>
                <TouchableOpacity style={$feedbackBtn} onPress={() => handleVote('dislike')} disabled={isVoting}>
                  <Icon icon="check" size={22} color="#FF3B30" />
                  <Text size="xs" weight="bold" style={{ color: '#FF3B30', marginTop: 4 }}>{selectedStation?.users?.no_incorrect_reports || 0} Incorrect reports</Text>
                </TouchableOpacity>
                <View style={$verticalDividerFeedback} />
                <TouchableOpacity style={$feedbackBtn} onPress={() => handleVote('like')} disabled={isVoting}>
                  <Icon icon="heart" size={22} color="#4CD964" />
                  <Text size="xs" weight="bold" style={{ color: '#4CD964', marginTop: 4 }}>{selectedStation?.users?.no_likes || 0} Likes</Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={[$closeBtn, { marginTop: 15 }]} onPress={() => setIsUserInfoVisible(false)}>
              <Text style={{ color: "white", fontWeight: "600" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!selectedStation} animationType="slide" transparent onRequestClose={() => !isReporting && setSelectedStation(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={$modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => !isReporting && setSelectedStation(null)} />
            
            {/* GUARD: Only render inner logic if selectedStation exists. 
                This prevents the "Cannot read property of null" crash on screen load.
            */}
            {selectedStation && (
              <Animated.View entering={FadeIn} style={$detailCard}>
                <TouchableOpacity onPress={() => setSelectedStation(null)} style={$dismissHandle}>
                  <Icon icon="caretDown" size={24} color="white" />
                </TouchableOpacity>
                
                <View style={$innerContent}>
                  {/* 1. HEADER - RESTORED LEGACY LOGIC */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text weight="bold" size="md">{selectedStation.brand}</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
                        <Text size="xxs" style={{ opacity: 0.6 }}>
                          {selectedStation.city} • {selectedStation.updated_at ? formatDistanceToNow(new Date(selectedStation.updated_at), { addSuffix: true }) : "Recent"}
                        </Text>
                        
                        {/* LEGACY CONTRIBUTOR LOGIC - EXACTLY AS PER RAW FILE */}
                        {selectedStation.users ? (
                          <TouchableOpacity onPress={() => setIsUserInfoVisible(true)}>
                            <Text size="xxs" style={{ color: getRankColor(selectedStation.users.no_contributions), fontWeight: 'bold' }}>
                              {" "}by {selectedStation.b_show_firstname ? selectedStation.users.firstname : `${selectedStation.users.firstname} ${selectedStation.users.lastname || ""}`}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <Text size="xxs" style={{ color: "#8E8E93", fontWeight: 'bold' }}>
                            {" "}by {selectedStation.isPending ? "User Report" : "System"}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* LEGACY FAVORITE BUTTON */}
                    {!selectedStation.isPending && (
                      <TouchableOpacity onPress={toggleFavorite} style={$favoriteBtn}>
                        <Icon icon="heart" color={favorites.includes(selectedStation.id) ? colors.palette.primary500 : "#D1D1D6"} size={32} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* 2. BODY BRANCHING */}
                  {selectedStation.isPending ? (
                    /* --- PENDING MARKER UI (FROM TXT FILE) --- */
                    <View style={{ marginTop: 15 }}>
                      <View style={{ backgroundColor: '#FFF9E6', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FFE58F' }}>
                        <Text text="User Reported Location" size="xs" weight="bold" style={{ color: '#856404' }} />
                        <Text text="Is this station real? Help verify it for the community." size="xxs" style={{ color: '#856404' }} />
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                          {['regular_gas_name', 'premium_gas_name', 'sports_gas_name', 'regular_diesel_name', 'premium_diesel_name'].map((key) => (
                            selectedStation[key] ? (
                              <View key={key} style={$fuelTag}>
                                <Text text={selectedStation[key]} size="xxs" weight="bold" style={{ color: colors.palette.primary500 }} />
                              </View>
                            ) : null
                          ))}
                        </View>
                      </View>
                      
                      {/* SAFE REPORTER CHECK */}
                      {currentUserId === selectedStation.reporter_id ? (
                        <View style={{ marginTop: 20, alignItems: 'center', padding: 10, backgroundColor: '#F2F2F7', borderRadius: 12 }}>
                          <Text text="Waiting for others to verify your report..." size="xxs" style={{ opacity: 0.5 }} />
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                          <TouchableOpacity style={[$modalBtn, { flex: 1, backgroundColor: colors.palette.primary500 }]} onPress={() => handleVerifyOrDeny(selectedStation.id, true)}>
                            <Text text="Confirm" style={{ color: 'white', fontWeight: 'bold' }} />
                          </TouchableOpacity>
                          <TouchableOpacity style={[$modalBtn, { flex: 1, backgroundColor: colors.palette.angry500 }]} onPress={() => handleVerifyOrDeny(selectedStation.id, false)}>
                            <Text text="Incorrect" style={{ color: 'white', fontWeight: 'bold' }} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ) : (
                    /* --- LEGACY PRICE DASHBOARD (FROM RAW FILE) --- */
                    <View style={$priceDashboard}>
                      <ScrollView nestedScrollEnabled contentContainerStyle={$scrollContentInternal}>
                        <View style={$priceGridContainer}>
                          {(() => {
                            const config = FUEL_BRAND_MAP[selectedStation.brand] || FUEL_BRAND_MAP["Default"]
                            return Object.keys(config).map((key, index) => (
                              <View key={key} style={$dataEntry}>
                                <Text style={$dataLabel}>{config[key]}</Text>
                                {isReporting ? (
                                  <TextInput style={$priceInput} keyboardType="decimal-pad" value={reportPrices[key] || ""} onChangeText={(val) => setReportPrices(prev => ({ ...prev, [key]: val }))} placeholder="0.00" />
                                ) : ( 
                                  <Text style={$dataValue}>₱{(Number(selectedStation[key]) || 0).toFixed(2)}</Text> 
                                )}
                                {(index + 1) % 3 !== 0 && <View style={$verticalDivider} />}
                              </View>
                            ))
                          })()}
                        </View>
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* 3. FOOTER - LEGACY DIRECTIONS & UPDATE BUTTONS */}
                {!selectedStation.isPending && (
                  <View style={$buttonAbsoluteWrapper}>
                    <View style={$buttonRow}>
                      {isReporting ? (
                        <>
                          <TouchableOpacity style={[$directionsButton, { backgroundColor: '#605e5e' }]} onPress={() => setIsReporting(false)}><Text style={$buttonText}>Cancel</Text></TouchableOpacity>
                          <TouchableOpacity style={[$directionsButton, { backgroundColor: colors.palette.primary500 }]} onPress={handleUpdatePrice}><Text style={$buttonText}>Submit</Text></TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <TouchableOpacity style={$directionsButton} onPress={() => Linking.openURL(`google.navigation:q=${selectedStation.latitude},${selectedStation.longitude}`)}><Icon icon="directions" color="white" size={24} /><Text style={$buttonText}>Directions</Text></TouchableOpacity>
                          <TouchableOpacity style={[$directionsButton, { backgroundColor: colors.palette.primary500 }]} onPress={() => setIsReporting(true)}><Icon icon="priceUpdate" color="white" size={24} /><Text style={$buttonText}>Update Price</Text></TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                )}
              </Animated.View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  )
}
const $fuelTag: ViewStyle = {
  backgroundColor: "white",
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 6,
  borderWidth: 1,
  borderColor: colors.palette.primary500,
}

const $modalBtns: ViewStyle = {
  padding: 12,
  borderRadius: 8,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#EEE',
}
const $utilityBtn: ViewStyle = {
  position: 'absolute',
  right: 20,
  width: 50,
  height: 50,
  borderRadius: 25,
  backgroundColor: "#1737ba", // Matching your header color
  justifyContent: 'center',
  alignItems: 'center',
  elevation: 5,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  zIndex: 99,
}
const $toggleRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  paddingVertical: 10,
  borderBottomWidth: HAIRLINE,
  borderBottomColor: "#EEE",
}

const $toggleBtn: ViewStyle = {
  backgroundColor: "#8E8E93",
  paddingHorizontal: 15,
  paddingVertical: 5,
  borderRadius: 15,
}

const $toggleBtnActive: ViewStyle = {
  backgroundColor: colors.palette.primary500,
}
const $crosshairContainer: ViewStyle = {
  position: 'absolute',
  top: 0, // Ensure it starts at the top of the Map View
  left: 0,
  justifyContent: "center", // This centers the icon vertically
  alignItems: "center",     // This centers the icon horizontally
  opacity: 0.8,
  zIndex: 10,
}
const $crosshairDot: ViewStyle = {
  width: 4,
  height: 4,
  borderRadius: 2,
  backgroundColor: colors.palette.primary500,
  position: "absolute",
}
const $fab: ViewStyle = {
  position: 'absolute',
  bottom: 120, // Positioned above the attribution/google logo
  right: 20,
  width: 60,
  height: 60,
  borderRadius: 30,
  justifyContent: 'center',
  alignItems: 'center',
  elevation: 5,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  zIndex: 99,
}

const $placementBar: ViewStyle = {
  position: 'absolute',
  top: 160, // Positioned below your search bar
  left: 20,
  right: 20,
  backgroundColor: 'rgba(0,0,0,0.85)',
  padding: 16,
  borderRadius: 15,
  alignItems: 'center',
  zIndex: 100,
}

const $confirmBtn: ViewStyle = {
  backgroundColor: colors.palette.primary500,
  paddingHorizontal: 24,
  paddingVertical: 12,
  borderRadius: 25,
}
const $miniInput: TextStyle = {
  backgroundColor: "#F2F2F7",
  borderRadius: 8,
  padding: 10,
  marginTop: 5,
  fontSize: 14,
  color: "black",
  borderWidth: HAIRLINE,
  borderColor: "#D1D1D6",
}

const $pendingNotice: ViewStyle = {
  backgroundColor: "#FFF9E6",
  padding: 10,
  borderRadius: 8,
  marginTop: 10,
  borderWidth: 1,
  borderColor: "#FFE58F",
}
const $attributionContainer: ViewStyle = {
  position: "absolute",
  bottom: 8, // Levels it horizontally with the Google logo
  left: 10,
  right: 10,
  flexDirection: "row",
  alignItems: "center",
  pointerEvents: "box-none",
}

const $attributionBackground: ViewStyle = {
  backgroundColor: "rgba(255, 255, 255, 0.7)",
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 2,
}

const $attributionText: TextStyle = {
  fontSize: 10, // Increased by 2px
  color: "#444",
}

const $linkText: TextStyle = {
  fontSize: 11, // Increased by 2px
  color: "#007AFF", // Standard iOS-style link blue
}
const $markerLevelButtonWrapper: ViewStyle = {
  position: "absolute",
  bottom: 40, // Sit above the station card
  alignSelf: "center", // Center it to make it look like a "Search this area" button
  zIndex: 99,
}

const $markerLevelPill: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#1737ba",
  paddingVertical: 10,
  paddingHorizontal: 16,
  borderRadius: 25,
  elevation: 6,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
}

const $pillText: TextStyle = {
  color: "white",
  fontSize: 12,
  fontWeight: "bold",
  marginLeft: 8,
}
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
const $headerStyle: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: "#1737ba",
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
const $searchContainer: ViewStyle = { position: "absolute", top: 100, left: 10, right: 10, zIndex: 10 }
const $searchBar: ViewStyle = { backgroundColor: "white", height: 50, borderRadius: 25, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, elevation: 5 }
const $searchPlaceholder: TextStyle = { flex: 1, marginLeft: 10, color: "#8E8E93", fontSize: 13 }
const $filterDropdown: ViewStyle = { backgroundColor: "white", marginTop: 10, borderRadius: 20, padding: 20, elevation: 5 }
const $segmentedControl: ViewStyle = { flexDirection: "row", backgroundColor: "#F2F2F7", borderRadius: 10, padding: 2, marginTop: 8 }
const $segment: ViewStyle = { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 }
const $segmentActive: ViewStyle = { backgroundColor: "white", elevation: 2 }
const $segmentText: TextStyle = { fontSize: 12, color: "#8E8E93" }
const $segmentTextActive: TextStyle = { color: colors.palette.primary500, fontWeight: "bold" }
const $brandPickerTrigger: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 10, padding: 12, marginTop: 8 }
const $filterInput: TextStyle = { backgroundColor: "#F2F2F7", borderRadius: 10, padding: 12, marginTop: 8, fontSize: 16 }
const $brandModalOverlay: ViewStyle = { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }
const $brandModalContent: ViewStyle = { backgroundColor: 'white', width: '85%', borderRadius: 20, padding: 20 }
const $brandModalHeader: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }
const $brandOption: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: HAIRLINE, borderBottomColor: '#EEE' }
const $checkbox: ViewStyle = { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#D1D1D6', justifyContent: 'center', alignItems: 'center' }
const $checkboxActive: ViewStyle = { backgroundColor: colors.palette.primary500, borderColor: colors.palette.primary500 }
const $modalBtn: ViewStyle = { flex: 1, paddingVertical: 12, borderRadius: 25, alignItems: 'center' }

const $userInfoCard: ViewStyle = { backgroundColor: 'white', width: '90%', borderRadius: 24, padding: 24, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }
const $feedbackRowExpanded: ViewStyle = { flexDirection: 'row', width: '100%', borderTopWidth: HAIRLINE, borderTopColor: '#EEE', paddingTop: 10, alignItems: 'center' }
const $feedbackBtn: ViewStyle = { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }
const $verticalDividerFeedback: ViewStyle = { width: 1, height: 40, backgroundColor: '#EEE' }

const $modalOverlay: ViewStyle = { flex: 1, justifyContent: "flex-end" }
const $detailCard: ViewStyle = { backgroundColor: "white", borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 5, height: 350 }
const $dismissHandle: ViewStyle = { alignItems: 'center', paddingVertical: 5, backgroundColor: '#605e5e' }
const $innerContent: ViewStyle = { paddingHorizontal: 20, paddingTop: 12 }
const $favoriteBtn: ViewStyle = { padding: 8 }
const $priceDashboard: ViewStyle = { backgroundColor: "#F2F2F7", borderRadius: 16, marginTop: 10, height: 160, borderWidth: 1, borderColor: "#E5E5EA" }
const $scrollContentInternal: ViewStyle = { paddingVertical: 14, paddingHorizontal: 8 }
const $priceGridContainer: ViewStyle = { flexDirection: "row", flexWrap: "wrap", rowGap: 16 }
const $dataEntry: ViewStyle = { width: "33.33%", alignItems: "center" }
const $verticalDivider: ViewStyle = { position: 'absolute', right: 0, height: '60%', width: 1, backgroundColor: "#D1D1D6" }
const $dataLabel: TextStyle = { color: "#8E8E93", fontSize: 10, fontWeight: "600" }
const $dataValue: TextStyle = { color: "#1C1C1E", fontSize: 18, fontWeight: "700" }
const $priceInput: TextStyle = { color: colors.palette.primary500, fontSize: 18, fontWeight: "700", borderBottomWidth: 1, borderBottomColor: colors.palette.primary500, textAlign: 'center', minWidth: 50 }
const $buttonAbsoluteWrapper: ViewStyle = { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: "white" }
const $buttonRow: ViewStyle = { flexDirection: "row", justifyContent: "space-between" }
const $directionsButton: ViewStyle = { flexDirection: "row", backgroundColor: "#605e5e", paddingVertical: 10, borderRadius: 20, width: '48%', justifyContent: "center", alignItems: 'center' }
const $buttonText: TextStyle = { color: "white", marginLeft: 8, fontWeight: "600", fontSize: 14 }