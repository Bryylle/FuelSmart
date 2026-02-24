import React, { useEffect, useState, useRef } from "react"
import {
  Modal,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Image,
  Alert,
  Animated,
  StyleSheet,
} from "react-native"
import * as Clipboard from "expo-clipboard"
import { Text } from "@/components/Text"
import { Icon } from "@/components/Icon" // Added missing import for Icon
import { colors } from "@/theme/colors"
import { spacing } from "@/theme/spacing"
import { supabase } from "@/services/supabase"
import Reanimated, { FadeIn } from "react-native-reanimated"

// Assets precisely as referenced in your MapScreen
const ICON_MEDAL_GOLD = require("@assets/icons/download/medal_gold.png")
const ICON_MEDAL_SILVER = require("@assets/icons/download/medal_silver.png")
const ICON_MEDAL_BRONZE = require("@assets/icons/download/medal_bronze.png")
const GCashLogo = require("@assets/icons/gcash.svg").default
const MayaLogo = require("@assets/icons/maya.svg").default

interface Contributor {
  id: string
  full_name: string
  phone: string
  b_show_name: boolean
  b_show_gcash: boolean
  b_show_maya: boolean
  no_contributions: number
  no_incorrect_reports: number
}

interface ContributorModalProps {
  isVisible: boolean
  contributorId: string | null
  onClose: () => void
}

export const ContributorModal = ({ isVisible, contributorId, onClose }: ContributorModalProps) => {
  const [loading, setLoading] = useState(false)
  const [currentContributor, setCurrentContributor] = useState<Contributor | null>(null)
  
  const userCardAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (isVisible && contributorId) {
      Animated.spring(userCardAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start()
      loadContributorProfile(contributorId)
    } else {
      userCardAnim.setValue(0)
      setCurrentContributor(null)
    }
  }, [isVisible, contributorId])

  const loadContributorProfile = async (id: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("users")
        .select(`id, phone, full_name, no_contributions, no_incorrect_reports, b_show_name, b_show_gcash, b_show_maya`)
        .eq("id", id)
        .single()

      if (error) throw error
      setCurrentContributor(data as unknown as Contributor)
    } catch (e) {
      console.error("Lazy load failed:", e)
      Alert.alert("Error", "Could not load contributor profile.")
      onClose()
    } finally {
      setLoading(false)
    }
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

  return (
    <Modal 
        visible={isVisible} 
        transparent 
        animationType="fade" 
        onRequestClose={onClose}
        style={styles.inline_053}
      >
        <TouchableOpacity style={styles.brandModalOverlay} activeOpacity={1} onPress={onClose}>
          <View style={styles.userInfoCard}>
            {!currentContributor ? (
              <View style={styles.inline_054}>
                <ActivityIndicator size="large" color={colors.palette.primary500} />
                <Text text="Loading profile..." style={styles.inline_055} />
              </View>
            ) : (
              <Reanimated.View entering={FadeIn}>
                <View style={styles.profileHeader}>
                  <View style={styles.avatarCircle}>
                    <Text 
                      style={styles.avatarText} 
                      text={currentContributor?.full_name?.substring(0,1)?.toUpperCase() || ""} 
                      size="xl" 
                      weight="bold" 
                    />
                  </View>
                  <View style={styles.nameContainer}>
                    <View style={styles.tierRow}>
                      <Text 
                        preset="subheading" 
                        weight="bold" 
                        style={styles.inline_056} 
                        numberOfLines={1}
                        size="md"
                      >
                        {getDisplayName(currentContributor?.full_name, currentContributor?.b_show_name ?? true)}
                      </Text>
                      <Image
                        source={
                          currentContributor?.no_contributions < 50 ? ICON_MEDAL_BRONZE :
                          currentContributor?.no_contributions < 100 ? ICON_MEDAL_SILVER :
                          ICON_MEDAL_GOLD
                        } 
                        style={styles.inline_057} resizeMode="contain"
                      />
                    </View>
                    <Text style={styles.inline_058} size="xs">
                      {
                        currentContributor?.no_contributions < 50 ? "BRONZE CONTRIBUTOR" :
                        currentContributor?.no_contributions < 100 ? "SILVER CONTRIBUTOR" :
                        "GOLD CONTRIBUTOR"
                      }
                    </Text>
                  </View>
                </View>

                <View style={styles.contributorStatsRow}>
                  <View style={styles.contributorStatBox}>
                    <Text weight="bold" style={styles.statValue}>{currentContributor?.no_contributions || 0}</Text>
                    <Text size="xxs" style={styles.statLabel}>CONTRIBUTIONS</Text>
                  </View>
                  <View style={styles.contributorStatBox}>
                    <Text weight="bold" style={styles.statValue}>{currentContributor?.no_incorrect_reports || 0}</Text>
                    <Text size="xxs" style={styles.statLabel}>INCORRECT REPORTS</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.contributorPaymentContainer} onPress={() => handleCopyNumber(currentContributor?.phone || "")} activeOpacity={0.5}>
                  {(currentContributor?.b_show_gcash || currentContributor?.b_show_maya) && currentContributor?.phone && (
                    <View style={styles.contributorPaymentCard}>
                      <View style={styles.contributorCardTopRow}>
                          <Text size="xxs" weight="bold" style={styles.inline_059}>
                            TIP VIA
                          </Text>
                        <Icon icon="copy" size={20} color={colors.palette.neutral400} />
                      </View>

                      <View style={styles.contributorCardBottomRow}>
                        <View style={styles.contributorWalletGroup}>
                            {currentContributor?.b_show_gcash && (
                              <View style={styles.contributorWalletWrapper}>
                                <GCashLogo width={32} height={20} />
                              </View>
                            )}
                            {currentContributor?.b_show_maya && (
                              <View style={styles.contributorWalletWrapper}>
                                <MayaLogo width={32} height={20} />
                              </View>
                            )}
                          </View>
                        <Text weight="semiBold" style={styles.contributorPhoneNumber}>
                          {currentContributor?.phone}
                        </Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              </Reanimated.View>
            )}

            <TouchableOpacity style={[styles.closeBtn, styles.mt_12]} onPress={onClose}>
              <Text style={styles.inline_060}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
  )
}

