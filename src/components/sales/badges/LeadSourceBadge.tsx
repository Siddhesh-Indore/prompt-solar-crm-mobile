// src/components/sales/badges/LeadSourceBadge.tsx
import { View, Text, StyleSheet } from 'react-native'
import type { LeadSource } from '@/types/sales'

const SOURCE_LABEL: Record<LeadSource, string> = {
  meta: 'Meta Ads',
  google: 'Google Ads',
  website: 'Website',
  cold_call: 'Cold Call',
  owner_ref: 'Owner Ref',
  employee_ref: 'Employee Ref',
  manual: 'Manual',
}

const SOURCE_COLORS: Record<LeadSource, { bg: string; text: string; border: string }> = {
  meta: { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
  google: { bg: '#fee2e2', text: '#b91c1c', border: '#fecaca' },
  website: { bg: '#d1fae5', text: '#047857', border: '#a7f3d0' },
  cold_call: { bg: '#e0e7ff', text: '#4338ca', border: '#c7d2fe' },
  owner_ref: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
  employee_ref: { bg: '#ffedd5', text: '#c2410c', border: '#fed7aa' },
  manual: { bg: '#f1f5f9', text: '#334155', border: '#e2e8f0' },
}

export default function LeadSourceBadge({ source }: { source: LeadSource }) {
  const c = SOURCE_COLORS[source]
  return (
    <View style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.text, { color: c.text }]}>{SOURCE_LABEL[source]}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  text: { fontSize: 11, fontWeight: '600' },
})
