// src/components/ui/SearchBar.tsx
// Small search field with a clear button — used on the Visits screens.
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { brand } from '@/constants/brand'

interface Props {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
}

export default function SearchBar({ value, onChangeText, placeholder = 'Search by name or phone number' }: Props) {
  return (
    <View style={styles.wrap}>
      <Ionicons name="search" size={16} color={brand.faint} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={brand.faint}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} hitSlop={10} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color={brand.faint} />
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 4, marginBottom: 10, paddingHorizontal: 12, height: 42, borderRadius: 12, borderWidth: 1, borderColor: brand.border, backgroundColor: '#fff' },
  input: { flex: 1, fontSize: 14, color: brand.ink, paddingVertical: 0 },
})
