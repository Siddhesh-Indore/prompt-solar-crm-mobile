// src/components/sales/ChipSelect.tsx
// Single-select chip row — the mobile stand-in for a web <select>.
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { brand } from '@/constants/brand'

interface Option<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  options: Option<T>[]
  value: T | undefined
  onChange: (value: T) => void
}

export default function ChipSelect<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.row}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <TouchableOpacity
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: brand.border, backgroundColor: '#fff' },
  chipActive: { backgroundColor: brand.green, borderColor: brand.green },
  chipText: { fontSize: 13, color: brand.text, fontWeight: '500' },
  chipTextActive: { color: brand.onGreen, fontWeight: '700' },
})
