import React, { FC, useMemo, useState, useRef, useEffect, useCallback } from "react"
import { ActivityIndicator, Platform, Pressable, View, ViewStyle, TextStyle, Image, ImageStyle, ScrollView, TouchableOpacity, PixelRatio, Linking, Modal, Alert, KeyboardAvoidingView, TextInput, StyleSheet, } from "react-native"
import * as Clipboard from "expo-clipboard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import { Icon, PressableIcon } from "@/components/Icon"
import { Header } from "@/components/Header"
import MapView, { PROVIDER_GOOGLE, Marker, Region } from "react-native-maps"
import { supabase } from "@/services/supabase"
import { debounce } from "lodash"
import type { ThemedStyle } from "@/theme/types"
import Animated, { FadeIn, FadeInUp, FadeOutUp } from "react-native-reanimated"
import { formatDistanceToNow } from "date-fns"
import { colors } from "@/theme/colorsDark"
import { initFuelMappings, FUEL_BRAND_MAP } from "../utils/fuelMappings"
import Slider from '@react-native-community/slider'
import * as Location from "expo-location"
import { useFocusEffect } from "@react-navigation/native"

// CONSTANTS
const ZOOM_THRESHOLD  = 0.05 
const DEBOUNCE_TIME   = 800
const MAX_STATIONS    = 150
const FUEL_MARKER     = require("@assets/icons/marker_isolated.png")
const HAIRLINE        = 1 / PixelRatio.get()
const Z_INDEX_SEARCH_BAR  = 10
const Z_INDEX_STATION_DETAIL = 9
const Z_INDEX_CONTRIBUTOR_DETAIL = 8
const Z_INDEX_HELPER_BUTTONS = 7

const MAP_STYLE = [
  { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "all", stylers: [{ visibility: "off" }] }
]

interface Contributor {
  id: string;
  full_name: string;
  phone: string;
  b_show_name: boolean;
  b_show_gcash: boolean;
  b_show_maya: boolean;
  no_contributions: number;
  no_incorrect_reports: number;
}

interface Station {
  id: string; 
  brand: string;
  city: string; 
  latitude: number; 
  longitude: number;
  regular_gas?: number; 
  premium_gas?: number; 
  sports_gas?: number;
  regular_diesel?: number; 
  premium_diesel?: number; 
  updated_at: string; 
  is_verified: boolean;
  isPending?: boolean;  
  last_updated_by?: Contributor;
  isLoading?: boolean;
  [key: string]: any;
}

interface AppUser {
  id: string
  favorite_stations: string[]
}

interface ReportData {
  brand: string;
  city: string;
  has_regular_gas: boolean;
  has_premium_gas: boolean;
  has_sports_gas: boolean;
  has_regular_diesel: boolean;
  has_premium_diesel: boolean;
  regular_gas_name: string;
  premium_gas_name: string;
  sports_gas_name: string;
  regular_diesel_name: string;
  premium_diesel_name: string;
}

const FUEL_SUBTYPE_LABELS: Record<string, string> = {
  regular_gas: "Regular",
  premium_gas: "Premium",
  sports_gas: "Sports",
  regular_diesel: "Regular",
  premium_diesel: "Premium"
}


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


