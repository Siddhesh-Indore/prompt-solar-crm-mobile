// src/components/sales/badges/TemperatureBadge.tsx
import { View, Text, StyleSheet } from 'react-native'
import type { LeadTemperature } from '@/types/sales'

const TEMP_LABEL: Record<LeadTemperature, string> = { hot: '🔥 Hot', warm: '🔥 Warm', cold: '🔥 Cold' }

const TEMP_COLORS: Record<LeadTemperature, { bg: string; text: string; border: string }> = {
  hot: { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' },
  warm: { bg: '#ffedd5', text: '#c2410c', border: '#fed7aa' },
  cold: { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd' },
}

export default function TemperatureBadge({ temperature }: { temperature: LeadTemperature | null }) {
  if (!temperature) return <Text style={styles.dash}>—</Text>
  const c = TEMP_COLORS[temperature]
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.text, { color: c.text }]}>{TEMP_LABEL[temperature]}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  text: { fontSize: 11, fontWeight: '600' },
  dash: { fontSize: 12, color: '#9ca3af' },
})
