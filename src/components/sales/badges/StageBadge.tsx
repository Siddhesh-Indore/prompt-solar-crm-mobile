// src/components/sales/badges/StageBadge.tsx
import { View, Text, StyleSheet } from 'react-native'
import type { LeadStage } from '@/types/sales'

const STAGE_LABEL: Record<LeadStage, string> = {
  new: 'New',
  calling: 'Calling',
  visit_fixed: 'Visit Fixed',
  visited: 'Visited',
  converted: 'Won',
  not_qualified: 'Not Qualified',
  lost: 'Lost',
}

const STAGE_COLORS: Record<LeadStage, { bg: string; text: string; border: string }> = {
  new: { bg: '#f1f5f9', text: '#334155', border: '#e2e8f0' },
  calling: { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
  visit_fixed: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
  visited: { bg: '#ede9fe', text: '#6d28d9', border: '#ddd6fe' },
  converted: { bg: '#d1fae5', text: '#047857', border: '#a7f3d0' },
  not_qualified: { bg: '#f3f4f6', text: '#6b7280', border: '#e5e7eb' },
  lost: { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' },
}

export default function StageBadge({ stage }: { stage: LeadStage }) {
  const c = STAGE_COLORS[stage]
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.text, { color: c.text }]}>{STAGE_LABEL[stage]}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  text: { fontSize: 11, fontWeight: '600' },
})
