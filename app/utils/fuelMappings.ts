import { supabase } from "@/services/supabase"
import AsyncStorage from "@react-native-async-storage/async-storage"

const CACHE_KEY = "fuel_brand_configs_cache"

export interface FuelBrandConfig {
  regular_gas?: string
  premium_gas?: string
  sports_gas?: string
  regular_diesel?: string
  premium_diesel?: string
  [key: string]: string | undefined 
}

// Keep the original export name so other screens don't break
// We initialize it with an empty object or your most common defaults
export let FUEL_BRAND_MAP: Record<string, FuelBrandConfig> = {}

/**
 * Call this once at App startup or in MapScreen's useEffect.
 * It loads from cache immediately, then refreshes from DB.
 */
export const initFuelMappings = async () => {
  try {
    // 1. Load from cache first for immediate availability
    const cached = await AsyncStorage.getItem(CACHE_KEY)
    if (cached) {
      Object.assign(FUEL_BRAND_MAP, JSON.parse(cached))
    }

    // 2. Fetch fresh data from Supabase
    const { data, error } = await supabase
      .from('fuel_brand_configs')
      .select('brand_name, regular_gas_label, premium_gas_label, sports_gas_label, regular_diesel_label, premium_diesel_label')

    if (error) throw error

    // 3. Transform to the original Record format
    const freshMappings = data.reduce((acc, curr) => {
      acc[curr.brand_name] = {
        regular_gas: curr.regular_gas_label ?? undefined,
        premium_gas: curr.premium_gas_label ?? undefined,
        sports_gas: curr.sports_gas_label ?? undefined,
        regular_diesel: curr.regular_diesel_label ?? undefined,
        premium_diesel: curr.premium_diesel_label ?? undefined,
      }
      return acc
    }, {} as Record<string, FuelBrandConfig>)

    // 4. Update the exported object reference and Cache
    Object.assign(FUEL_BRAND_MAP, freshMappings)
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(freshMappings))
    
    return FUEL_BRAND_MAP
  } catch (e) {
    console.error("Error syncing fuel mappings:", e)
    return FUEL_BRAND_MAP
  }
}