import React from "react"
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  TouchableOpacity,
  View,
  PixelRatio,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, { FadeIn } from "react-native-reanimated"
import { formatDistanceToNow } from "date-fns"

import { Text } from "@/components/Text"
import { Icon } from "@/components/Icon"
import { useAppTheme } from "@/theme/context"
import { colors } from "@/theme/colors"
import { spacing } from "@/theme/spacing"
import { $gStyles } from "@/theme/styles"

import { FUEL_BRAND_MAP } from "../utils/fuelMappings" // adjust relative path if needed

const HAIRLINE = 1 / PixelRatio.get()
const CARD_RADIUS = 22

type Contributor = {
  id: string
  full_name: string
  b_show_name: boolean
}

/**
 * Base shape required by the modal.
 * Your MapScreen Station type has MORE fields; that is OK.
 */
export type StationBase = {
  id: string
  brand: string
  city: string
  updated_at?: string
  isPending?: boolean
  isLoading?: boolean
  fetchError?: boolean
  reporter_id?: string
  verifiers?: string[]
  deniers?: string[]
  last_updated_by?: Contributor
  [key: string]: any
}

type Props<T extends StationBase> = {
  selectedStation: T | null
  setSelectedStation: React.Dispatch<React.SetStateAction<T | null>>
  isReporting: boolean
  setIsReporting: React.Dispatch<React.SetStateAction<boolean>>
  favorites: string[]
  toggleFavorite: () => void
  handleUpdatePrice: () => void
  priceInputsRef: React.MutableRefObject<Record<string, string>>
  showDirections: () => void
  onOpenContributor: (id: string) => void
  // matches your legacy signature exactly
  getDisplayName: (fullName: string | undefined, bShowName: boolean) => string
  loggedInUserId?: string | null
  hasVoted: boolean
  handleVerifyOrDenyPendingMarker: (reportId: string, isConfirm: boolean) => void
  handleCancelMyReport: (reportId: string) => void
}

