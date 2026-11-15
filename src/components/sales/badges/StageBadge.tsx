// src/components/sales/badges/StageBadge.tsx
import { View, Text, StyleSheet } from 'react-native'
import type { LeadStage } from '@/types/sales'
import { brand } from '@/constants/brand'

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
  calling: { bg: brand.infoSoft, text: brand.info, border: '#bfdbfe' },
  visit_fixed: { bg: brand.warningSoft, text: brand.warning, border: brand.warningBorder },
  visited: { bg: brand.violetSoft, text: brand.violet, border: '#ddd6fe' },
  converted: { bg: brand.greenSoft, text: brand.greenDark, border: brand.greenBorder },
  not_qualified: { bg: brand.surfaceAlt, text: brand.muted, border: brand.borderLight },
  lost: { bg: brand.dangerSoft, text: brand.danger, border: brand.dangerBorder },
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
