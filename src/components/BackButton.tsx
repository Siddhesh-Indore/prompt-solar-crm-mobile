// src/components/BackButton.tsx
import { Text, TouchableOpacity, StyleSheet } from 'react-native'
import { brand } from '@/constants/brand'

interface BackButtonProps {
  onPress: () => void
  label?: string
}

export default function BackButton({ onPress, label = 'Back' }: BackButtonProps) {
  return (
    <TouchableOpacity style={styles.button} onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
      <Text style={styles.text}>‹ {label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: brand.border,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  text: { fontSize: 16, color: brand.greenDark, fontWeight: '700' },
})