export const MapScreen: FC<DemoTabScreenProps<"Map">> = ({ navigation }) => {
  // --GENERAL
  const { themed } = useAppTheme()
  const mapRef = useRef<MapView>(null)
  useEffect(() => {
    const setup = async () => {
      await initFuelMappings()
    }
    setup()
  }, [])

  const [loggedInUser, setLoggedInUser] = useState<AppUser | null>(null)
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null)
  useEffect(() => {
    const load = async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) return

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("id, favorite_stations")
        .eq("id", authData.user.id)
        .single()

      if (profile && !profileError) {
        const favs = profile.favorite_stations ?? []
        setLoggedInUser({
          id: profile.id,
          favorite_stations: favs,
        })
        setFavorites(favs) 
      }
    }
    const initialize = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync()
      if (status === 'granted') {
        let location = await Location.getCurrentPositionAsync({})
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        })
      }
    }
    load()
    initialize()
  }, [])
  

  // --MAP
  const [stations, setStations] = useState<any[]>([])
  const debouncedFetch = useMemo(() => debounce((r: Region) => fetchStations(r), DEBOUNCE_TIME), [])
  const fetchStations = async (currentRegion: Region) => {
    if (currentRegion.latitudeDelta > ZOOM_THRESHOLD) return
    try {
      const minLat = currentRegion.latitude - currentRegion.latitudeDelta / 2
      const maxLat = currentRegion.latitude + currentRegion.latitudeDelta / 2
      const minLng = currentRegion.longitude - currentRegion.longitudeDelta / 2
      const maxLng = currentRegion.longitude + currentRegion.longitudeDelta / 2

      const { data } = await supabase
        .from("fuel_stations")
        .select(`id, brand, latitude, longitude, regular_gas, premium_gas, sports_gas, regular_diesel, premium_diesel`)
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

  const [region, setRegion] = useState<Region>({ latitude: 12.8797, longitude: 121.7740, latitudeDelta: 15, longitudeDelta: 15 })
  const onRegionChangeComplete = (newRegion: Region) => {
    setRegion(newRegion)
    debouncedFetch(newRegion)
    if (isAddMode) {
      setTempMarker(newRegion) 
    }
  }

  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const handleMarkerPress = async (stationId: string) => {
    const localStation = stations.find(s => s.id === stationId)
    
    if (localStation) {
      setSelectedStation({ ...localStation, isLoading: true })
    }

    try {
      const { data, error } = await supabase
        .from("fuel_stations")
        .select(`*, last_updated_by_profile:users!last_updated_by (id, full_name, b_show_name)`)
        .eq("id", stationId)
        .single()

      if (error) throw error

      setSelectedStation({
        ...data,
        last_updated_by: data.last_updated_by_profile,
        isLoading: false 
      })
    } catch (e) {
      console.error("Fetch Error:", e)
      setSelectedStation(prev => prev ? { ...prev, isLoading: false } : null)
    }
  }

  const [currentContributor, setCurrentContributor] = useState<Contributor | null>(null)
  const [isContributorPressed, setIsContributorPressed] = useState(false)
  const handlePressedContributor = async (loggedInUserID: string) => {
    try {
      setIsContributorPressed(true)
      setCurrentContributor(null) 

      const { data, error } = await supabase
        .from("users")
        .select(`id, phone, full_name, no_contributions, no_incorrect_reports, b_show_name, b_show_gcash, b_show_maya`)
        .eq("id", loggedInUserID)
        .single()

      if (error) throw error
      setCurrentContributor(data as unknown as Contributor)
    } catch (e) {
      console.error("Lazy load failed:", e)
      setIsContributorPressed(false)
      Alert.alert("Error", "Could not load contributor profile.")
    }
  }

  const [isReporting, setIsReporting] = useState(false)
  const [reportPrices, setReportPrices] = useState<Record<string, string>>({})
  const handleUpdatePrice = async () => {
    if (!selectedStation || !loggedInUser) {
      Alert.alert("Error", "User or Station information is missing.");
      return;
    }

    const getValidPrice = (key: string) => {
      const input = reportPrices[key];
      
      if (typeof input === "string" && input.trim() !== "") {
        const parsed = parseFloat(input);
        if (!isNaN(parsed)) return parsed;
      }
      
      return Number(selectedStation[key]) || 0;
    };

    const rpcData = {
      _station_id: selectedStation.id,
      _user_id: loggedInUser.id,
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
        setReportPrices({});
        setSelectedStation(null);
      }
    } catch (err) {
      Alert.alert("Error", "A connection error occurred.");
    }
  };

  const [favorites, setFavorites] = useState<string[]>([])
  const toggleFavorite = async () => {
    if (!selectedStation || !loggedInUser?.id) return
    
    const isFav = favorites.includes(selectedStation.id)
    if (!isFav && favorites.length >= 5) {
      return Alert.alert("Limit Reached", "Max 5 favorites allowed.")
    }

    const newFavs = isFav 
      ? favorites.filter(id => id !== selectedStation.id) 
      : [...favorites, selectedStation.id]
    
    const { error } = await supabase
      .from('users')
      .update({ favorite_stations: newFavs })
      .eq('id', loggedInUser.id)

    if (error) {
      Alert.alert("Error", "Could not update favorites.")
    } else {
      setFavorites(newFavs)
      setLoggedInUser(prev => prev ? { ...prev, favorite_stations: newFavs } : null)
    }
  }

  const [mapLayout, setMapLayout] = useState({ width: 0, height: 0 })
  const [isAddMode, setIsAddMode] = useState(false)
  const [pendingStations, setPendingStations] = useState<any[]>([])
  const [tempMarker, setTempMarker] = useState(region)
  const fetchPendingStations = useCallback(async () => {
    const { data } = await supabase.from('user_reported_locations').select('*')
    if (data) setPendingStations(data)
  }, [])
  // Inside MapScreen component
  useFocusEffect(
    useCallback(() => {
      // Refresh regular stations
      fetchStations(region)
      
      // Refresh pending markers (orange ones)
      fetchPendingStations() 

      return () => {
        // Optional cleanup
      }
    }, [region]) // Re-run if region changes while focused
  )

  const [reportModalVisible, setReportModalVisible] = useState(false)
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
  const toggleAddMode = async () => {
    if (isAddMode) {
      setIsAddMode(false)
      return
    }

    if (!loggedInUser?.id) {
      Alert.alert("Authentication", "Please log in to report stations.")
      return
    }

    const { data: userData } = await supabase
      .from('users')
      .select('no_incorrect_reports')
      .eq('id', loggedInUser.id)
      .single()

    if (userData && userData.no_incorrect_reports >= 3) {
      Alert.alert("Access Restricted", "You cannot add markers because you reached 3 incorrect reports.")
      return
    }

    const { count } = await supabase
      .from('user_reported_locations')
      .select('*', { count: 'exact', head: true })
      .eq('reporter_id', loggedInUser.id)

    if (count && count > 0) {
      Alert.alert("Action Required", "You have a pending report. Please wait for it to be confirmed before adding another.")
      return
    }
    setTempMarker(region) 
    setIsAddMode(true)
  }

  const [isSubmitting, setIsSubmitting] = useState(false)
  const handleFinalSubmit = async (data: ReportData, coords: any) => {
    if (!data.brand.trim() || !data.city.trim()) {
      Alert.alert("Missing Information", "Please provide both the Brand and the Municipality/City.")
      return
    }
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
      reporter_id: loggedInUser?.id,
      latitude: coords.latitude,
      longitude: coords.longitude,
      brand: data.brand,
      city: data.city,
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
      await fetchPendingStations()
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

  const [isVoting, setIsVoting] = useState(false)
  const handleVerifyOrDenyPendingMarker = async (reportId: string, isConfirm: boolean) => {
    if (!loggedInUser?.id || isVoting) return
    setIsVoting(true)

    const { data, error } = await supabase.rpc('verify_or_deny_report', {
      report_id: reportId,
      current_user_id: loggedInUser.id,
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
      } else {
        Alert.alert("Confirmed", "Your verification has been recorded.")
      }
    } else {
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
                if (!selectedStation) return;
                const eligible = await toggleAddMode()
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
    fetchPendingStations()
    setIsVoting(false)
  }

// fsd
// Inside MapScreen component
const [activeFuelType, setActiveFuelType] = useState<string | null>(null)
const [activeFuelSubType, setActiveFuelSubType] = useState<string | null>(null)

const [tempFuelType, setTempFuelType] = useState<string | null>(null)
const [tempFuelSubType, setTempFuelSubType] = useState<string | null>(null)
  


  const [isBrandPickerVisible, setIsBrandPickerVisible] = useState(false)
  const [activeBrands, setActiveBrands] = useState<string[]>([])
  const [activeMaxPrice, setActiveMaxPrice] = useState<string>("")
  const [activeDistance, setActiveDistance] = useState<number | null>(120)  
  const [isFilterVisible, setIsFilterVisible] = useState(false)
  const hasFilterApplied = useMemo(() => {
    const isFuelChanged = activeFuelType !== null
    const isFuelSubTypeChange = activeFuelSubType !== null
    const isPriceChanged = activeMaxPrice !== ""
    const isDistanceChanged = activeDistance !== 120 && activeDistance !== null
    const isBrandsChanged = activeBrands.length > 0

    return isFuelChanged || isPriceChanged || isDistanceChanged || isBrandsChanged || isFuelSubTypeChange
  }, [activeFuelType, activeMaxPrice, activeDistance, activeBrands])
  const handleApplyAll = () => { 
    setActiveFuelType(tempFuelType)
    setActiveFuelSubType(tempFuelSubType)
    setActiveMaxPrice(tempMaxPrice)
    setActiveBrands([...tempBrands])
    setActiveDistance(tempDistance)
    setIsFilterVisible(false) 
  }
  const availableBrands = useMemo(() => 
    Array.from(new Set(stations.map(s => s.brand))).filter(Boolean).sort(), 
  [stations])

  const filteredStations = useMemo(() => {
    return stations.filter((s) => {
      // 1. Brand Filter
      if (activeBrands.length > 0 && !activeBrands.includes(s.brand)) return false
      
      // 2. Price Filter (Dynamic based on sub-type)
      const limit = parseFloat(activeMaxPrice)
      if (!isNaN(limit) && limit > 0) {
        // Use the specific sub-type selected, or fall back to a default based on category
        const columnToCheck = activeFuelSubType || (activeFuelType === "gas" ? "regular_gas" : "regular_diesel")
        const price = parseFloat(s[columnToCheck]) || 0
        
        if (price === 0 || price > limit) return false
      }

      // 3. Distance Filter
      if (activeDistance && userLocation) {
        const dist = getDistance(userLocation.latitude, userLocation.longitude, s.latitude, s.longitude)
        if (dist > activeDistance) return false
      }

      return true
    })
  }, [stations, activeFuelType, activeFuelSubType, activeMaxPrice, activeBrands, activeDistance, userLocation])

  const [tempMaxPrice, setTempMaxPrice] = useState<string>("")
  const [tempBrands, setTempBrands] = useState<string[]>([]) 
  const [tempDistance, setTempDistance] = useState<number | null>(120) 
  const handleClearAll = () => { 
  setTempFuelType(null) // Changed from "gas" to null for "None" default
  setTempFuelSubType(null)
  setTempMaxPrice("")
  setTempBrands([])
  setTempDistance(120) 
  
  setActiveFuelType(null)
  setActiveFuelSubType(null)
  setActiveMaxPrice("")
  setActiveBrands([])
  setActiveDistance(120) 
}
  const handleCancelFilters = () => { 
    setTempFuelType(activeFuelType)
    setTempMaxPrice(activeMaxPrice)
    setTempBrands([...activeBrands])
    setTempDistance(activeDistance)
    setIsFilterVisible(false) 
  }

  // --HELPERS
  const isNotAtMarkerLevel = Math.abs(region.latitudeDelta - 0.04) > 0.01;
  const zoomToMarkerVisibleLevel = () => {
    if (!mapRef.current) return
    mapRef.current.animateToRegion({...region,latitudeDelta: 0.03,longitudeDelta: 0.03,}, 600)
  }

  const getDisplayName = (fullName: string | undefined, bShowName: boolean) => {
    if (!fullName) return "Anonymous"
    if (bShowName) return fullName
    return `${fullName.charAt(0)}*****`
  }
  const handleCopyNumber = (number: string) => {
    Clipboard.setStringAsync(number)
    Alert.alert("Copied", "Mobile number copied to clipboard.")
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

  const isAnimating = useRef(false)
  const is3D = useRef(false)
  const toggle3DMapView = async () => {
    // Prevent overlapping animations
    if (!mapRef.current || isAnimating.current) return
    isAnimating.current = true

    // 1. Determine the next state based on the ref
    const nextPitch = is3D.current ? 0 : 55
    const nextZoom = is3D.current ? 15 : 17

    // 2. Animate the Native Map (No re-render triggered)
    mapRef.current.animateCamera({
      center: { 
        latitude: region.latitude, 
        longitude: region.longitude 
      },
      pitch: nextPitch,      
      zoom: nextZoom,       
    }, { duration: 600 })

    // 3. Update the ref and unlock the animation guard after completion
    setTimeout(() => {
      is3D.current = !is3D.current
      isAnimating.current = false
    }, 650)
  }

  

  return (
    <Screen contentContainerStyle={{ flex: 1 }}>
      {/* --HEADER */}
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
      {/* --HEADER */}
      {/* --MAPVIEW */}
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
          style={{ flex: 1 }}
          onRegionChangeComplete={onRegionChangeComplete}
          showsUserLocation={true}
          mapPadding={{top: 110, left: 0, right:0, bottom: 0}}
          toolbarEnabled={false}
          initialRegion={region}
          customMapStyle={MAP_STYLE}
        >
          {region.latitudeDelta < ZOOM_THRESHOLD && ( 
            <>
              {region.latitudeDelta < ZOOM_THRESHOLD && (
                <StationMarkers 
                  stations={filteredStations} // Use the memoized filtered list
                  activeFuelSubType={activeFuelSubType}
                  onMarkerPress={handleMarkerPress}
                />
              )}
              {pendingStations.map((ps) => (
                <Marker 
                  key={`pending-marker-${ps.id}`} // Unique key prevents "ghosting"
                  coordinate={{ latitude: Number(ps.latitude), longitude: Number(ps.longitude) }}
                  pinColor="orange"
                  onPress={() => setSelectedStation({ ...ps, isPending: true })} 
                />
              ))}
            </>
          )}
        </MapView>
      </View>
      {/* --MAPVIEW */}
      {/* --SEARCH BAR */}
      <View style={$searchContainer}>
        <View style={$searchBar}>
          <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => setIsFilterVisible(!isFilterVisible)}>
            <Icon icon="search" color={"##1737ba"} size={24} />
            <Text style={$searchPlaceholder} numberOfLines={1}>
              {activeBrands.length === 0 ? "All Brands" : `${activeBrands.length} Selected`} • {activeDistance}km radius
            </Text>
            {hasFilterApplied && (
              <PressableIcon icon="close" size={24} onPress={handleClearAll}/>
            )}
          </Pressable>
        </View>
            {/* fsd */}
        {isFilterVisible && (
          <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={$filterDropdown}>
            <>
              <Text weight="bold" size="xs">Step 1: Select Fuel Category</Text>
              <View style={$segmentedControl}>
                {([null, "gas", "diesel"] as const).map((type) => (
                  <TouchableOpacity 
                    key={type ?? "none"} 
                    style={[$segment, tempFuelType === type && $segmentActive]} 
                    onPress={() => {
                      setTempFuelType(type)
                      if (!type) {
                        setTempFuelSubType(null)
                        setTempMaxPrice("")
                      } else {
                        setTempFuelSubType(type === 'gas' ? 'regular_gas' : 'regular_diesel')
                      }
                    }}
                  >
                    <Text style={[$segmentText, tempFuelType === type && $segmentTextActive]}>
                      {type === "gas" ? "Gasoline" : type === "diesel" ? "Diesel" : "None"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {tempFuelType && (
                <Animated.View entering={FadeInUp} style={{ marginTop: 15 }}>
                  <Text weight="bold" size="xs">Step 2: Specific Type</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(tempFuelType === "gas" 
                        ? ["regular_gas", "premium_gas", "sports_gas"] 
                        : ["regular_diesel", "premium_diesel"]
                      ).map((sub) => (
                        <TouchableOpacity 
                          key={sub} 
                          style={[$segment, tempFuelSubType === sub && $segmentActive, { paddingHorizontal: 12 }]} 
                          onPress={() => setTempFuelSubType(sub)}
                        >
                          <Text style={[$segmentText, tempFuelSubType === sub && $segmentTextActive, { fontSize: 10 }]}>
                            {sub.split('_')[0].toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>

                  <Text weight="bold" size="xs" style={{ marginTop: 15 }}>Step 3: Max Price (Optional)</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                    <TextInput
                      style={$priceInput}
                      value={tempMaxPrice}
                      onChangeText={setTempMaxPrice}
                      placeholder="No Limit"
                      keyboardType="numeric"
                      placeholderTextColor="#C7C7CC"
                    />
                    <Text size="xxs" style={{ opacity: 0.6 }}>Per Liter</Text>
                  </View>
                </Animated.View>
              )}
            </>
            <>
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
            </>
            <>
              <Text weight="bold" size="xs" style={{ marginTop: 15 }}>Brands</Text>
              <TouchableOpacity style={$brandPickerTrigger} onPress={() => { setTempBrands([...activeBrands]); setIsBrandPickerVisible(true); }}>
                <Text size="sm" numberOfLines={1}>{tempBrands.length === 0 ? "All Brands" : tempBrands.join(", ")}</Text>
                <Icon icon="caretRight" size={14} />
              </TouchableOpacity>
            </>
            <>
              <Text weight="bold" size="xs" style={{ marginTop: 15 }}>Max Price (₱)</Text>
              <TextInput style={$filterInput} keyboardType="numeric" placeholder="e.g. 65.00" value={tempMaxPrice} onChangeText={setTempMaxPrice} />
            </>
            <>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
                <TouchableOpacity style={[$modalBtn, { backgroundColor: '#F2F2F7' }]} onPress={handleCancelFilters}><Text style={{ color: 'black' }}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={[$modalBtn, { backgroundColor: colors.palette.primary500 }]} onPress={handleApplyAll}><Text style={{ color: "white", fontWeight: "bold" }}>Apply Filters</Text></TouchableOpacity>
              </View>
            </>
          </Animated.View>
        )}
      </View>
      {/* --SEARCH BAR */}
      {/* --SEARCH BAR BRAND PICKER MODAL */}
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
      {/* --SEARCH BAR BRAND PICKER MODAL */}
      {/* --STATION CARD DETAIL MODAL*/}
      <Modal style={{ zIndex: Z_INDEX_STATION_DETAIL }} visible={!!selectedStation} animationType="slide" transparent onRequestClose={() => !isReporting && setSelectedStation(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <View style={$modalOverlay}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => !isReporting && setSelectedStation(null)} />
            
            {selectedStation && (
              <Animated.View entering={FadeIn} style={$detailCard}>
                <TouchableOpacity onPress={() => setSelectedStation(null)} style={$dismissHandle}>
                  <Icon icon="caretDown" size={24} color="white" />
                </TouchableOpacity>
                
                <View style={$innerContent}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text weight="bold" size="md">{selectedStation.brand}</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
                        <Text size="xxs" style={{ opacity: 0.6 }}>
                          {selectedStation.city} • {selectedStation.updated_at ? formatDistanceToNow(new Date(selectedStation.updated_at), { addSuffix: true }) : "Recent"}
                        </Text>
                        
                        {selectedStation.last_updated_by ? (
                          <TouchableOpacity onPress={() => {
                              const uid = selectedStation.last_updated_by?.id
                              if (uid) handlePressedContributor(uid)
                            }}
                          >
                            <Text size="xxs" style={{ fontWeight: 'bold' }}>
                              {" "}by {getDisplayName(selectedStation.last_updated_by.full_name, selectedStation.last_updated_by.b_show_name)}
                            </Text>
                          </TouchableOpacity>
                        ) : (
                          <Text size="xxs" style={{ color: "#8E8E93", fontWeight: 'bold' }}>
                            {" "}by {selectedStation.isPending ? "User Report" : "System"}
                          </Text>
                        )}
                      </View>
                    </View>

                    {!selectedStation.isPending && (
                      <TouchableOpacity onPress={toggleFavorite} style={$favoriteBtn}>
                        <Icon icon="heart" color={favorites.includes(selectedStation.id) ? colors.palette.primary500 : "#D1D1D6"} size={32} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {selectedStation.isPending ? (
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
                      
                      {loggedInUser?.id === selectedStation.reporter_id ? (
                        <View style={{ marginTop: 20, alignItems: 'center', padding: 10, backgroundColor: '#F2F2F7', borderRadius: 12 }}>
                          <Text text="Waiting for others to verify your report..." size="xxs" style={{ opacity: 0.5 }} />
                        </View>
                      ) : (
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                          <TouchableOpacity style={[$modalBtn, { flex: 1, backgroundColor: colors.palette.primary500 }]} onPress={() => handleVerifyOrDenyPendingMarker(selectedStation.id, true)}>
                            <Text text="Confirm" style={{ color: 'white', fontWeight: 'bold' }} />
                          </TouchableOpacity>
                          <TouchableOpacity style={[$modalBtn, { flex: 1, backgroundColor: colors.palette.angry500 }]} onPress={() => handleVerifyOrDenyPendingMarker(selectedStation.id, false)}>
                            <Text text="Incorrect" style={{ color: 'white', fontWeight: 'bold' }} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={themed($priceDashboard)}>
                      {selectedStation.isLoading ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                          <ActivityIndicator size="large" color={colors.palette.primary500} />
                          <Text size="xxs" style={{ marginTop: 8, opacity: 0.5 }}>Fetching latest prices...</Text>
                        </View>
                      ) : (
                        <ScrollView nestedScrollEnabled contentContainerStyle={$scrollContentInternal}>
                          <View style={$priceGridContainer}>
                            {(() => {
                              // Use the map to get specific labels for this brand, fallback to Default
                              const config = FUEL_BRAND_MAP[selectedStation.brand] || FUEL_BRAND_MAP["Default"]
                              
                              return Object.keys(config).map((key, index) => {
                                // If the brand config has a null/empty label for this key, hide it
                                if (!config[key]) return null;

                                return (
                                  <View key={key} style={$dataEntry}>
                                    <Text style={$dataLabel}>{config[key]}</Text>
                                    
                                    {/* Toggle between Input for Reporting and Text for viewing */}
                                    {isReporting ? (
                                      <TextInput 
                                        style={$priceInput} 
                                        keyboardType="decimal-pad" 
                                        value={reportPrices[key] || ""} 
                                        onChangeText={(val) => setReportPrices(prev => ({ ...prev, [key]: val }))} 
                                        placeholder="0.00" 
                                      />
                                    ) : ( 
                                      <Text style={$dataValue}>
                                        ₱{(Number(selectedStation[key]) || 0).toFixed(2)}
                                      </Text> 
                                    )}
                                    
                                    {/* Only show vertical divider if it's not the 3rd column */}
                                    {(index + 1) % 3 !== 0 && <View style={$verticalDivider} />}
                                  </View>
                                )
                              })
                            })()}
                          </View>
                        </ScrollView>
                      )}
                    </View>
                  )}
                </View>

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
                          <TouchableOpacity style={$directionsButton} onPress={showDirections}><Icon icon="directions" color="white" size={24} /><Text style={$buttonText}>Directions</Text></TouchableOpacity>
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
      {/* --STATION CARD DETAIL MODAL*/}
      {/* --CONTRIBUTOR MODAL */}
      <Modal 
        visible={isContributorPressed} 
        transparent 
        animationType="fade" 
        onRequestClose={() => setIsContributorPressed(false)}
        style={{ zIndex: Z_INDEX_CONTRIBUTOR_DETAIL }}
      >
        <TouchableOpacity style={$brandModalOverlay} activeOpacity={1} onPress={() => setIsContributorPressed(false)}>
          <View style={$userInfoCard}>
            
            {/* LAZY LOADING WRAPPER: Only render content if data exists */}
            {!currentContributor ? (
              <View style={{ padding: 40, alignItems: 'center', justifyContent: 'center' }}>
                <Text text="Loading profile..." style={{ color: "#8E8E93" }} />
              </View>
            ) : (
              <Animated.View entering={FadeIn}>
                <View style={$profileHeader}>
                  <View style={$avatarCircle}>
                    <Text 
                      style={$avatarText} 
                      text={currentContributor?.full_name?.substring(0,1)?.toUpperCase() || ""} 
                      size="xl" 
                      weight="bold" 
                    />
                  </View>
                  <View style={$nameContainer}>
                    <View style={$tierRow}>
                      <Text 
                        preset="subheading" 
                        weight="bold" 
                        style={{ color: "black", flexShrink: 1 }} 
                        numberOfLines={1}
                      >
                        {getDisplayName(currentContributor?.full_name, currentContributor?.b_show_name ?? true)}
                      </Text>
                      <Image source={require("@assets/icons/download/medal-gold.png")} style={{ width: 30, height: 30, marginLeft: 8 }} resizeMode="contain" />
                    </View>
                    <Text style={{ color: "#666", fontSize: 14 }}>Rank: Gold Contributor</Text>
                  </View>
                </View>

                <View style={$statsRow}>
                  <View style={$statBox}>
                    <Text weight="bold" style={$statValue}>{currentContributor?.no_contributions || 0}</Text>
                    <Text size="xxs" style={$statLabel}>CONTRIBUTIONS</Text>
                  </View>
                  <View style={$statBox}>
                    <Text weight="bold" style={$statValue}>{currentContributor?.no_incorrect_reports || 0}</Text>
                    <Text size="xxs" style={$statLabel}>INCORRECT REPORTS</Text>
                  </View>
                </View>

                <View style={$paymentContainer}>
                  {(currentContributor?.b_show_gcash || currentContributor?.b_show_maya) && currentContributor?.phone && (
                    <TouchableOpacity 
                      style={$paymentCard} 
                      onPress={() => handleCopyNumber(currentContributor?.phone || "")}
                      activeOpacity={0.8}
                    >
                      <View style={$cardTopRow}>
                        <Text size="xxs" weight="bold" style={{ color: "#8E8E93" }}>
                          TIP VIA GCASH / MAYA
                        </Text>
                        <Icon icon="search" size={16} color={"blue"} />
                      </View>

                      <View style={$cardBottomRow}>
                        <View style={$logoGroup}>
                          {currentContributor?.b_show_gcash && (
                            <Image source={require("@assets/icons/search.png")} resizeMode="contain" />
                          )}
                          {currentContributor?.b_show_maya && (
                            <Image source={require("@assets/icons/search.png")} resizeMode="contain" />
                          )}
                        </View>
                        
                        <Text weight="semiBold" style={$phoneNumberText}>
                          {currentContributor?.phone}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                </View>
              </Animated.View>
            )}

            <TouchableOpacity style={[$closeBtn, { marginTop: 15 }]} onPress={() => setIsContributorPressed(false)}>
              <Text style={{ color: "white", fontWeight: "600" }}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
      {/* --CONTRIBUTOR MODAL */}
      {/* --ADD STATION BUTTON */}
      {region.latitudeDelta < ZOOM_THRESHOLD && (
        <TouchableOpacity 
          style={[$utilityBtn, { bottom: 120, backgroundColor: isAddMode ? colors.palette.angry500 : "#1737ba" }]} 
          onPress={toggleAddMode}
        >
          <Icon icon={isAddMode ? "close" : "add_marker"} color="white" size={24} />
        </TouchableOpacity>
      )}
      {/* --ADD STATION BUTTON */}
      {/* --ADD STATION CROSSHAIR */}
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
      {isAddMode && (
        <View 
          style={[
            $crosshairContainer, 
            { 
              width: mapLayout.width,
              height: mapLayout.height,
              marginTop: 55, 
            }
          ]} 
          pointerEvents="none"
        >
          <Icon icon="close" color={"red"} size={40} />
          <View style={$crosshairDot} />
        </View>
      )}
      {/* --ADD STATION CROSSHAIR */}
      {/* --ADD STATION FORM MODAL */}
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
      {/* a STATION FORM MODAL */}
      {/* --RESET VIEW */}
      {isNotAtMarkerLevel && (
        <TouchableOpacity 
          style={[$utilityBtn, {bottom : 50}]} 
          onPress={zoomToMarkerVisibleLevel}
          activeOpacity={0.9}
        >
          <Icon icon="reset_focus" color="white" size={24} />
        </TouchableOpacity>
      )}
      {/* --RESET VIEW */}
      {/* --3D MAP VIEW BUTTON*/}
      {region.latitudeDelta < ZOOM_THRESHOLD && /* TODO: Need to add AND isMapMounted  */ (
        <TouchableOpacity style={[$utilityBtn, { bottom: 190 }]} onPress={toggle3DMapView}>
          <Icon icon="layers" color="white" size={24} />
        </TouchableOpacity>
      )}
      {/* --3D MAP VIEW BUTTON*/}
      {/* --ATTRIBUTION AREA */}
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
      {/* --ATTRIBUTION AREA */}
    </Screen>
  )
}

// REGIONS STYLES
const $customMarkerWrapper: ViewStyle = {
  alignItems: 'center',
  justifyContent: 'center',
  height: 50, // Increase this if your badge is getting cut off
  width: 60,
}

const $markerPinImage: ImageStyle = {
  width: 48,
  height: 48,
  resizeMode: 'contain',
}

const $floatingBadgePill: ViewStyle = {
  backgroundColor: "#000000",
  paddingHorizontal: 4,
  paddingVertical: 2,
  borderRadius: 4,
  position: 'absolute',
  top: -5, // Lift it above the pin
  zIndex: 2,
}
const $floatingBadgeTextSmall: TextStyle = {
  color: "white",
  fontSize: 11,
  fontWeight: "800", // Extra bold for readability at small sizes
  textAlign: "center",
  // Fixes vertical alignment issues on some Android devices
  includeFontPadding: false, 
}
const $floatingBadge: ViewStyle = {
  position: "absolute",
  top: 0,           // Adjusted to sit on the "shoulder" of the pin
  right: -5,        // Shifted right to prevent overlapping the icon center
  backgroundColor: colors.palette.secondary500,
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 12, // Keeps it rounded like a pill
  borderWidth: 1.5,
  borderColor: "white",
  // Elevation for Android / Shadow for iOS to make it pop
  elevation: 4,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
}

const $floatingBadgeText: TextStyle = {
  color: "white",
  fontSize: 10,      // Slightly smaller to fit the 00.00 format comfortably
  fontWeight: "bold",
  textAlign: "center",
}
const $floatingBadgeContainer: ViewStyle = {
  backgroundColor: colors.palette.primary500,
  width: 26,
  height: 26,
  borderRadius: 13,
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 2,
  borderColor: "white",
  elevation: 6,
}

const $filterPriceInput: TextStyle = { 
  color: colors.palette.primary500, 
  fontSize: 18, 
  fontWeight: "700", 
  borderBottomWidth: 1, 
  borderBottomColor: colors.palette.primary500, 
  textAlign: 'center', 
  minWidth: 80 
}
const $floatingPriceBadge: ViewStyle = {
  backgroundColor: colors.palette.primary500,
  width: 24,
  height: 24,
  borderRadius: 12, // Round div
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1.5,
  borderColor: "white",
  // Shadow to make it look floating
  elevation: 5,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.3,
  shadowRadius: 2,
}

const $priceBadgeText: TextStyle = {
  color: "white",
  fontSize: 10,
  fontWeight: "bold",
  textAlign: "center",
}
const $priceBadge: ViewStyle = {
  backgroundColor: colors.palette.primary500,
  width: 22,
  height: 22,
  borderRadius: 11, // Perfect circle
  alignItems: 'center',
  justifyContent: 'center',
  borderWidth: 1.5,
  borderColor: "white",
  position: 'absolute',
  top: -8,   // Adjust these to position precisely over the logo
  right: -8,
  zIndex: 10,
  elevation: 4,
}
const $markerBubble: ViewStyle = {
  alignItems: 'center',
  justifyContent: 'center',
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: "white",
  borderWidth: 2,
  borderColor: colors.palette.primary500,
  elevation: 3,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.2,
  shadowRadius: 2,
}

const $brandInitial: TextStyle = {
  fontSize: 10,
  fontWeight: "bold",
  color: colors.palette.primary500,
}

const $priceBadgeContainer: ViewStyle = {
  position: 'absolute',
  top: -14,
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 20,
}
const $markerImage: ImageStyle = {
  width: 32,
  height: 32,
}
const $paymentContainer: ViewStyle = {
  marginTop: 16,
  paddingTop: 16,
  borderTopWidth: HAIRLINE,
  borderTopColor: "#E5E5EA",
}

const $paymentCard: ViewStyle = {
  backgroundColor: "#F2F2F7",
  borderRadius: 12,
  padding: 12,
  borderWidth: 1,
  borderColor: "#E5E5EA",
}

const $cardTopRow: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8,
}

const $cardBottomRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
}

const $logoGroup: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  marginRight: 12,
}


const $phoneNumberText: TextStyle = {
  fontSize: 17,
  color: "#1C1C1E",
  letterSpacing: 0.5,
}
const $phoneRow: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: "#F8F9FA",
  padding: 12,
  borderRadius: 12,
  marginTop: 15,
  borderWidth: 1,
  borderColor: "#E5E5EA",
}

const $phoneInfo: ViewStyle = { flex: 1 }

const $paymentIcons: ViewStyle = { flexDirection: "row", gap: 8 }

const $paymentLogo: ViewStyle = { width: 24, height: 24 }
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
  right: 10,
  width: 50,
  height: 50,
  borderRadius: 25,
  backgroundColor: "#1737ba", 
  justifyContent: 'center',
  alignItems: 'center',
  elevation: 5,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  zIndex: Z_INDEX_HELPER_BUTTONS,
}
const $fab: ViewStyle = {
  position: 'absolute',
  bottom: 120, 
  right: 20,
  borderRadius: 30,
  justifyContent: 'center',
  alignItems: 'center',
  elevation: 5,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 3.84,
  zIndex: Z_INDEX_HELPER_BUTTONS,
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
  top: 0, 
  left: 0,
  justifyContent: "center", 
  alignItems: "center",     
  opacity: 0.8,
  zIndex: 10,
}
const $crosshairDot: ViewStyle = {
  width: 4,
  height: 4,
  borderRadius: 2,
  backgroundColor: "red",
  position: "absolute",
}


const $placementBar: ViewStyle = {
  position: 'absolute',
  top: 160, 
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
  bottom: 8, 
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
  fontSize: 10, 
  color: "#444",
}

const $linkText: TextStyle = {
  fontSize: 11, 
  color: "#007AFF", 
}
const $markerLevelButtonWrapper: ViewStyle = {
  position: "absolute",
  bottom: 40, 
  alignSelf: "center", 
  zIndex: Z_INDEX_HELPER_BUTTONS,
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
const $searchContainer: ViewStyle = { position: "absolute", top: 100, left: 10, right: 10, zIndex: Z_INDEX_SEARCH_BAR }
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


const StationMarkers = React.memo(({ 
  stations, 
  activeFuelSubType, 
  onMarkerPress 
}: { 
  stations: any[], 
  activeFuelSubType: string | null, 
  onMarkerPress: (id: string) => void 
}) => {
  // This state controls whether the map is "videoing" the marker or "taking a photo"
  const [shouldTrack, setShouldTrack] = useState(true)

  useEffect(() => {
    // 1. Every time the stations or filter changes, start "tracking" (video mode)
    setShouldTrack(true)

    // 2. Wait 600ms for the background color and price to definitely be visible
    const timer = setTimeout(() => {
      setShouldTrack(false) // 3. Freeze the marker (photo mode) for performance
    }, 600)

    return () => clearTimeout(timer)
  }, [stations.length, activeFuelSubType]) // Trigger this when data or filters change

  return (
    <>
      {stations.map((s) => {
        const priceValue = activeFuelSubType ? parseFloat(s[activeFuelSubType]) : 0
        const hasPrice = activeFuelSubType !== null && priceValue > 0
        
        // We still use a unique key to force a clean slate when filters change
        const markerKey = `marker-${s.id}-${activeFuelSubType || "none"}`

        return (
          <Marker
            key={markerKey}
            coordinate={{ latitude: Number(s.latitude), longitude: Number(s.longitude) }}
            onPress={() => onMarkerPress(s.id)}
            // Use the state here!
            tracksViewChanges={shouldTrack}
          >
            <View style={$markerContainer}>
              {hasPrice && (
                <View style={$badgePill}>
                  <Text style={$badgeText}>{priceValue.toFixed(2)}</Text>
                </View>
              )}
              <Image 
                source={FUEL_MARKER} 
                style={{ width: 30, height: 30, resizeMode: 'contain' }} 
              />
            </View>
          </Marker>
        )
      })}
    </>
  )
}, (prev, next) => {
  return (
    prev.stations === next.stations && 
    prev.activeFuelSubType === next.activeFuelSubType
  )
})

// Ensure these styles are updated to be very explicit
const $markerContainer: ViewStyle = {
  alignItems: 'center',
  justifyContent: 'center',
  padding: 5,
}

const $badgePill: ViewStyle = {
  backgroundColor: '#FF5A5F', // Use a hardcoded hex color
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 12,
  borderWidth: 1.5,
  borderColor: '#FFFFFF',
  marginBottom: -2,
  zIndex: 10,
  elevation: 4, // Required for Android shadow/background stability
}

const $badgeText: TextStyle = {
  color: '#FFFFFF',
  fontSize: 10,
  fontWeight: 'bold',
}