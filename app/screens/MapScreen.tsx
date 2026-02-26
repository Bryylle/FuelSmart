import React, { FC, useMemo, useState, useRef, useEffect, useCallback } from "react"
import { ActivityIndicator, Platform, Pressable, View, ViewStyle, TextStyle, Image, ScrollView, TouchableOpacity, PixelRatio, Linking, Modal, Alert, KeyboardAvoidingView, TextInput, StyleSheet, } from "react-native"
import * as Clipboard from "expo-clipboard"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { DemoTabScreenProps } from "@/navigators/navigationTypes"
import { useAppTheme } from "@/theme/context"
import { Icon, PressableIcon } from "@/components/Icon"
import { ScreenHeader } from "@/components/ScreenHeader"
import { Switch } from "@/components/Toggle/Switch"
import MapView, { PROVIDER_GOOGLE, Marker, Region } from "react-native-maps"
import { supabase } from "@/services/supabase"
import { debounce, pad } from "lodash"
import type { ThemedStyle } from "@/theme/types"
import Animated, { FadeIn, FadeInUp, FadeOutUp } from "react-native-reanimated"
import { formatDistanceToNow } from "date-fns"
import { colors } from "@/theme/colors"
import { initFuelMappings, FUEL_BRAND_MAP } from "../utils/fuelMappings"
import Slider from '@react-native-community/slider'
import * as Location from "expo-location"
import { useFocusEffect } from "@react-navigation/native"
import { spacing } from "@/theme/spacing"
import { BrandListModal } from "@/components/BrandListModal"
import { MunicipalityListModal } from "@/components/MunicipalityListModal"
import { $gStyles } from "@/theme/styles"
import { ContributorModal } from "@/components/ContributorModal"
import { StationDetailModal } from "@/components/StationDetailModal"

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

  const [contributorIdToShow, setContributorIdToShow] = useState<string | null>(null)
  const [isContributorModalVisible, setIsContributorModalVisible] = useState(false)
  const handleOpenContributor = (id: string) => {
    setContributorIdToShow(id)
    setIsContributorModalVisible(true)
  }

  const priceInputsRef = useRef<Record<string, string>>({});
  const [isReporting, setIsReporting] = useState(false)
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
 const renderFuelToggle = (label: string, boolKey: keyof ReportData, nameKey: keyof ReportData, placeholder: string) => {
    const isBrandEmpty = !reportData.brand.trim();
    const shouldDisable = isExistingBrand || isBrandEmpty;

    return (
      <View style={styles.mt_10}>
        <View style={styles.toggleRow}>
          <Text text={label} style={[styles.flex, shouldDisable && styles.opacity_half]} />
          <Switch
            onValueChange={() => 
              setReportData({ ...reportData, [boolKey]: !reportData[boolKey] })
            }
            value={reportData[boolKey] as boolean}
            disabled={shouldDisable}
          />
        </View>
        
        {reportData[boolKey] && !isExistingBrand && (
          <Animated.View entering={FadeInUp} exiting={FadeOutUp}>
            <TextInput
              placeholder={`(${placeholder})`}
              style={styles.miniInput} 
              placeholderTextColor="#999"
              value={reportData[nameKey] as string}
              onChangeText={(t) => setReportData({ ...reportData, [nameKey]: t })}
              maxLength={20}
            />
          </Animated.View>
        )}
      </View>
    )
  }
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
  useEffect(() => {
    if (!reportModalVisible) {
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
        premium_diesel_name: "",
      });
    }
  }, [reportModalVisible]);
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
  const [isBrandPickerVisible, setIsBrandPickerVisible] = useState(false)
  const [modalBrands, setModalBrands] = useState<string[]>([])

  const [tempMaxPrice, setTempMaxPrice] = useState<string>("")
  const [tempBrands, setTempBrands] = useState<string[]>([]) 
  const [tempDistance, setTempDistance] = useState<number | null>(120) 
  const [tempFuelType, setTempFuelType] = useState<string | null>(null)
  const [tempFuelSubType, setTempFuelSubType] = useState<string | null>(null)
  const [activeBrands, setActiveBrands] = useState<string[]>([])
  const [activeFuelType, setActiveFuelType] = useState<string | null>(null)
  const [activeFuelSubType, setActiveFuelSubType] = useState<string | null>(null)
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
  }, [activeFuelType, activeFuelSubType, activeMaxPrice, activeDistance, activeBrands])
  const handleApplyAll = () => { 
    setActiveFuelType(tempFuelType)
    setActiveFuelSubType(tempFuelSubType)
    setActiveMaxPrice(tempMaxPrice)
    setActiveBrands([...tempBrands])
    setActiveDistance(tempDistance)
    setIsFilterVisible(false) 
  }

  const filteredStations = useMemo(() => {
    return stations.filter((s) => {
      // 1. Brand Filter
      if (activeBrands.length > 0 && !activeBrands.includes(s.brand)) return false
      // 2. Price Filter (Dynamic based on sub-type)
      const limit = parseFloat(activeMaxPrice)
      if (!isNaN(limit) && limit > 0) {
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

  const handleClearAll = () => {
    setTempFuelType(null)
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
    <Screen contentContainerStyle={styles.flex}>
      <ScreenHeader
        title=""
        rightIcon="information"
      />
      {/* --MAPVIEW */}
      <View 
        style={styles.flex} 
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout
          setMapLayout({ width, height })
        }}
      >
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.flex}
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
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Pressable style={styles.inline_006} onPress={() => setIsFilterVisible(!isFilterVisible)}>
              <Icon icon="search" color={"##1737ba"} size={24} />
              <Text style={styles.searchPlaceholder} numberOfLines={1}>
                {activeBrands.length === 0 ? "All Brands" : `${activeBrands.length} Selected`} • {activeDistance}km radius
              </Text>
              {hasFilterApplied && (
                <PressableIcon icon="close" color={colors.palette.neutral100} size={24} onPress={handleClearAll} style={styles.inline_007}/>
              )}
            </Pressable>
          </View>
              {/* fsd */}
          {isFilterVisible && (
            <Animated.View entering={FadeInUp} exiting={FadeOutUp} style={styles.filterDropdown}>
              <>
                <Text weight="bold" size="xs">Fuel Type</Text>
                <View style={styles.segmentedControl}>
                  {([null, "gas", "diesel"] as const).map((type) => (
                    <TouchableOpacity 
                      key={type ?? "none"} 
                      style={[styles.segment, tempFuelType === type && styles.segmentActive]} 
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
                      <Text style={[styles.fuelTypeSegment, tempFuelType === type && styles.fuelTypeSegmentActive]}>
                        {type === "gas" ? "Gasoline" : type === "diesel" ? "Diesel" : "None"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {tempFuelType && (
                  <Animated.View entering={FadeInUp} style={[styles.inline_008]}>
                    <View style={[styles.segmentedControl, ]}>
                      {(tempFuelType === "gas" 
                        ? ["regular_gas", "premium_gas", "sports_gas"] 
                        : ["regular_diesel", "premium_diesel"]
                      ).map((sub) => (
                        <TouchableOpacity 
                          key={sub} 
                          style={[styles.segment, tempFuelSubType === sub && styles.segmentActive, styles.inline_009]} 
                          onPress={() => setTempFuelSubType(sub)}
                        >
                          <Text style={[styles.fuelTypeSegment, tempFuelSubType === sub && styles.fuelTypeSegmentActive, styles.inline_010]}>
                            {sub.split('_')[0].toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.flexRow}>
                      <Text weight="bold" size="xs" style={styles.mt_12}>Max Price (Optional):</Text>
                      <View style={[styles.flexRow, styles.inline_012]}>
                        <TextInput
                          style={styles.priceInput}
                          value={tempMaxPrice}
                          onChangeText={setTempMaxPrice}
                          placeholder="e.g. 50.00"
                          keyboardType="numeric"
                          placeholderTextColor="#C7C7CC"
                          maxLength={5}
                        />
                        <Text size="xxs" style={styles.opacity_half}>Per Liter</Text>
                      </View>
                    </View>
                    
                  </Animated.View>
                )}
              </>
              <>
                <Text weight="bold" size="xs" style={styles.mt_12}>Brand</Text>
                <TouchableOpacity style={styles.modalTriggerBtn} onPress={() => { 
                    setModalBrands([...tempBrands])
                    setIsBrandPickerVisible(true)
                  }}>
                  <Text size="sm" numberOfLines={1}>{tempBrands.length === 0 ? "All Brands" : tempBrands.join(", ")}</Text>
                  <Icon icon="caret_right" size={20} />
                </TouchableOpacity>
              </>
              <>
                <View style={styles.mt_12}>
                  <View style={styles.inline_014}>
                    <Text weight="bold" size="xs">Distance Radius</Text>
                    <Text weight="bold" size="xs" style={styles.inline_015}>
                      {tempDistance} km
                    </Text>
                  </View>
                  
                  <Slider
                    style={styles.inline_016}
                    minimumValue={1}
                    maximumValue={120}
                    step={1}
                    value={tempDistance || 120}
                    onValueChange={(val: number) => setTempDistance(val)}
                    minimumTrackTintColor={colors.palette.primary400}
                    maximumTrackTintColor="#D1D1D6"
                    thumbTintColor={colors.palette.primary400}
                  />
                  <View style={styles.inline_017}>
                    <Text size="xxs" style={styles.inline_018}>1km</Text>
                    <Text size="xxs" style={styles.inline_018}>120km</Text>
                  </View>
                </View>
              </>
              <>
                <View style={styles.inline_019}>
                  <TouchableOpacity style={[styles.pendingFormBtns, {backgroundColor: colors.childBackground}]} onPress={handleCancelFilters}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.pendingFormBtns, styles.bgPrimary500]} onPress={handleApplyAll}><Text style={styles.inline_004}>Apply</Text></TouchableOpacity>
                </View>
              </>
            </Animated.View>
          )}
        </View>
      )}
      {/* --SEARCH BAR */}
      {/* --SEARCH BAR BRAND PICKER MODAL */}
      <BrandListModal
        isVisible={isBrandPickerVisible}
        onClose={() => {
          setIsBrandPickerVisible(false)
          setBrandSearchQuery("")
        }}
        headerText="Filter Brands"
        options={availableBrands}
        selectedValues={modalBrands}
        singleSelect={false}
        searchQuery={brandSearchQuery}
        onSearchChange={setBrandSearchQuery}
        onSelect={(selected) => {
          setTempBrands(selected as string[])
          setIsBrandPickerVisible(false)
        }}
      />
      {/* --SEARCH BAR BRAND PICKER MODAL */}
      {/* --STATION CARD DETAIL MODAL*/}
      <StationDetailModal
        selectedStation={selectedStation}
        setSelectedStation={setSelectedStation}
        isReporting={isReporting}
        setIsReporting={setIsReporting}
        favorites={favorites}
        toggleFavorite={toggleFavorite}
        handleUpdatePrice={handleUpdatePrice}
        priceInputsRef={priceInputsRef}
        showDirections={showDirections}
        onOpenContributor={handleOpenContributor}
        getDisplayName={getDisplayName}
        loggedInUserId={loggedInUser?.id}
        hasVoted={hasVoted}
        handleVerifyOrDenyPendingMarker={handleVerifyOrDenyPendingMarker}
        handleCancelMyReport={handleCancelMyReport}
      />
      {/* --STATION CARD DETAIL MODAL*/}
      {/* --CONTRIBUTOR MODAL */}
      <ContributorModal 
        isVisible={isContributorModalVisible}
        contributorId={contributorIdToShow}
        onClose={() => {
          setIsContributorModalVisible(false)
          setContributorIdToShow(null)
        }}
      />
      {/* --CONTRIBUTOR MODAL */}
      {/* --UTILITY BUTTONS */}
      <View style={styles.utilityBtnContainer}>
        <>
          {/* --ADD STATION BUTTON */}
          {region.latitudeDelta < ZOOM_THRESHOLD && !isAddMarkerMode && (
            <TouchableOpacity 
              style={[styles.utilityBtn, { bottom: 120 }]} 
              onPress={toggleAddMarkerMode}
            >
              <Icon icon={isAddMarkerMode ? "close" : "add_marker"} color={colors.palette.primary600} size={24} />
            </TouchableOpacity>
          )}
          {/* --ADD STATION BUTTON */}
        </>
        <>
          {/* --3D MAP VIEW BUTTON*/}
          {region.latitudeDelta < ZOOM_THRESHOLD && !isAddMarkerMode && /* TODO: Need to add AND isMapMounted  */ (
            <TouchableOpacity style={[styles.utilityBtn, { bottom: 190 }]} onPress={toggle3DMapView}>
              <Icon icon="layers" color={colors.palette.primary600} size={24} />
            </TouchableOpacity>
          )}
          {/* --3D MAP VIEW BUTTON*/}
        </>
        <>
          {/* --RESET VIEW */}
          {isNotAtMarkerLevel && !isAddMarkerMode && (
            <TouchableOpacity 
              style={[styles.utilityBtn, { bottom : 50 }]} 
              onPress={zoomToMarkerVisibleLevel}
              activeOpacity={0.9}
            >
              <Icon icon="reset_focus" color={colors.palette.primary600} size={24} />
            </TouchableOpacity>
          )}
          {/* --RESET VIEW */}
        </>
      </View>
      {/* --UTILITY BUTTONS */}
      {/* --ADD STATION CROSSHAIR */}
      {isAddMarkerMode && (
        <Animated.View entering={FadeInUp} style={styles.addMarkerToolTip}>
          <Text text="Zoom in for better accuracy" style={styles.inline_061} />
          <View style={styles.inline_062}>
            <TouchableOpacity style={[styles.crosshairBtn, {backgroundColor: colors.childBackground}]} onPress={() => toggleAddMarkerMode()}>
              <Text text="Cancel" style={styles.cancelText} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.crosshairBtn} onPress={() => setReportModalVisible(true)}>
              <Text text="Set Location" style={styles.inline_027} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
      {isAddMarkerMode && (
        <View style={[styles.crosshairContainer, { width: mapLayout.width, height: mapLayout.height, marginTop: 130, }]} pointerEvents="none">
          <Icon icon="close" color={"red"} size={40} />
          <View style={styles.crosshairDot} />
        </View>
      )}
      {/* --ADD STATION CROSSHAIR */}
      {/* --ADD STATION FORM MODAL */}
      <Modal visible={reportModalVisible} animationType="slide" transparent>
        <View style={styles.brandModalOverlay}>
          <View style={[styles.brandModalContent, styles.inline_063]}>
            <Text preset="subheading" text="Report New Station" />
            <ScrollView style={styles.inline_064} showsVerticalScrollIndicator={false}>
              <View style={styles.modalContentCategory}>
                <Text preset="formLabel" text="Brand" />
                <TouchableOpacity 
                  style={styles.modalTriggerBtn} 
                  onPress={() => setIsAddStationBrandPickerVisible(true)}
                >
                  <Text text={reportData.brand || "Select or Type Brand"} />
                  <Icon icon="caret_right" size={20} />
                </TouchableOpacity>
                <BrandListModal
                  isVisible={isAddStationBrandPickerVisible}
                  onClose={() =>  {
                    setIsAddStationBrandPickerVisible(false)
                    setBrandSearchQuery("")
                  }}
                  headerText="Select Brand"
                  options={filteredBrandOptions}
                  selectedValues={reportData.brand}
                  singleSelect={true} // Radio style
                  upperRightIcon={true} // No close button as requested
                  searchQuery={brandSearchQuery}
                  onSearchChange={setBrandSearchQuery}
                  onSelect={(brand) => {
                    setReportData({ ...reportData, brand: brand as string })
                    setIsAddStationBrandPickerVisible(false)
                    setBrandSearchQuery("")
                  }}
                />
              </View>
              <View style={styles.modalContentCategory}>
                <Text preset="formLabel" text="Municipality/City" />
                <TouchableOpacity 
                  style={styles.modalTriggerBtn} 
                  onPress={() => setIsMuniPickerVisible(true)}
                >
                  <Text size="sm">
                    {reportData.city || "Select Municipality"}
                  </Text>
                  <Icon icon="caret_right" size={20} />
                </TouchableOpacity>

                {/* Add the Modal component at the bottom of your MapScreen return */}
                <MunicipalityListModal
                  isVisible={isMuniPickerVisible}
                  onClose={() => {
                    setIsMuniPickerVisible(false)
                    setMuniSearchQuery("")
                  }}
                  searchQuery={muniSearchQuery}
                  onSearchChange={setMuniSearchQuery}
                  options={municipalities}
                  isLoading={isLoadingMuni}
                  onSelect={(name) => {
                    setReportData({ ...reportData, city: name })
                    setMuniSearchQuery("")
                  }}
                />
              </View>
              <View style={styles.modalContentCategory}>
                <Text text="Available Fuel Types" weight="bold" />
                {renderFuelToggle("Regular Gasoline", "has_regular_gas", "regular_gas_name", "e.g. Regular")}
                {renderFuelToggle("Premium Gasoline", "has_premium_gas", "premium_gas_name", "e.g. Premium")}
                {renderFuelToggle("Sports Gasoline", "has_sports_gas", "sports_gas_name", "e.g. Super Premium")}
                {renderFuelToggle("Regular Diesel", "has_regular_diesel", "regular_diesel_name", "e.g. Diesel")}
                {renderFuelToggle("Premium Diesel", "has_premium_diesel", "premium_diesel_name", "e.g. Premium Diesel")}
              </View>
            </ScrollView>

            <View style={styles.inline_026}>
              <TouchableOpacity style={[styles.pendingFormBtns, { backgroundColor: colors.childBackground }]} onPress={() => setReportModalVisible(false)}>
                <Text style={styles.cancelText} text="Cancel" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.pendingFormBtns, styles.bgPrimary500]} 
                onPress={() => handleFinalAddMarker(reportData, tempMarker)}
              >
                <Text text="Submit" style={styles.inline_072} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* --ADD STATION FORM MODAL */}
      {/* --ATTRIBUTION AREA */}
      <View style={styles.attributionContainer}>
        <View style={styles.flex} /> 
        <TouchableOpacity 
          activeOpacity={0.7}
          onPress={() => Linking.openURL("https://www.openstreetmap.org/copyright")}
          style={styles.attributionBackground}
        >
          <Text style={styles.attributionText}>
            © <Text style={styles.linkText}>OpenStreetMap</Text> contributors
          </Text>
        </TouchableOpacity>
      </View>
      {/* --ATTRIBUTION AREA */}
    </Screen>
  )
}

// #region STYLES
const styles = StyleSheet.create({
  cancelText: { color: "#666", fontWeight: "600" },
  utilityBtnContainer: {
    position: 'absolute',
    right: 10,
    bottom: 50,
    zIndex: Z_INDEX_HELPER_BUTTONS,
  },
  utilityBtn: {
    position: 'absolute',
    right: 0,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#ffffff", 
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  modalContentCategory: {
    marginBottom: spacing.md
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  flexRowSpaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contributorWalletGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8, // Clean spacing between logos
  },
  contributorWalletWrapper: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.palette.neutral300,
  },
  contributorPaymentContainer: {
    marginTop: spacing.xs,
    borderRadius: 16,
  },
  contributorPaymentCard: {
    backgroundColor: "#F2F2F7",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E5EA",
  },
  contributorCardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  contributorCardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  contributorPhoneNumber: {
    fontSize: 17,
    color: "#1C1C1E",
    letterSpacing: 0.5,
  },
  fuelTag: {
    backgroundColor: "white",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.palette.primary500,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: HAIRLINE,
    borderBottomColor: "#EEE",
  },
  crosshairContainer: {
    position: 'absolute',
    top: 0, 
    left: 0,
    justifyContent: "center", 
    alignItems: "center",     
    opacity: 0.8,
    zIndex: 10,
  },
  crosshairDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "red",
    position: "absolute",
  },
  addMarkerToolTip: {
    position: 'absolute',
    bottom: 50,
    left: 10,
    right: 10,
    backgroundColor: colors.palette.neutral700,
    padding: 10,
    borderRadius: $gStyles.cardBorderRadius,
    alignItems: 'center',
    zIndex: Z_INDEX_HELPER_BUTTONS,
  },
  crosshairBtn: {
    backgroundColor: colors.palette.primary500,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    width: '48%',
    alignItems: "center",
    justifyContent: "center"
  },
  miniInput: {
    backgroundColor: "#F2F2F7",
    borderRadius: $gStyles.inputBorderRadius,
    padding: 10,
    marginTop: 5,
    fontSize: 14,
    color: "black",
    borderWidth: HAIRLINE,
    borderColor: "#D1D1D6",
  },
  attributionContainer: {
    position: "absolute",
    bottom: 8, 
    left: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    pointerEvents: "box-none",
  },
  attributionBackground: {
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 2,
  },
  attributionText: {
    fontSize: 10, 
    color: "#444",
  },
  linkText: {
    fontSize: 11, 
    color: "#007AFF", 
  },
  profileHeader: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  avatarCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#E5E5EA", alignItems: "center", justifyContent: "center", marginRight: 16 },
  avatarText: { color: "#1737ba" },
  nameContainer: { flex: 1 },
  tierRow: { flexDirection: "row", alignItems: "center" },
  contributorStatsRow: { flexDirection: "row", backgroundColor: "#F2F2F7", borderRadius: 16, padding: 16, marginBottom: 12 },
  contributorStatBox: { flex: 1, alignItems: "center" },
  statValue: { color: "#1C1C1E", fontSize: 18 },
  statLabel: { color: colors.palette.neutral400, marginTop: 4 },
  closeBtn: { backgroundColor: "#1737ba", paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  leftActionWrapper: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 16,
  },
  searchContainer: { position: "absolute", top: 100, left: 10, right: 10, zIndex: Z_INDEX_SEARCH_BAR },
  searchBar: { backgroundColor: "white", height: 50, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 15, elevation: 5 },
  searchPlaceholder: { flex: 1, marginLeft: 10, color: "#8E8E93", fontSize: 13 },
  filterDropdown: { backgroundColor: colors.background, marginTop: 10, borderRadius: 12, padding: 20, elevation: 5 },
  segmentedControl: { flexDirection: "row", backgroundColor: colors.childBackground, borderRadius: 10, padding: 2, marginTop: 8 },
  segment: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 8 },
  segmentActive: { backgroundColor: "white", elevation: 2 },
  fuelTypeSegment: { fontSize: 12, color: colors.palette.neutral400},
  fuelTypeSegmentActive: { color: colors.palette.primary400, fontWeight: "bold" },
  modalTriggerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.childBackground, borderRadius: 8, padding: 12, marginTop: 8 },
  brandModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  brandModalContent: { backgroundColor: colors.background, width: '90%', borderRadius: $gStyles.cardBorderRadius, padding: 20 },
  pendingFormBtns: { flex: 1, paddingVertical: 12, borderRadius: $gStyles.buttonBorderRadius, alignItems: 'center' },
  userInfoCard: { backgroundColor: 'white', width: '90%', borderRadius: 24, padding: 24, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  detailCard: { backgroundColor: colors.background, minHeight: 350 },
  dismissHandle: { borderTopLeftRadius: 20, borderTopRightRadius: 20, alignItems: 'center', paddingVertical: 5, backgroundColor: colors.palette.neutral600 },
  innerContent: { paddingHorizontal: 20, paddingTop: 12 },
  favoriteBtn: { padding: 8 },
  priceDashboard: { minHeight: 140, backgroundColor: colors.childBackground, borderRadius: $gStyles.subCardBorderRadius, marginTop: 10, borderWidth: 1, borderColor: colors.palette.neutral200 },
  scrollPriceGrid: { paddingVertical: 14, paddingHorizontal: 8 },
  priceGridContainer: { flexDirection: "row", flexWrap: "wrap", rowGap: 16 },
  fuelTypeLabel: { color: "#8E8E93", fontSize: 14, fontWeight: "600" },
  fuelTypePrice: { color: "#1C1C1E", fontSize: 16, fontWeight: "700" },
  priceInput: { color: colors.palette.primary400, fontSize: 13, fontWeight: "700", borderBottomWidth: 1, borderBottomColor: colors.palette.primary500, textAlign: 'center', minWidth: 50 },
  stationDetailBtnWrapper: { padding: 20 },
  stationDetailBtnRow: { flexDirection: "row", gap: 10, justifyContent: "space-between" },
  priceBadgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 5,
  },
  priceBadgePill: {
    backgroundColor: colors.palette.secondary600,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FFFFFF",
    marginBottom: -2,
    zIndex: 10,
    elevation: 4, // Required for Android shadow/background stability
  },
  priceBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  mt_12: { marginTop: 12 },
  mt_10: { marginTop: 8 },
  flex: { flex: 1 },
  opacity_half: { opacity: 0.5 },
  inline_004: { color: "white", fontWeight: "bold" },
  inline_005: { marginRight: 10 },
  inline_006: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  inline_007: { backgroundColor: colors.palette.neutral800, borderRadius: 20},
  inline_008: { marginTop: spacing.xxxs, width: "100%" },
  inline_009: { paddingHorizontal: 12 },
  inline_010: { fontSize: 10 },
  inline_012: { marginLeft: 6 },
  inline_014: { flexDirection: 'row', justifyContent: 'space-between' },
  inline_015: { color: colors.palette.primary400 },
  inline_016: { width: '100%', height: 40 },
  inline_017: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 },
  inline_018: { color: '#8E8E93' },
  inline_019: { flexDirection: 'row', gap: 10, marginTop: 15 },
  bgPrimary400: { backgroundColor: colors.palette.primary400 },
  bgPrimary500: { backgroundColor: colors.palette.primary500 },
  inline_023: { flexDirection: 'row', alignItems: 'center' },
  inline_024: { marginRight: 8 },
  inline_026: { flexDirection: 'row', gap: 10, marginTop: 20 },
  inline_027: { color: 'white', fontWeight: 'bold' },
  inline_028: { zIndex: Z_INDEX_STATION_DETAIL },
  inline_029: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: '100%' },
  inline_030: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  inline_031: { fontWeight: 'bold' },
  inline_032: { color: "#8E8E93", fontWeight: 'bold' },
  inline_034: { backgroundColor: '#FFF9E6', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#FFE58F' },
  inline_035: { color: '#856404' },
  inline_036: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  inline_037: { marginTop: 10, gap: 10 },
  inline_038: { alignItems: 'center', padding: 10, backgroundColor: '#F2F2F7', borderRadius: 12, justifyContent: "flex-start" },
  inline_039: { backgroundColor: colors.palette.angry500, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, minHeight: 45 },
  inline_040: { color: '#FFFFFF', fontWeight: 'bold' },
  inline_041: { gap: 10, marginTop: 10 },
  inline_042: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  inline_043: { flex: 1, backgroundColor: colors.palette.secondary500  },
  inline_044: { textAlign: 'center', color: "white", fontWeight: "bold" },
  inline_045: { flex: 1, backgroundColor: colors.palette.primary500 },
  inline_046: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  inline_047: { marginTop: 8, opacity: 0.5 },
  inline_048: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  inline_049: { textAlign: 'center', marginTop: 10, color: colors.palette.angry500 },
  inline_050: { width: "33.33%", alignItems: "center" },
  inline_051: { backgroundColor: '#605e5e' },
  inline_052: { opacity: 0.5, backgroundColor: '#ccc' },
  inline_053: { zIndex: Z_INDEX_CONTRIBUTOR_DETAIL },
  inline_054: { padding: 40, alignItems: 'center', justifyContent: 'center' },
  inline_055: { color: "#8E8E93" },
  inline_056: { color: "black", flexShrink: 1 },
  inline_057: { width: 30, height: 30, marginLeft: 8 },
  inline_058: { color: "#666" },
  inline_059: { color: colors.palette.neutral400 },
  inline_060: { color: "white", fontWeight: "600" },
  inline_061: { color: 'white', marginVertical: 2 },
  inline_062: { flex: 1, flexDirection: "row", padding: 10, justifyContent: "space-between", width: "100%", alignItems: "center"},
  inline_063: { width: '90%' },
  inline_064: { maxHeight: 450, marginTop: 10 },
  inline_068: { padding: 40, alignItems: 'center' },
  inline_069: { color: colors.palette.neutral500, marginTop: 8, textAlign: 'center' },
  inline_070: { color: colors.palette.neutral500 },
  inline_072: { color: 'white', fontWeight: 'bold' },
  inline_075: { width: 30, height: 30, resizeMode: 'contain' },
  muniTriggerTextPlaceholder: { color: colors.palette.neutral400 },
  muniTriggerTextSelected: { color: colors.text },
  brandTextDefault: { color: 'black' },
  brandTextSelected: { color: colors.palette.primary500 },
})
const $headerStyle: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: "#1737ba",
})

const $headerTitle: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: "#fff",
})
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
            <View style={styles.priceBadgeContainer}>
              {hasPrice && (
                <View style={styles.priceBadgePill}>
                  <Text style={styles.priceBadgeText}>₱{priceValue.toFixed(2)}</Text>
                </View>
              )}
              <Image 
                source={ICON_FUEL_MARKER} 
                style={styles.inline_075} 
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

