import React, { FC, useMemo, useState, useRef, useEffect, useCallback } from "react"
import { ActivityIndicator, Platform, Pressable, View, ViewStyle, TextStyle, Image, ScrollView, TouchableOpacity, PixelRatio, Linking, Modal, Alert, KeyboardAvoidingView, TextInput, StyleSheet, } from "react-native"
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
import { colors } from "@/theme/colors"
import { initFuelMappings, FUEL_BRAND_MAP } from "../utils/fuelMappings"
import Slider from '@react-native-community/slider'
import * as Location from "expo-location"
import { useFocusEffect } from "@react-navigation/native"
import { spacing } from "@/theme/spacing"

import GCashLogo from "@assets/icons/gcash.svg"
import MayaLogo from "@assets/icons/maya.svg"
// CONSTANTS
const ICON_MEDAL_GOLD = require("@assets/icons/download/medal_gold.png")
const ICON_MEDAL_SILVER = require("@assets/icons/download/medal_silver.png")
const ICON_MEDAL_BRONZE = require("@assets/icons/download/medal_bronze.png")
const ICON_FUEL_MARKER     = require("@assets/icons/marker_isolated.png")

const ZOOM_THRESHOLD  = 0.05 
const DEBOUNCE_TIME   = 800
const MAX_STATIONS    = 150
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
  no_incorrect_location_report: number
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