const styles = StyleSheet.create({
  brandModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  userInfoCard: {
    width: "85%",
    backgroundColor: "white",
    borderRadius: 16,
    padding: spacing.lg,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  profileHeader: { flexDirection: "row", alignItems: "center", marginBottom: spacing.md },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.palette.primary100,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  avatarText: { color: colors.palette.primary500 },
  nameContainer: { flex: 1 },
  inline_053: { zIndex: 8 },
  inline_054: { padding: spacing.xl, alignItems: "center" },
  inline_055: { marginTop: spacing.sm, opacity: 0.5 },
  inline_056: { flex: 1 },
  inline_057: { width: 40, height: 40 },
  inline_058: { opacity: 0.5, marginTop: -4 },
  inline_059: { color: colors.palette.neutral500 },
  inline_060: { color: colors.palette.primary500, fontWeight: "bold" },
  contributorStatsRow: {
    flexDirection: "row",
    backgroundColor: colors.palette.neutral100,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  contributorStatBox: { flex: 1, alignItems: "center" },
  statValue: { color: colors.palette.primary500, fontSize: 18 },
  statLabel: { opacity: 0.6, marginTop: 2 },
  tierRow: { flexDirection: "row", alignItems: "center" },
  contributorPaymentContainer: { marginTop: spacing.xs },
  contributorPaymentCard: {
    backgroundColor: colors.palette.neutral100,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.palette.neutral200,
  },
  contributorCardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  contributorCardBottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  contributorWalletGroup: { flexDirection: "row", gap: spacing.xs },
  contributorWalletWrapper: { backgroundColor: "white", padding: 4, borderRadius: 4 },
  contributorPhoneNumber: { color: colors.palette.neutral900 },
  closeBtn: { padding: spacing.md, alignItems: "center" },
  mt_12: { marginTop: 12 },
})