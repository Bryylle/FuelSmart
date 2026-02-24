import React, { useMemo } from "react"
import {
  Modal,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  TextStyle,
  ViewStyle,
  ActivityIndicator,
} from "react-native"
import { Text } from "./Text"
import { Icon } from "./Icon"
import { colors } from "../theme/colors"
import { spacing } from "../theme/spacing"

interface MunicipalityListModalProps {
  isVisible: boolean
  onClose: () => void
  searchQuery: string
  onSearchChange: (text: string) => void
  options: any[] // The PSGC data array
  onSelect: (muniName: string) => void
  isLoading?: boolean
}

export const MunicipalityListModal = (props: MunicipalityListModalProps) => {
  const { isVisible, onClose, searchQuery, onSearchChange, options, onSelect, isLoading } = props

  // Match the filtered logic from your MapScreen but encapsulated here
  const filteredOptions = useMemo(() => {
    if (searchQuery.trim().length < 2) return []
    return options
      .filter((m) => m.name.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 25)
  }, [options, searchQuery])

  return (
    <Modal visible={isVisible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={$modalOverlay}>
        <View style={$modalContent}>
          <View style={$header}>
            <Text weight="bold" size="md" text="Select Municipality" />
            <TouchableOpacity onPress={onClose}>
              <Icon icon="close" size={24} />
            </TouchableOpacity>
          </View>

          {/* Search Bar (Styled like BrandListModal) */}
          <View style={$searchBar}>
            <Icon icon="search" size={20} color="#8E8E93" />
            <TextInput
              style={$input}
              placeholder="Search..."
              value={searchQuery}
              onChangeText={onSearchChange}
              autoFocus
            />
            {isLoading && <ActivityIndicator size="small" color={colors.palette.primary500} />}
          </View>

          {/* List */}
          <ScrollView style={$scrollArea} keyboardShouldPersistTaps="handled">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((m) => (
                <TouchableOpacity
                  key={m.code}
                  style={$optionItem}
                  onPress={() => {
                    onSelect(m.name)
                    onClose()
                  }}
                >
                  <Text text={m.name} style={$textDefault} />
                </TouchableOpacity>
              ))
            ) : (
              <Text
                style={$noResults}
                text={searchQuery.length < 2 ? "Type in and select the location..." : "No result found"}
              />
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const $modalOverlay: ViewStyle = {
  flex: 1,
  backgroundColor: "rgba(0,0,0,0.5)",
  justifyContent: "flex-end",
}

const $modalContent: ViewStyle = {
  backgroundColor: colors.background,
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  height: "75%",
  padding: 20,
}

const $header: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 20,
}

const $searchBar: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: colors.childBackground,
  borderRadius: 6,
  paddingHorizontal: 10,
  marginBottom: 15,
}

const $input: TextStyle = {
  flex: 1,
  height: 45,
  marginLeft: 8,
}

const $scrollArea: ViewStyle = {
  flex: 1,
}

const $optionItem: ViewStyle = {
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "center",
  paddingVertical: 14,
  borderBottomWidth: 1,
  borderBottomColor: colors.palette.neutral200,
}

const $textDefault: TextStyle = {
  color: "#333",
}

const $noResults: TextStyle = {
  textAlign: "center",
  marginTop: 20,
  color: "#8E8E93",
}