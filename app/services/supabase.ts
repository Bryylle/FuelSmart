import "react-native-url-polyfill/auto"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = "https://kdpklpgjrvvronfkyhqk.supabase.co"
const supabaseAnonKey = "sb_publishable_6rg2wSNepj7h-GRxbuCGHA_6C2YudbG"

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})