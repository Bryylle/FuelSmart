const palette = {
  // Neutrals - Grays and Off-whites
  neutral100: "#FFFFFF",
  neutral200: "#F4F2F1",
  neutral300: "#D7CEC9",
  neutral400: "#B6ACA6",
  neutral500: "#978F8A",
  neutral600: "#564E4A",
  neutral700: "#3C3836",
  neutral800: "#191015",
  neutral900: "#000000",

  // Primary - #1737BA (Blue) - 60%
  primary100: "#E8EBF8",
  primary200: "#B9C2E9",
  primary300: "#8A99D9",
  primary400: "#5B70CA",
  primary500: "#1737BA",
  primary600: "#122C95",

  // Secondary - #BA1738 (Red) - 30%
  secondary100: "#F8E8EB",
  secondary200: "#E9B9C2",
  secondary300: "#D98A99",
  secondary400: "#CA5B70",
  secondary500: "#BA1738",
  secondary600: "#95122D",

  // Accent - #38BA17 (Green) - 10%
  accent100: "#EBF8E8",
  accent200: "#C2E9B9",
  accent300: "#99D98A",
  accent400: "#70CA5B",
  accent500: "#38BA17", // Main Accent Green
  accent600: "#2D9512",

  // Error/Angry
  angry100: "#FDE8E8",
  angry500: "#BA1738", // Linked to Secondary Red

  overlay20: "rgba(25, 16, 21, 0.2)",
  overlay50: "rgba(25, 16, 21, 0.5)",
} as const

export const colors = {
  palette,
  transparent: "rgba(0, 0, 0, 0)",

  /**
   * Semantic Colors
   */
  text: palette.neutral800,
  textDim: palette.neutral600,
  background: palette.neutral100,
  border: palette.neutral300,

  // Main brand tinting
  tint: palette.primary500,
  tintInactive: palette.primary200,

  separator: palette.neutral200,

  // Using the Secondary Red for Errors
  error: palette.secondary500,
  errorBackground: palette.secondary100,

  // Success state (Optional semantic addition)
  success: palette.accent500,
} as const