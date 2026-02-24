import React, { useMemo, useState, useEffect } from "react"
import {
  Modal,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  TextStyle,
  ViewStyle,
} from "react-native"
import { Text } from "./Text"
import { Icon } from "./Icon"
import { colors } from "../theme/colors"

interface BrandListModalProps {
  isVisible: boolean
  onClose: () => void
  headerText: string
  options: string[]
  selectedValues: string | string[]
  onSelect: (value: string | string[]) => void
  searchQuery: string
  onSearchChange: (text: string) => void
  placeholder?: string
  singleSelect?: boolean // TRUE: RADIO | FALSE: CHECKBOX
  upperRightIcon?: boolean
}

export const BrandListModal = (props: BrandListModalProps) => {
  const {
    isVisible,
    onClose,
    headerText,
    options,
    selectedValues,
    onSelect,
    searchQuery,
    onSearchChange,
    placeholder = "Search...",
    singleSelect = false,
    upperRightIcon = false,
  } = props

  const [tempSelected, setTempSelected] = useState<string[]>([])

  useEffect(() => {
    if (isVisible && !singleSelect) {
      setTempSelected(Array.isArray(selectedValues) ? [...selectedValues] : [])
    }
  }, [isVisible, selectedValues, singleSelect])

  const filteredOptions = useMemo(() => {
    // 1. Get the standard filtered list, but EXCLUDE any strings that 
    // look like the "Add..." label you want to remove.
    const filtered = options.filter((opt) =>
      opt.toLowerCase().includes(searchQuery.toLowerCase()) && 
      !opt.toLowerCase().startsWith("add") // This removes the red-circled item
    )

    if (!searchQuery) return options

    if (singleSelect) {
      const exactMatch = options.some(o => o.toLowerCase() === searchQuery.toLowerCase())
      
      if (!exactMatch) {
        // Prepend the raw searchQuery. 
        // The .map() logic below will handle adding the "(Add New)" suffix.
        const otherMatches = filtered.filter(opt => opt.toLowerCase() !== searchQuery.toLowerCase())
        return [searchQuery, ...otherMatches]
      }
    }
    
    return filtered
  }, [options, searchQuery, singleSelect])

  const handleItemPress = (item: string) => {
    if (singleSelect) {
      onSelect(item)
    } else {
      setTempSelected(prev =>
        prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
      )
    }
  }

  const isSelected = (item: string) => {
    if (singleSelect) return selectedValues === item
    return tempSelected.includes(item)
  }

  const handleSelectAll = () => {
    // Select All logic: Only toggle the items currently visible in the search
    const allFilteredSelected = filteredOptions.every(opt => tempSelected.includes(opt))
    
    if (allFilteredSelected) {
      // Unselect only the currently visible filtered items
      setTempSelected(prev => prev.filter(item => !filteredOptions.includes(item)))
    } else {
      // Add all visible filtered items to selection
      setTempSelected(prev => Array.from(new Set([...prev, ...filteredOptions])))
    }
  }

  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text weight="bold">{headerText}</Text>
            <View style={styles.headerRight}>
              {!singleSelect && filteredOptions.length > 0 && (
                <TouchableOpacity style={styles.selectAllRow} onPress={handleSelectAll}>
                  <Text size="xs" style={styles.selectAllText}>Select All</Text>
                  <View style={[
                    styles.checkbox, 
                    filteredOptions.every(opt => tempSelected.includes(opt)) && styles.checkboxActive
                  ]}>
                    {filteredOptions.every(opt => tempSelected.includes(opt)) && <Icon icon="check" size={10} color="white" />}
                  </View>
                </TouchableOpacity>
              )}
              {upperRightIcon && (
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Icon icon="close" size={24} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Search Input */}
          <View style={styles.searchBar}>
            <Icon icon="search" size={20} color="#8E8E93" />
            <TextInput
              style={styles.input}
              placeholder={placeholder}
              value={searchQuery}
              onChangeText={onSearchChange}
              autoCapitalize="words"
              maxLength={32}
            />
          </View>

          {/* List */}
          <ScrollView style={styles.scrollArea} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {filteredOptions.map((opt) => {
              const active = isSelected(opt)
              // If it's a custom entry (not in the original list)
              const isNew = singleSelect && searchQuery.length > 0 && !options.includes(opt)

              return (
                <TouchableOpacity key={opt} style={styles.optionItem} onPress={() => handleItemPress(opt)}>
                  <Text style={active ? styles.textActive : styles.textDefault}>
                    {opt} {isNew ? "(Add New)" : ""}
                  </Text>
                  {singleSelect ? (
                    active && <Icon icon="check" size={20} color={colors.palette.primary500} />
                  ) : (
                    <View style={[styles.checkbox, active && styles.checkboxActive]}>
                      {active && <Icon icon="check" size={10} color="white" />}
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
            {filteredOptions.length === 0 && (
              <Text style={styles.noResults}>No results found</Text>
            )}
          </ScrollView>

          {/* Footer (Only for Multi-Select) */}
          {!singleSelect && (
            <View style={styles.footer}>
              <TouchableOpacity style={[styles.button, styles.cancelBtn]} onPress={onClose}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.button, styles.applyBtn]} 
                onPress={() => onSelect(tempSelected)}
              >
                <Text style={styles.applyText}>Apply</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" } as ViewStyle,
  content: { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: "75%", padding: 20 } as ViewStyle,
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 15 } as ViewStyle,
  headerRight: { flexDirection: "row", alignItems: "center" } as ViewStyle,
  closeBtn: { marginLeft: 10 } as ViewStyle,
  selectAllRow: { flexDirection: "row", alignItems: "center" } as ViewStyle,
  selectAllText: { marginRight: 8, color: colors.palette.neutral900, fontWeight: "600" } as TextStyle,
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: colors.childBackground, borderRadius: 6, paddingHorizontal: 10, marginBottom: 15 } as ViewStyle,
  input: { flex: 1, height: 45, marginLeft: 8 } as TextStyle,
  scrollArea: { flex: 1 } as ViewStyle,
  optionItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.palette.neutral200 } as ViewStyle,
  textDefault: { color: "#333" } as TextStyle,
  textActive: { color: colors.palette.primary500, fontWeight: "600" } as TextStyle,
  noResults: { textAlign: "center", marginTop: 20, color: "#8E8E93" } as TextStyle,
  checkbox: { width: 20, height: 20, borderWidth: 2, borderColor: colors.palette.primary400, borderRadius: 4, justifyContent: "center", alignItems: "center" } as ViewStyle,
  checkboxActive: { backgroundColor: colors.palette.primary400 },
  footer: { flexDirection: "row", marginTop: 15, gap: 10 } as ViewStyle,
  button: { flex: 1, height: 45, borderRadius: 8, justifyContent: "center", alignItems: "center" } as ViewStyle,
  cancelBtn: { backgroundColor: colors.palette.neutral200 },
  applyBtn: { backgroundColor: colors.palette.primary500 },
  cancelText: { color: "#666", fontWeight: "600" } as TextStyle,
  applyText: { color: "white", fontWeight: "600" } as TextStyle,
})