export function StationDetailModal<T extends StationBase>({
  selectedStation,
  setSelectedStation,
  isReporting,
  setIsReporting,
  favorites,
  toggleFavorite,
  handleUpdatePrice,
  priceInputsRef,
  showDirections,
  onOpenContributor,
  getDisplayName,
  loggedInUserId,
  hasVoted,
  handleVerifyOrDenyPendingMarker,
  handleCancelMyReport,
}: Props<T>) {
  const { themed } = useAppTheme()
  const insets = useSafeAreaInsets()

  // ✅ keep only 20px gap above native navigation area
  const bottomGap = insets.bottom + 20

  // ✅ Fix for the persistent bottom gap:
  // Using behavior="height" on Android can leave the parent height reduced after the keyboard closes.
  // Switching Android to "padding" avoids the phantom gap while still keeping inputs visible.
  const kavBehavior = Platform.OS === "ios" ? "padding" : "padding"
  const kavOffset = Platform.OS === "ios" ? insets.top : 0

  // ✅ Track keyboard so we can tighten bottom padding when keyboard is open
  const [keyboardVisible, setKeyboardVisible] = React.useState(false)
  React.useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardVisible(true),
    )
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardVisible(false),
    )

    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  // When keyboard is visible, don't add large bottom padding (prevents huge blank area).
  const contentBottomPadding = keyboardVisible ? 12 : bottomGap

  const closeModal = React.useCallback(() => {
    setSelectedStation(null)
    setIsReporting(false)
  }, [setIsReporting, setSelectedStation])

  return (
    <Modal
      visible={!!selectedStation}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={() => !isReporting && setSelectedStation(null)}
    >
      <KeyboardAvoidingView
        behavior={kavBehavior}
        keyboardVerticalOffset={kavOffset}
        style={styles.flex}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => !isReporting && setSelectedStation(null)}
          />

          {selectedStation && (
            <Animated.View entering={FadeIn} style={styles.detailCard}>
              {/* Handle area (tap to close) + caret-down icon */}
              <TouchableOpacity
                onPress={closeModal}
                activeOpacity={0.85}
                style={styles.dismissHandle}
              >
                <Icon icon="caret_down" size={22} color="white" />
              </TouchableOpacity>

              {/* Content */}
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                nestedScrollEnabled
                contentContainerStyle={[
                  styles.scrollContent,
                  { paddingBottom: contentBottomPadding },
                ]}
              >
                {/* Header row: Left (2 rows of text) + Right (favorite button area) */}
                <View style={styles.headerRow}>
                  <View style={styles.headerLeft}>
                    {/* Row 1 */}
                    <Text
                      weight="bold"
                      size="md"
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={styles.brandText}
                    >
                      {selectedStation.brand}
                    </Text>

                    {/* Row 2 (one line only): city + time + by name */}
                    {(() => {
                      const timePart = selectedStation.updated_at
                        ? " • " +
                          formatDistanceToNow(new Date(selectedStation.updated_at), {
                            addSuffix: true,
                          })
                        : " • Recent"

                      const byName = selectedStation.last_updated_by
                        ? getDisplayName(
                            selectedStation.last_updated_by.full_name,
                            !!selectedStation.last_updated_by.b_show_name,
                          )
                        : selectedStation.isPending
                          ? "User Report"
                          : "System"

                      const byId = selectedStation.last_updated_by?.id

                      const MetaLine = (
                        <Text
                          size="sm"
                          style={[styles.opacity_half, styles.metaLine]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {selectedStation.city}
                          {timePart}
                          <RNText style={styles.byInlineText}>{"  by " + byName}</RNText>
                        </Text>
                      )

                      return byId ? (
                        <TouchableOpacity
                          onPress={() => onOpenContributor(byId)}
                          activeOpacity={0.85}
                          style={styles.metaTouchArea}
                        >
                          {MetaLine}
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.metaTouchArea}>{MetaLine}</View>
                      )
                    })()}
                  </View>

                  {/* Right: Favorite star (hidden for pending) */}
                  <View style={styles.headerRight}>
                    {!selectedStation.isPending && (
                      <TouchableOpacity
                        onPress={toggleFavorite}
                        style={[
                          styles.favoriteBtn,
                          selectedStation.fetchError && styles.opacity_half,
                        ]}
                        disabled={!!selectedStation.fetchError}
                        hitSlop={10}
                      >
                        <Icon
                          icon="star"
                          color={
                            favorites.includes(selectedStation.id)
                              ? colors.palette.primary500
                              : "#D1D1D6"
                          }
                          size={32}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Pending Station UI */}
                {selectedStation.isPending ? (
                  <View style={styles.mt_12}>
                    <View style={styles.inline_034}>
                      <Text
                        text="User Reported Location"
                        size="xs"
                        weight="bold"
                        style={styles.inline_035}
                      />
                      <Text
                        text="Is this station real? Help verify it for the community."
                        size="xxs"
                        style={styles.inline_035}
                      />
                      <View style={styles.inline_036}>
                        {[
                          "regular_gas_name",
                          "premium_gas_name",
                          "sports_gas_name",
                          "regular_diesel_name",
                          "premium_diesel_name",
                        ].map((key) =>
                          selectedStation[key] ? (
                            <View key={key} style={styles.fuelTag}>
                              <Text
                                text={selectedStation[key]}
                                size="xxs"
                                weight="bold"
                                style={styles.inline_015}
                              />
                            </View>
                          ) : null,
                        )}
                      </View>
                    </View>

                    {/* If user owns this report */}
                    {loggedInUserId && loggedInUserId === selectedStation.reporter_id ? (
                      <View style={styles.inline_037}>
                        <View style={styles.inline_038}>
                          <Text
                            text="Waiting for others to verify your report..."
                            size="xs"
                            style={styles.opacity_half}
                          />
                        </View>
                        <TouchableOpacity
                          style={[styles.pendingFormBtns, styles.inline_039]}
                          onPress={() => handleCancelMyReport(selectedStation.id)}
                        >
                          <Text text="Cancel My Report" style={styles.inline_040} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={styles.inline_041}>
                        {hasVoted ? (
                          <View style={styles.inline_038}>
                            <Text
                              text="Your confirmation has been saved"
                              size="xs"
                              style={styles.opacity_half}
                            />
                          </View>
                        ) : (
                          <View style={styles.inline_042}>
                            <TouchableOpacity
                              style={[styles.pendingFormBtns, styles.inline_043]}
                              onPress={() =>
                                handleVerifyOrDenyPendingMarker(selectedStation.id, false)
                              }
                            >
                              <Text style={styles.inline_044}>Deny</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.pendingFormBtns, styles.inline_045]}
                              onPress={() =>
                                handleVerifyOrDenyPendingMarker(selectedStation.id, true)
                              }
                            >
                              <Text style={styles.inline_044}>Confirm</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                ) : (
                  /* Regular Station Price UI */
                  <View style={themed(styles.priceDashboard)}>
                    {selectedStation.isLoading ? (
                      <View style={styles.inline_046}>
                        <ActivityIndicator size="large" color={colors.palette.primary500} />
                        <Text size="sm" style={styles.inline_047}>
                          Loading latest prices...
                        </Text>
                      </View>
                    ) : selectedStation.fetchError ? (
                      <View style={styles.inline_048}>
                        <Icon icon="information" color={colors.palette.angry500} size={40} />
                        <Text
                          style={styles.inline_049}
                          text="Sorry, there is a problem in this location."
                        />
                      </View>
                    ) : (
                      // ✅ Reverted: no internal scroll in the price area.
                      // The grid expands naturally so fuel types are visible together.
                      <View style={styles.scrollPriceGrid}>
                        <View style={styles.priceGridContainer}>
                          {(() => {
                            const fuel_types_config = FUEL_BRAND_MAP[selectedStation.brand] ?? {}

                            return Object.keys(fuel_types_config).map((key) => {
                              if (!fuel_types_config[key]) return null

                              return (
                                <View key={key} style={styles.inline_050}>
                                  <Text
                                    style={styles.fuelTypeLabel}
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    minimumFontScale={0.7}
                                  >
                                    {fuel_types_config[key]}
                                  </Text>

                                  {isReporting ? (
                                    <TextInput
                                      style={styles.priceInput}
                                      keyboardType="decimal-pad"
                                      defaultValue=""
                                      placeholder="00.00"
                                      onChangeText={(val) => {
                                        const cleaned = val
                                          .replace(/,/g, ".")
                                          .replace(/[^0-9.]/g, "")
                                          .replace(/(\..*)\./g, "$1")

                                        priceInputsRef.current[key] = cleaned
                                      }}
                                      maxLength={5}
                                    />
                                  ) : (
                                    <Text style={styles.fuelTypePrice}>
                                      ₱{(Number(selectedStation[key]) || 0).toFixed(2)}
                                    </Text>
                                  )}
                                </View>
                              )
                            })
                          })()}
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Bottom buttons */}
                {!selectedStation.isPending && !selectedStation.isLoading && (
                  <View style={styles.stationDetailBtnWrapper}>
                    <View style={styles.stationDetailBtnRow}>
                      {isReporting ? (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.pendingFormBtns,
                              { backgroundColor: colors.childBackground },
                            ]}
                            onPress={() => setIsReporting(false)}
                          >
                            <Text style={styles.cancelText}>Cancel</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[styles.pendingFormBtns, styles.bgPrimary500]}
                            onPress={handleUpdatePrice}
                          >
                            <Text style={{ color: "white", fontWeight: "bold" }}>Submit</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[
                              styles.pendingFormBtns,
                              { backgroundColor: colors.palette.primary400 },
                              selectedStation.fetchError && styles.inline_052,
                            ]}
                            disabled={!!selectedStation.fetchError}
                            onPress={showDirections}
                          >
                            <Text style={{ color: "white", fontWeight: "bold" }}>Directions</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.pendingFormBtns,
                              styles.bgPrimary500,
                              selectedStation.fetchError && styles.inline_052,
                            ]}
                            disabled={!!selectedStation.fetchError}
                            onPress={() => setIsReporting(true)}
                          >
                            <Text style={{ color: "white", fontWeight: "bold" }}>Update Price</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },

  detailCard: {
    backgroundColor: colors.background,
    minHeight: 350,
    borderTopLeftRadius: CARD_RADIUS,
    borderTopRightRadius: CARD_RADIUS,
    overflow: "hidden", // ✅ prevents curved border overlap
  },

  dismissHandle: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: colors.palette.neutral600,
    gap: 6,
  },

  grabber: {
    width: 44,
    height: HAIRLINE * 3,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.55)",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    flexGrow: 1,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    width: "100%",
    gap: 10,
  },

  headerLeft: {
    flex: 1,
    minWidth: 0,
  },

  headerRight: {
    flexShrink: 0,
    alignItems: "flex-end",
    justifyContent: "flex-start",
    paddingTop: 2,
  },

  brandText: {
    marginRight: spacing.sm,
  },

  metaTouchArea: {
    marginTop: 4,
    minWidth: 0,
  },

  metaLine: {
    minWidth: 0,
  },

  byInlineText: {
    fontWeight: "700",
    color: colors.palette.primary500,
  },

  favoriteBtn: { padding: 8 },

  priceDashboard: {
    backgroundColor: colors.childBackground,
    borderRadius: $gStyles.subCardBorderRadius,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.palette.neutral200,
  },

  // Reused name, now just acts like padding around the grid
  scrollPriceGrid: {
    paddingVertical: 14,
    paddingHorizontal: 8,
  },

  priceGridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 16,
  },

  fuelTypeLabel: { color: "#8E8E93", fontSize: 14, fontWeight: "600" },
  fuelTypePrice: { color: "#1C1C1E", fontSize: 16, fontWeight: "700" },

  priceInput: {
    color: colors.palette.primary400,
    fontSize: 13,
    fontWeight: "700",
    borderBottomWidth: 1,
    borderBottomColor: colors.palette.primary500,
    textAlign: "center",
    minWidth: 50,
  },

  stationDetailBtnWrapper: { paddingTop: 16 },
  stationDetailBtnRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },

  pendingFormBtns: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: $gStyles.buttonBorderRadius,
    alignItems: "center",
  },

  cancelText: { color: "#666", fontWeight: "600" },
  mt_12: { marginTop: 12 },
  opacity_half: { opacity: 0.5 },
  bgPrimary500: { backgroundColor: colors.palette.primary500 },

  inline_015: { color: colors.palette.primary400 },

  inline_034: {
    backgroundColor: "#FFF9E6",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFE58F",
  },
  inline_035: { color: "#856404" },
  inline_036: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },

  fuelTag: {
    backgroundColor: "white",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.palette.primary500,
  },

  inline_037: { marginTop: 10, gap: 10 },
  inline_038: {
    alignItems: "center",
    padding: 10,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
    justifyContent: "flex-start",
  },
  inline_039: {
    backgroundColor: colors.palette.angry500,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    minHeight: 45,
  },
  inline_040: { color: "#FFFFFF", fontWeight: "bold" },
  inline_041: { gap: 10, marginTop: 10 },
  inline_042: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  inline_043: { flex: 1, backgroundColor: colors.palette.secondary500 },
  inline_044: { textAlign: "center", color: "white", fontWeight: "bold" },
  inline_045: { flex: 1, backgroundColor: colors.palette.primary500 },

  inline_046: { flex: 1, justifyContent: "center", alignItems: "center" },
  inline_047: { marginTop: 8, opacity: 0.5 },
  inline_048: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  inline_049: { textAlign: "center", marginTop: 10, color: colors.palette.angry500 },
  inline_050: { width: "33.33%", alignItems: "center" },
  inline_052: { opacity: 0.5, backgroundColor: "#ccc" },
})