export const MapTestScreen: FC<DemoTabScreenProps<"MapTest">> = ({ navigation }) => {
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
  const [availableBrands, setAvailableBrands] = useState<string[]>([])
  useEffect(() => {
    const load_user_favorites = async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) return

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("id, favorite_stations, no_incorrect_location_report")
        .eq("id", authData.user.id)
        .single()

      if (profile && !profileError) {
        const favs = profile.favorite_stations ?? []
        setLoggedInUser({
          id: profile.id,
          favorite_stations: favs,
          no_incorrect_location_report: profile.no_incorrect_location_report,
        })
        setFavorites(favs) 
      }
    }
    const load_available_brands = async () => {
      const { data, error } = await supabase
        .from("fuel_stations")
        .select("brand")

      if (data && !error) {
        const uniqueBrands = Array.from(
          new Set(data.map((s) => s.brand).filter(Boolean))
        ).sort()
        
        setAvailableBrands(uniqueBrands)
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
    load_user_favorites()
    load_available_brands()
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
    if (isAddMarkerMode) {
      setTempMarker(newRegion) 
    }
  }

  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const handleMarkerPress = async (stationId: string) => {
    const localStation = stations.find(s => s.id === stationId)
    
    // Set initial loading state from local data
    if (localStation) {
      setSelectedStation({ ...localStation, isLoading: true, fetchError: false })
    }

    try {
      const { data, error } = await supabase
        .from("fuel_stations")
        .select(`*, last_updated_by_profile:users!last_updated_by (id, full_name, b_show_name)`)
        .eq("id", stationId)
        .maybeSingle() // Use maybeSingle to handle deleted records gracefully

      // If record is missing (deleted) or there's a DB error
      if (error || !data) {
        setSelectedStation(prev => ({ 
          ...(prev || localStation), 
          isLoading: false, 
          fetchError: true 
        }))
        return
      }

      setSelectedStation({
        ...data,
        last_updated_by: data.last_updated_by_profile,
        isLoading: false,
        fetchError: false
      })
    } catch (e) {
      console.error("Fetch Error:", e)
      setSelectedStation(prev => ({ 
        ...(prev || localStation), 
        isLoading: false, 
        fetchError: true 
      }))
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

  const priceInputsRef = useRef<Record<string, string>>({});
  const [isReporting, setIsReporting] = useState(false)
  const [reportPrices, setReportPrices] = useState<Record<string, string>>({})
  const handleUpdatePrice = async () => {
    if (!selectedStation || !loggedInUser) {
      Alert.alert("Error", "User or Station information is missing.");
      return;
    }

    const getValidPrice = (key: string) => {
      const input = priceInputsRef.current[key];
      if (input && input.trim() !== "") {
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
        priceInputsRef.current = {};
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
  const [isAddMarkerMode, setisAddMarkerMode] = useState(false)
  const [pendingStations, setPendingStations] = useState<any[]>([])
  const [tempMarker, setTempMarker] = useState(region)
  const fetchPendingStations = useCallback(async () => {
    const { data } = await supabase.from('user_reported_locations').select('*')
    if (data) setPendingStations(data)
  }, [])
  useFocusEffect(
    useCallback(() => {
      fetchStations(region)
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
          disabled={isExistingBrand} 
          onPress={() => setReportData({ ...reportData, [boolKey]: !reportData[boolKey] })}
          style={[$toggleBtn, reportData[boolKey] && $toggleBtnActive, isExistingBrand && { opacity: 0.5 }]}
        >
          <Text text={reportData[boolKey] ? "YES" : "NO"} size="xs" style={{ color: "white", fontWeight: "bold" }} />
        </TouchableOpacity>
      </View>
      
      {/* Only show marketing name input if it's a NEW brand */}
      {reportData[boolKey] && !isExistingBrand && (
        <Animated.View entering={FadeInUp} exiting={FadeOutUp}>
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
  const toggleAddMarkerMode = async () => {
    if (isAddMarkerMode) {
      setisAddMarkerMode(false)
      return
    }

    if (!loggedInUser?.id) {
      Alert.alert("Authentication", "Please log in to report stations.")
      return
    }

    if (loggedInUser.no_incorrect_location_report >= 3) {
      Alert.alert("Access Restricted", "You cannot add markers because you reached 3 incorrect location reports.")
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
    setisAddMarkerMode(true)
  }

  const [isSubmitting, setIsSubmitting] = useState(false)
  const handleFinalAddMarker = async (data: ReportData, coords: any) => {
    const brandNameLower = data.brand.trim().toLowerCase()

    // 1. Check if brand exists in availableBrands
    const isExistingBrand = availableBrands.some(
      (b) => b.toLowerCase() === brandNameLower
    )

    // 2. Auto-populate toggles if existing for the "Preview"
    if (isExistingBrand) {
      const exactBrandKey = Object.keys(FUEL_BRAND_MAP).find(
        (key) => key.toLowerCase() === brandNameLower
      )

      if (exactBrandKey) {
        const brandConfig = FUEL_BRAND_MAP[exactBrandKey]
        data.has_regular_gas = !!brandConfig.regular_gas
        data.has_premium_gas = !!brandConfig.premium_gas
        data.has_sports_gas = !!brandConfig.sports_gas
        data.has_regular_diesel = !!brandConfig.regular_diesel
        data.has_premium_diesel = !!brandConfig.premium_diesel
      }
    }

    if (!data.brand.trim() || !data.city.trim()) {
      Alert.alert("Missing Information", "Please provide both the Brand and the Municipality/City.")
      return
    }

    // 3. Validation: Only require marketing names if it's a NEW brand
    if (!isExistingBrand) {
      const hasAtLeastOneFuel = 
        data.has_regular_gas || 
        data.has_premium_gas || 
        data.has_sports_gas || 
        data.has_regular_diesel || 
        data.has_premium_diesel

      if (!hasAtLeastOneFuel) {
        Alert.alert("No Fuels Selected", "Please toggle at least one fuel type for this new brand.")
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
    }

    setIsSubmitting(true)

    // 4. Submit to Supabase
    const { error } = await supabase.from('user_reported_locations').insert([{
      reporter_id: loggedInUser?.id,
      latitude: coords.latitude,
      longitude: coords.longitude,
      brand: data.brand,
      city: data.city,
      // Names are sent as null for existing brands to avoid DB config conflicts
      regular_gas_name: (!isExistingBrand && data.has_regular_gas) ? data.regular_gas_name : null,
      premium_gas_name: (!isExistingBrand && data.has_premium_gas) ? data.premium_gas_name : null,
      sports_gas_name: (!isExistingBrand && data.has_sports_gas) ? data.sports_gas_name : null,
      regular_diesel_name: (!isExistingBrand && data.has_regular_diesel) ? data.regular_diesel_name : null,
      premium_diesel_name: (!isExistingBrand && data.has_premium_diesel) ? data.premium_diesel_name : null,
    }])

    if (error) {
      Alert.alert("Error", error.message)
    } else {
      Alert.alert("Success", "Report submitted for verification.")
      setReportModalVisible(false)
      setisAddMarkerMode(false)
      await fetchPendingStations()
      
      // Reset form
      setReportData({
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
        premium_diesel_name: ""
      })
    }
    setIsSubmitting(false)
  }
  useEffect(() => {
    const brandName = reportData.brand.trim().toLowerCase()
    if (!brandName) return

    // Find the matching brand key in the FUEL_BRAND_MAP object
    const exactBrandKey = Object.keys(FUEL_BRAND_MAP).find(
      (key) => key.toLowerCase() === brandName
    )

    if (exactBrandKey) {
      const config = FUEL_BRAND_MAP[exactBrandKey]
      setReportData((prev) => ({
        ...prev,
        has_regular_gas: !!config.regular_gas,
        has_premium_gas: !!config.premium_gas,
        has_sports_gas: !!config.sports_gas,
        has_regular_diesel: !!config.regular_diesel,
        has_premium_diesel: !!config.premium_diesel,
      }))
    }
  }, [reportData.brand])

  // Inside MapScreen component, find the state declarations (around line 470)
  // 1. Updated states to handle objects instead of just strings
  const [municipalities, setMunicipalities] = useState<any[]>([]) 
  const [muniSearchQuery, setMuniSearchQuery] = useState("")
  const [isMuniPickerVisible, setIsMuniPickerVisible] = useState(false)
  const [isLoadingMuni, setIsLoadingMuni] = useState(false)

  useEffect(() => {
    const fetchPHMunicipalities = async () => {
      setIsLoadingMuni(true)
      try {
        // Fetching from the official PSGC GitLab mirror
        const response = await fetch("https://psgc.gitlab.io/api/cities-municipalities.json")
        const data = await response.json()
        
        // Keep the whole object so we have muni.code for the 'key' prop
        setMunicipalities(data) 
      } catch (error) {
        console.error("Error fetching PSGC data:", error)
      } finally {
        setIsLoadingMuni(false)
      }
    }
    fetchPHMunicipalities()
  }, [])

  // 2. Optimized LAZY Filter:
  // This prevents the app from crashing by not rendering anything 
  // until the user actually starts searching.
  const filteredMuniOptions = useMemo(() => {
    // Return empty if search is too short (saves memory/performance)
    if (muniSearchQuery.trim().length < 2) return []

    return municipalities
      .filter(m => 
        m.name.toLowerCase().includes(muniSearchQuery.toLowerCase())
      )
      .slice(0, 25) // Limit to top 25 results to keep the UI smooth
  }, [municipalities, muniSearchQuery])
  // Inside MapScreen component
  const [brandSearchQuery, setBrandSearchQuery] = useState("")
  const [isAddStationBrandPickerVisible, setIsAddStationBrandPickerVisible] = useState(false)

  // Logic to filter brands and allow custom entry
  const filteredBrandOptions = useMemo(() => {
    const query = brandSearchQuery.trim().toLowerCase() // Using your brandSearchQuery
    
    // Fix 2: Check if exact match exists in availableBrands (which is string[])
    const exactMatchExists = availableBrands.some(
      (b) => b.toLowerCase() === query
    )

    const filtered = availableBrands.filter((opt) =>
      opt.toLowerCase().includes(query)
    )

    // Only show "Add..." if there's no exact match and query isn't empty
    if (query !== "" && !exactMatchExists) {
      // Note: If your dropdown expects strings, keep it as a string
      return [`Add "${brandSearchQuery.trim()}"`, ...filtered]
    }
    return filtered
  }, [availableBrands, brandSearchQuery])
  const isExistingBrand = useMemo(() => {
    if (!reportData.brand) return false
    return availableBrands.some(
      (b) => b.toLowerCase() === reportData.brand.toLowerCase()
    )
  }, [reportData.brand, availableBrands])


  const hasVoted = useMemo(() => {
    if (!selectedStation || !loggedInUser) return false
    const v = selectedStation.verifiers || []
    const d = selectedStation.deniers || []
    return v.includes(loggedInUser.id) || d.includes(loggedInUser.id)
  }, [selectedStation, loggedInUser])
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
      Alert.alert("Error", "Something went wrong")
      console.log("Error", error.message)
      setIsVoting(false)
      return
    }
    Alert.alert("Your verification has been recorded.")

    if (data === 'VERIFICATION_ADDED' || data === 'DENIAL_ADDED') {
    setSelectedStation((prev) => {
      if (!prev) return null
      return {
        ...prev,
        verifiers: isConfirm ? [...(prev.verifiers || []), loggedInUser.id] : prev.verifiers,
        deniers: !isConfirm ? [...(prev.deniers || []), loggedInUser.id] : prev.deniers,
      }
    })
  }

    setSelectedStation(null)
    fetchStations(region)
    fetchPendingStations()
    setIsVoting(false)
  }
  const handleCancelMyReport = async (reportId: string) => {
    if (!reportId) {
      Alert.alert("Error", "Report ID is missing.");
      return;
    }
    Alert.alert(
      "Cancel Report",
      "Are you sure you want to remove this pending station report?",
      [
        { text: "No", style: "cancel" },
        { 
          text: "Yes, Cancel It", 
          style: "destructive",
          onPress: async () => {
            const { error } = await supabase
              .from('user_reported_locations')
              .delete()
              .eq('id', reportId)

            if (error) {
              Alert.alert("Error", "Could not cancel report: " + error.message)
            } else {
              Alert.alert("Success", "Your report has been withdrawn.")
              setSelectedStation(null) // Close the modal
              fetchPendingStations()    // Refresh the orange markers
            }
          } 
        }
      ]
    )
  }



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
  // const availableBrands = useMemo(() => 
  //   Array.from(new Set(stations.map(s => s.brand))).filter(Boolean).sort(), 
  // [stations])

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
    if (!mapRef.current || isAnimating.current) return
    isAnimating.current = true
    const nextPitch = is3D.current ? 0 : 55
    const nextZoom = is3D.current ? 15 : 17

    mapRef.current.animateCamera({
      center: { 
        latitude: region.latitude, 
        longitude: region.longitude 
      },
      pitch: nextPitch,      
      zoom: nextZoom,       
    }, { duration: 600 })

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
          showsUserLocation={!isAddMarkerMode}
          mapPadding={{top: 110, left: 0, right:0, bottom: 0}}
          toolbarEnabled={false}
          initialRegion={region}
          customMapStyle={MAP_STYLE}
        >
          {region.latitudeDelta < ZOOM_THRESHOLD && ( 
            <>
              <StationMarkers 
                stations={filteredStations}
                activeFuelSubType={activeFuelSubType}
                onMarkerPress={handleMarkerPress}
              />
              {pendingStations.map((ps) => (
                <Marker 
                  key={`pending-marker-${ps.id}`}
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
      {!isAddMarkerMode && (
        <View style={$searchContainer}>
          <View style={$searchBar}>
            <Pressable style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} onPress={() => setIsFilterVisible(!isFilterVisible)}>
              <Icon icon="search" color={"##1737ba"} size={24} />
              <Text style={$searchPlaceholder} numberOfLines={1}>
                {activeBrands.length === 0 ? "All Brands" : `${activeBrands.length} Selected`} • {activeDistance}km radius
              </Text>
              {hasFilterApplied && (
                <PressableIcon icon="close" color={colors.palette.neutral100} size={24} onPress={handleClearAll} style={{ backgroundColor: colors.palette.neutral800, borderRadius: 20}}/>
              )}
            </Pressable>
          </View>
              {/* fsd */}
          {isFilterVisible && (
            <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={$filterDropdown}>
              <>
                <Text weight="bold" size="xs">Fuel Type</Text>
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
                      <Text style={[$fuelTypeSegment, tempFuelType === type && $fuelTypeSegmentActive]}>
                        {type === "gas" ? "Gasoline" : type === "diesel" ? "Diesel" : "None"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {tempFuelType && (
                  <Animated.View entering={FadeInUp} style={[{ marginTop: spacing.xxxs, width: "100%" }]}>
                    <View style={[$segmentedControl, ]}>
                      {(tempFuelType === "gas" 
                        ? ["regular_gas", "premium_gas", "sports_gas"] 
                        : ["regular_diesel", "premium_diesel"]
                      ).map((sub) => (
                        <TouchableOpacity 
                          key={sub} 
                          style={[$segment, tempFuelSubType === sub && $segmentActive, { paddingHorizontal: 12 }]} 
                          onPress={() => setTempFuelSubType(sub)}
                        >
                          <Text style={[$fuelTypeSegment, tempFuelSubType === sub && $fuelTypeSegmentActive, { fontSize: 10 }]}>
                            {sub.split('_')[0].toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text weight="bold" size="xs" style={{ marginTop: 15 }}>Max Price (Optional)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
                      <TextInput
                        style={$priceInput}
                        value={tempMaxPrice}
                        onChangeText={setTempMaxPrice}
                        placeholder="e.g. 50.00"
                        keyboardType="numeric"
                        placeholderTextColor="#C7C7CC"
                      />
                      <Text size="xxs" style={{ opacity: 0.6 }}>Per Liter</Text>
                    </View>
                  </Animated.View>
                )}
              </>
              <>
                <Text weight="bold" size="xs" style={{ marginTop: 15 }}>Brand</Text>
                <TouchableOpacity style={$brandPickerTrigger} onPress={() => { setTempBrands([...activeBrands]); setIsBrandPickerVisible(true); }}>
                  <Text size="sm" numberOfLines={1}>{tempBrands.length === 0 ? "All Brands" : tempBrands.join(", ")}</Text>
                  <Icon icon="caret_right" size={20} />
                </TouchableOpacity>
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
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
                  <TouchableOpacity style={[$pendingFormButtons, { backgroundColor: '#F2F2F7' }]} onPress={handleCancelFilters}><Text style={{ color: 'black' }}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={[$pendingFormButtons, { backgroundColor: colors.palette.primary500 }]} onPress={handleApplyAll}><Text style={{ color: "white", fontWeight: "bold" }}>Apply Filters</Text></TouchableOpacity>
                </View>
              </>
            </Animated.View>
          )}
        </View>
      )}
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
              <TouchableOpacity style={[$pendingFormButtons, { backgroundColor: '#F2F2F7' }]} onPress={() => setIsBrandPickerVisible(false)}><Text style={{ color: 'black' }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[$pendingFormButtons, { backgroundColor: colors.palette.primary500 }]} onPress={() => setIsBrandPickerVisible(false)}><Text style={{ color: 'white', fontWeight: 'bold' }}>Apply</Text></TouchableOpacity>
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
                <TouchableOpacity onPress={() => {setSelectedStation(null); setIsReporting(false);}} style={$dismissHandle}>
                  <Icon icon="caret_down" size={24} color="white" />
                </TouchableOpacity>
                
                <View style={$innerContent}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <Text weight="bold" size="md">{selectedStation.brand}</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
                        <Text size="sm" style={{ opacity: 0.6 }}>
                          {selectedStation.city}{selectedStation.updated_at ? " • " + formatDistanceToNow(new Date(selectedStation.updated_at), { addSuffix: true }) : " • Recent"}
                        </Text>
                        
                        {selectedStation.last_updated_by ? (
                          <TouchableOpacity onPress={() => {
                              const uid = selectedStation.last_updated_by?.id
                              if (uid) handlePressedContributor(uid)
                            }}
                          >
                            <Text size="sm" style={{ fontWeight: 'bold' }}>
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
                      <TouchableOpacity onPress={toggleFavorite} style={[$favoriteBtn, selectedStation.fetchError && { opacity: 0.3 }]} disabled={selectedStation.fetchError}>
                        <Icon icon="star" color={favorites.includes(selectedStation.id) ? colors.palette.primary500 : "#D1D1D6"} size={32} />
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
                        <View style={{ marginTop: 10, gap: 10 }}>
                          <View style={{ alignItems: 'center', padding: 10, backgroundColor: '#F2F2F7', borderRadius: 12, justifyContent: "flex-start" }}>
                            <Text text="Waiting for others to verify your report..." size="xs" style={{ opacity: 0.5 }} />
                          </View>
                          <TouchableOpacity
                            style={[$pendingFormButtons, {
                              backgroundColor: colors.palette.angry500,
                              flexDirection: 'row',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: 8,
                              minHeight: 45
                            }]}
                            onPress={() => handleCancelMyReport(selectedStation.id)}
                          >
                            <Text 
                              text="Cancel My Report"
                              style={{ color: '#FFFFFF', fontWeight: 'bold' }}
                            />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={{ gap: 10, marginTop: 10 }}>
                          {hasVoted ? (
                            <View style={{ alignItems: 'center', padding: 10, backgroundColor: '#F2F2F7', borderRadius: 12, justifyContent: "flex-start" }}>
                              <Text text="Your confirmation has been saved" size="xs" style={{ opacity: 0.5 }} />
                            </View>
                          ) : (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                              <TouchableOpacity 
                                style={[$pendingFormButtons, { flex: 1, backgroundColor: colors.palette.secondary500  }]} 
                                onPress={() => handleVerifyOrDenyPendingMarker(selectedStation.id, false)}
                              >
                                <Text style={{ textAlign: 'center', color: "white", fontWeight: "bold" }}>Deny</Text>
                              </TouchableOpacity>

                              <TouchableOpacity 
                                style={[$pendingFormButtons, { flex: 1, backgroundColor: colors.palette.primary500 }]} 
                                onPress={() => handleVerifyOrDenyPendingMarker(selectedStation.id, true)}
                              >
                                <Text style={{ textAlign: 'center', color: "white", fontWeight: "bold" }}>Confirm</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  ) : (
                    <View style={themed($priceDashboard)}>
                      {selectedStation.isLoading ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                          <ActivityIndicator size="large" color={colors.palette.primary500} />
                          <Text size="sm" style={{ marginTop: 8, opacity: 0.5 }}>Fetching latest prices...</Text>
                        </View>
                      ) : selectedStation.fetchError ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                          <Icon icon="information" color={colors.palette.angry500} size={40} />
                          <Text style={{ textAlign: 'center', marginTop: 10, color: colors.palette.angry500 }} text="Sorry, there is a problem in this location." />
                        </View>
                      ) : (
                        <ScrollView nestedScrollEnabled contentContainerStyle={$scrollContentInternal}>
                          <View style={$priceGridContainer}>
                            {(() => {
                              const config = FUEL_BRAND_MAP[selectedStation.brand]
                              return Object.keys(config).map((key, index) => {
                                if (!config[key]) return null;

                                return (
                                  <View key={key} style={{ width: "33.33%", alignItems: "center" }}>
                                    <Text style={$fuelTypeLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{config[key]}</Text>
                                    
                                    {/* Toggle between Input for Reporting and Text for viewing */}
                                    {isReporting ? (
                                      <TextInput 
                                        style={$priceInput} 
                                        keyboardType="decimal-pad" 
                                        defaultValue=""
                                        placeholder="00.00" 
                                        onChangeText={(val) => {
                                          const cleaned = val
                                          .replace(/,/g, ".")
                                          .replace(/[^0-9.]/g, "")
                                          .replace(/(\..*)\./g, "$1")
                                          priceInputsRef.current[key] = cleaned;
                                        }}
                                      />
                                    ) : ( 
                                      <Text style={$fuelTypePrice}>
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
                          <TouchableOpacity style={[$directionsButton, selectedStation.fetchError && { opacity: 0.5, backgroundColor: '#ccc' }]} disabled={selectedStation.fetchError} onPress={showDirections}><Icon icon="directions" color="white" size={24} /><Text style={$buttonText}>Directions</Text></TouchableOpacity>
                          <TouchableOpacity style={[$directionsButton, { backgroundColor: colors.palette.primary500 }, selectedStation.fetchError && { opacity: 0.5, backgroundColor: '#ccc' }]} disabled={selectedStation.fetchError} onPress={() => setIsReporting(true)}><Icon icon="price_update" color="white" size={24} /><Text style={$buttonText}>Update Price</Text></TouchableOpacity>
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
                      <Image 
                        source={
                          currentContributor?.no_contributions < 50 ? ICON_MEDAL_SILVER : 
                          currentContributor?.no_contributions < 100 ? ICON_MEDAL_SILVER :
                          /*userData?.no_contributions >  100 ? */ ICON_MEDAL_GOLD
                        } 
                        style={{ width: 30, height: 30, marginLeft: 8 }} resizeMode="contain"
                      />
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

                <TouchableOpacity style={$paymentContainer} onPress={() => handleCopyNumber(currentContributor?.phone || "")} activeOpacity={0.5}>
                  {(currentContributor?.b_show_gcash || currentContributor?.b_show_maya) && currentContributor?.phone && (
                    <View style={$paymentCard}>
                      <View style={$cardTopRow}>
                          <Text size="xxs" weight="bold" style={{ color: colors.palette.neutral400 }}>
                            TIP VIA
                          </Text>
                        <Icon icon="copy" size={20} color={colors.palette.neutral400} />
                      </View>

                      <View style={$cardBottomRow}>
                        <View style={$eWalletGroup}>
                            {currentContributor?.b_show_gcash && (
                              <View style={$eWalletWrapper}>
                                <GCashLogo width={32} height={20} />
                              </View>
                            )}
                            {currentContributor?.b_show_maya && (
                              <View style={$eWalletWrapper}>
                                <MayaLogo width={32} height={20} />
                              </View>
                            )}
                          </View>
                        <Text weight="semiBold" style={$phoneNumberText}>
                          {currentContributor?.phone}
                        </Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
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
      {region.latitudeDelta < ZOOM_THRESHOLD && !isAddMarkerMode && (
        <TouchableOpacity 
          style={[$utilityBtn, { bottom: 120, backgroundColor: isAddMarkerMode ? colors.palette.angry500 : "#1737ba" }]} 
          onPress={toggleAddMarkerMode}
        >
          <Icon icon={isAddMarkerMode ? "close" : "add_marker"} color="white" size={24} />
        </TouchableOpacity>
      )}
      {/* --ADD STATION BUTTON */}
      {/* --ADD STATION CROSSHAIR */}
      {isAddMarkerMode && (
        <Animated.View entering={FadeInUp} style={$addMarkerToolTip}>
          <Text text="Zoom in for better accuracy" style={{ color: 'white', marginBottom: 7 }} />
          <View style={{flex: 1, flexDirection: "row", padding: 10, justifyContent: "space-between", width: "90%", alignItems: "center"}}>
            <TouchableOpacity style={$confirmBtn} onPress={() => toggleAddMarkerMode()}>
              <Text text="Cancel" style={{ color: 'white', fontWeight: 'bold' }} />
            </TouchableOpacity>
            <TouchableOpacity style={$confirmBtn} onPress={() => setReportModalVisible(true)}>
              <Text text="Set Location" style={{ color: 'white', fontWeight: 'bold' }} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
      {isAddMarkerMode && (
        <View style={[$crosshairContainer, { width: mapLayout.width, height: mapLayout.height, marginTop: 130, }]} pointerEvents="none">
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
              {/* BRAND DROPDOWN */}
              <Text preset="formLabel" text="Brand" />
              <TouchableOpacity 
                style={$brandPickerTrigger} 
                onPress={() => setIsAddStationBrandPickerVisible(true)}
              >
                <Text text={reportData.brand || "Select or Type Brand"} />
                <Icon icon="caret_right" size={20} />
              </TouchableOpacity>
              <Modal 
                visible={isAddStationBrandPickerVisible} 
                transparent 
                animationType="slide"
              >
                <View style={$brandModalOverlay}>
                  <View style={$brandModalContent}>
                    <View style={$searchBrandModalHeader}>
                      <Text weight="bold">Select Brand</Text>
                      <TouchableOpacity onPress={() => setIsAddStationBrandPickerVisible(false)}>
                        <Icon icon="close" size={24} />
                      </TouchableOpacity>
                    </View>

                    <View style={$searchBrandContainer}>
                      <Icon icon="search" size={20} color="#8E8E93" />
                      <TextInput
                        style={$searchBrandInput}
                        placeholder="Search or type new brand..."
                        value={brandSearchQuery}
                        onChangeText={setBrandSearchQuery}
                        autoCapitalize="words"
                      />
                    </View>

                    <ScrollView style={{ maxHeight: 400 }}>
                      {filteredBrandOptions.map((brand) => {
                        const isNew = !availableBrands.includes(brand)
                        return (
                          <TouchableOpacity 
                            key={brand} 
                            style={$brandOption} 
                            onPress={() => {
                              setReportData({ ...reportData, brand })
                              setIsAddStationBrandPickerVisible(false)
                              setBrandSearchQuery("")
                            }}
                          >
                            <Text style={{ color: isNew ? colors.palette.primary500 : "black" }}>
                              {brand} {isNew ? "(Add New)" : ""}
                            </Text>
                            {reportData.brand === brand && <Icon icon="check" size={20} color={colors.palette.primary500} />}
                          </TouchableOpacity>
                        )
                      })}
                    </ScrollView>
                  </View>
                </View>
              </Modal>
              {/* MUNICIPALITY DROPDOWN */}
              {/* --- 1. THE TRIGGER FIELD (Place this in your 'Add Station' Form) --- */}
              <Text preset="formLabel" text="Municipality/City" style={{ marginBottom: 4 }} />
              <TouchableOpacity 
                activeOpacity={0.7}
                style={$selectTrigger} 
                onPress={() => setIsMuniPickerVisible(true)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Icon icon="search" size={20} color={colors.palette.neutral500} style={{ marginRight: 8 }} />
                  <Text 
                    style={{ color: reportData.city ? colors.text : colors.palette.neutral400 }} 
                    text={reportData.city || "Select Municipality"} 
                  />
                </View>
                <Icon icon="caret_right" size={18} color={colors.palette.neutral400} />
              </TouchableOpacity>

              <Modal 
                visible={isMuniPickerVisible} 
                transparent 
                animationType="slide"
              >
                <View style={$brandModalOverlay}>
                  <View style={$brandModalContent}>
                    
                    {/* Header */}
                    <View style={$searchBrandModalHeader}>
                      <Text weight="bold" size="md">Select Municipality</Text>
                      <TouchableOpacity onPress={() => {
                        setIsMuniPickerVisible(false)
                        setMuniSearchQuery("")
                      }}>
                        <Icon icon="close" size={24} />
                      </TouchableOpacity>
                    </View>

                    {/* Improved Search Input */}
                    <View style={$searchWrapper}>
                      <View style={$searchBarInner}>
                        <Icon icon="search" size={20} color={colors.palette.neutral500} />
                        <TextInput
                          style={$searchInputField}
                          placeholder="Search city or town..."
                          placeholderTextColor={colors.palette.neutral400}
                          value={muniSearchQuery}
                          onChangeText={setMuniSearchQuery}
                          autoCapitalize="words"
                          autoFocus={true}
                        />
                        {muniSearchQuery.length > 0 && (
                          <TouchableOpacity onPress={() => setMuniSearchQuery("")}>
                            <Icon icon="close" size={18} color={colors.palette.neutral500} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Results List */}
                    <ScrollView 
                      style={{ maxHeight: 450, marginTop: 8 }} 
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      {muniSearchQuery.length < 2 ? (
                        <View style={{ padding: 40, alignItems: 'center' }}>
                          <Icon icon="search" size={40} color={colors.palette.neutral300} />
                          <Text 
                            style={{ color: colors.palette.neutral500, marginTop: 8, textAlign: 'center' }} 
                            text="Search by typing at least 2 letters of the city name" 
                          />
                        </View>
                      ) : filteredMuniOptions.length > 0 ? (
                        filteredMuniOptions.map((muni) => (
                          <TouchableOpacity 
                            key={muni.code} // FIXED: Unique PSGC Code
                            style={$resultItem} 
                            onPress={() => {
                              setReportData({ ...reportData, city: muni.name })
                              setIsMuniPickerVisible(false)
                              setMuniSearchQuery("")
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text weight="medium" text={muni.name} />
                              <Text 
                                size="xxs" 
                                style={{ color: colors.palette.neutral500 }} 
                                text={muni.provinceName || muni.regionName || "Philippines"} 
                              />
                            </View>
                            {reportData.city === muni.name && (
                              <View style={$checkCircle}>
                                <Icon icon="check" size={12} color="white" />
                              </View>
                            )}
                          </TouchableOpacity>
                        ))
                      ) : (
                        <View style={{ padding: 40, alignItems: 'center' }}>
                          <Text style={{ color: colors.palette.neutral500 }}>No results found.</Text>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                </View>
              </Modal>
              
              <Text text="Available Fuel Types" weight="bold" style={{ marginTop: 20, marginBottom: 5 }} />
              
              {renderFuelToggle("Regular Gasoline", "has_regular_gas", "regular_gas_name", "e.g. FuelSave")}
              {renderFuelToggle("Premium Gasoline", "has_premium_gas", "premium_gas_name", "e.g. V-Power")}
              {renderFuelToggle("Sports Gasoline", "has_sports_gas", "sports_gas_name", "e.g. V-Power Racing")}
              {renderFuelToggle("Regular Diesel", "has_regular_diesel", "regular_diesel_name", "e.g. FuelSave Diesel")}
              {renderFuelToggle("Premium Diesel", "has_premium_diesel", "premium_diesel_name", "e.g. V-Power Diesel")}
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <TouchableOpacity style={$pendingFormButtons} onPress={() => setReportModalVisible(false)}>
                <Text text="Cancel" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[$pendingFormButtons, { backgroundColor: colors.palette.primary500 }]} 
                onPress={() => handleFinalAddMarker(reportData, tempMarker)}
              >
                <Text text="Submit" style={{ color: 'white' }} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* a STATION FORM MODAL */}
      {/* --RESET VIEW */}
      {isNotAtMarkerLevel && !isAddMarkerMode && (
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
      {region.latitudeDelta < ZOOM_THRESHOLD && !isAddMarkerMode && /* TODO: Need to add AND isMapMounted  */ (
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

// #region STYLES
const $selectTrigger: ViewStyle = {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  backgroundColor: colors.palette.neutral100,
  borderRadius: 12,
  paddingHorizontal: 16,
  height: 56,
  borderWidth: 1,
  borderColor: colors.palette.neutral200,
  marginBottom: 16,
}

const $searchWrapper: ViewStyle = {
  paddingBottom: 16,
  borderBottomWidth: 1,
  borderBottomColor: colors.palette.neutral200,
}

const $searchBarInner: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: colors.palette.neutral100,
  borderRadius: 10,
  paddingHorizontal: 12,
  height: 48,
}

const $searchInputField: TextStyle = {
  flex: 1,
  marginLeft: 8,
  fontSize: 16,
  color: colors.text,
}

const $resultItem: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 14,
  borderBottomWidth: 1,
  borderBottomColor: colors.palette.neutral100,
}

const $checkCircle: ViewStyle = {
  width: 22,
  height: 22,
  borderRadius: 11,
  backgroundColor: colors.palette.primary500,
  justifyContent: 'center',
  alignItems: 'center',
}
const $searchBrandModalHeader: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }
const $searchBrandContainer: ViewStyle = { 
  flexDirection: 'row', 
  alignItems: 'center', 
  backgroundColor: '#F2F2F7', 
  borderRadius: 10, 
  paddingHorizontal: 10, 
  marginBottom: 16, 
  height: 45 
}

const $searchBrandInput: TextStyle = { 
  flex: 1, 
  height: '100%', 
  marginLeft: 8, 
  color: 'black' 
}

const $searchBrandOption: ViewStyle = {
  flexDirection: 'row',
  justifyContent: 'space-between',
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: '#F2F2F7'
}
const $eWalletGroup: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 8, // Clean spacing between logos
}
const $eWalletWrapper: ViewStyle = {
  backgroundColor: colors.palette.neutral100,
  paddingHorizontal: 6,
  paddingVertical: 4,
  borderRadius: 4,
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
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
  justifyContent: "space-between",
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
const $fuelTag: ViewStyle = {
  backgroundColor: "white",
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: 6,
  borderWidth: 1,
  borderColor: colors.palette.primary500,
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
const $addMarkerToolTip: ViewStyle = {
  position: 'absolute',
  bottom: 50,
  left: 10,
  right: 10,
  backgroundColor: 'rgba(0,0,0,0.85)',
  padding: 10,
  borderRadius: 15,
  alignItems: 'center',
  zIndex: 100,
}
const $confirmBtn: ViewStyle = {
  backgroundColor: colors.palette.primary500,
  paddingHorizontal: 24,
  paddingVertical: 12,
  borderRadius: 25,
  width: 150,
  alignItems: "center",
  justifyContent: "center"
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
const $statLabel: TextStyle = { color: colors.palette.neutral400, marginTop: 4 }
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
const $fuelTypeSegment: TextStyle = { fontSize: 12, color: colors.palette.neutral400}
const $fuelTypeSegmentActive: TextStyle = { color: colors.palette.primary500, fontWeight: "bold" }
const $brandPickerTrigger: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F2F2F7', borderRadius: 10, padding: 12, marginTop: 8 }
const $filterInput: TextStyle = { backgroundColor: "#F2F2F7", borderRadius: 10, padding: 12, marginTop: 8, fontSize: 16 }
const $brandModalOverlay: ViewStyle = { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }
const $brandModalContent: ViewStyle = { backgroundColor: 'white', width: '85%', borderRadius: 20, padding: 20 }
const $brandModalHeader: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }
const $brandOption: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: HAIRLINE, borderBottomColor: '#EEE' }
const $checkbox: ViewStyle = { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: '#D1D1D6', justifyContent: 'center', alignItems: 'center' }
const $checkboxActive: ViewStyle = { backgroundColor: colors.palette.primary500, borderColor: colors.palette.primary500 }
const $pendingFormButtons: ViewStyle = { flex: 1, paddingVertical: 12, borderRadius: 25, alignItems: 'center' }

const $userInfoCard: ViewStyle = { backgroundColor: 'white', width: '90%', borderRadius: 24, padding: 24, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }
const $feedbackRowExpanded: ViewStyle = { flexDirection: 'row', width: '100%', borderTopWidth: HAIRLINE, borderTopColor: '#EEE', paddingTop: 10, alignItems: 'center' }
const $feedbackBtn: ViewStyle = { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }
const $verticalDividerFeedback: ViewStyle = { width: 1, height: 40, backgroundColor: '#EEE' }

const $modalOverlay: ViewStyle = { flex: 1, justifyContent: "flex-end" }
const $detailCard: ViewStyle = { backgroundColor: "white", height: 350 }
const $dismissHandle: ViewStyle = { borderTopLeftRadius: 20, borderTopRightRadius: 20, alignItems: 'center', paddingVertical: 5, backgroundColor: '#605e5e' }
const $innerContent: ViewStyle = { paddingHorizontal: 20, paddingTop: 12 }
const $favoriteBtn: ViewStyle = { padding: 8 }
const $priceDashboard: ViewStyle = { backgroundColor: "#F2F2F7", borderRadius: 16, marginTop: 10, height: 160, borderWidth: 1, borderColor: "#E5E5EA" }
const $scrollContentInternal: ViewStyle = { paddingVertical: 14, paddingHorizontal: 8 }
const $priceGridContainer: ViewStyle = { flexDirection: "row", flexWrap: "wrap", rowGap: 16 }
const $verticalDivider: ViewStyle = { position: 'absolute', right: 0, height: '65%', width: 1, backgroundColor: "#D1D1D6" }
const $fuelTypeLabel: TextStyle = { color: "#8E8E93", fontSize: 14, fontWeight: "600" }
const $fuelTypePrice: TextStyle = { color: "#1C1C1E", fontSize: 16, fontWeight: "700" }
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
  const [shouldTrack, setShouldTrack] = useState(true)

  useEffect(() => {
    setShouldTrack(true)

    const timer = setTimeout(() => {
      setShouldTrack(false)
    }, 600)

    return () => clearTimeout(timer)
  }, [stations.length, activeFuelSubType])

  return (
    <>
      {stations.map((s) => {
        const priceValue = activeFuelSubType ? parseFloat(s[activeFuelSubType]) : 0
        const hasPrice = activeFuelSubType !== null && priceValue > 0
        
        const markerKey = `marker-${s.id}-${activeFuelSubType || "none"}`

        return (
          <Marker
            key={markerKey}
            coordinate={{ latitude: Number(s.latitude), longitude: Number(s.longitude) }}
            onPress={() => onMarkerPress(s.id)}
            tracksViewChanges={shouldTrack}
          >
            <View style={$priceBadgeContainer}>
              {hasPrice && (
                <View style={$priceBadgePill}>
                  <Text style={$priceBadgeText}>P{priceValue.toFixed(2)}</Text>
                </View>
              )}
              <Image 
                source={ICON_FUEL_MARKER} 
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

const $priceBadgeContainer: ViewStyle = {
  alignItems: 'center',
  justifyContent: 'center',
  padding: 5,
}

const $priceBadgePill: ViewStyle = {
  backgroundColor: colors.palette.secondary600,
  paddingHorizontal: 6,
  paddingVertical: 2,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: "#FFFFFF",
  marginBottom: -2,
  zIndex: 10,
  elevation: 4, // Required for Android shadow/background stability
}

const $priceBadgeText: TextStyle = {
  color: '#FFFFFF',
  fontSize: 10,
  fontWeight: 'bold',
}