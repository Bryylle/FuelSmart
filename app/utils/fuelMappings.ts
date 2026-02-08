export interface FuelBrandConfig {
  regular_gas?: string
  premium_gas?: string
  sports_gas?: string
  regular_diesel?: string
  premium_diesel?: string
  [key: string]: string | undefined 
}

export const FUEL_BRAND_MAP: Record<string, FuelBrandConfig> = {
  "Shell": {
    regular_gas: "FuelSave 91",
    premium_gas: "FuelSave 95",
    sports_gas: "V-Power Racing",
    regular_diesel: "Shell FuelSave Diesel",
    premium_diesel: "Shell V-Power Diesel",
  },
  "Petron": {
    regular_gas: "Xtra Advance",
    premium_gas: "XCS",
    sports_gas: "Blaze 100",
    regular_diesel: "Diesel Max",
    premium_diesel: "Turbo Diesel",
  },
  "Caltex": {
    regular_gas: "Silver",
    premium_gas: "Platinum",
    regular_diesel: "Diesel",
  },
  "SeaOil": {
    regular_gas: "Extreme U",
    premium_gas: "Extreme 95",
    regular_diesel: "Exceed Diesel",
  },
  "Phoenix": {
    regular_gas: "Super",
    premium_gas: "Premium",
    sports_gas: "Premium 98",
    regular_diesel: "Diesel",
  },
  "Jetti": {
    regular_gas: "Accelrate",
    premium_gas: "XPremium",
    regular_diesel: "Diesel",
  },
  "Flying V": {
    regular_gas: "Volt",
    premium_gas: "Thunder",
    sports_gas: "DeciVel", // ??
    regular_diesel: "Diesel",
  },
  "PTT": {
    regular_gas: "Eco+ Gasoline",
    premium_gas: "Power+ Gasoline",
    regular_diesel: "Save+ Diesel",
  },
  "IFuel": {
    regular_gas: "iGas 91",
    premium_gas: "iGaz 95",
    regular_diesel: "Diesel",
  },
  "Orient Fuel": {
    regular_gas: "Eco Gas",
    premium_gas: "Superior",
    regular_diesel: "Diesel",
  },
  "Star Oil": {
    regular_gas: "Super 93",
    premium_gas: "Premium",
    regular_diesel: "Diesel",
  },
  "Diatoms Fuel": {
    regular_gas: "Regular",
    premium_gas: "Premium",
    regular_diesel: "Diesel",
  },
  "1st Auto Gas": {
    regular_gas: "Regular",
    premium_gas: "Premium",
    regular_diesel: "Diesel",
  },
  "BLU ENERGY": {
    regular_gas: "Regular",
    premium_gas: "Premium",
    regular_diesel: "Diesel",
  },
  "C3 Fuels brand": {
    regular_gas: "Regular",
    premium_gas: "Premium",
    regular_diesel: "Diesel",
  },
  "Drelex": {
    regular_gas: "Regular",
    premium_gas: "Premium",
    regular_diesel: "Diesel",
  },
  "FerC Fuels": {
    regular_gas: "Regular",
    premium_gas: "Premium",
    regular_diesel: "Diesel",
  },
  "Fuel Tech": {
    regular_gas: "Regular",
    premium_gas: "Premium",
    regular_diesel: "Diesel",
  },
  "GSC": {
    regular_gas: "Regular",
    premium_gas: "Premium",
    regular_diesel: "Diesel",
  },
  "LKB": {
    regular_gas: "Regular",
    premium_gas: "Premium",
    regular_diesel: "Diesel",
  },
  "Light Fuels": {
    regular_gas: "Regular",
    premium_gas: "Premium",
    regular_diesel: "Diesel",
  },
  "M-Oil": {
    regular_gas: "Regular",
    premium_gas: "Premium",
    regular_diesel: "Diesel",
  },
  "Tech Fuel": {
    regular_gas: "Regular",
    premium_gas: "Premium",
    regular_diesel: "Diesel",
  },
  "RePhil": {
    regular_gas: "Regular",
    premium_gas: "Premium",
    regular_diesel: "Diesel",
  },
  // "Default": {
  //   regular_gas: "Regular Gas",
  //   premium_gas: "Premium Gas",
  //   sports_gas: "Sports Gas",
  //   regular_diesel: "Regular Diesel",
  //   premium_diesel: "Premium Diesel",
  //   mc_regular_gas: "MC Regular",
  //   mc_premium_gas: "MC Premium",
  // }
}