// src/components/sales/NeedsAttentionCard.tsx
// Home, for a sales exec: the customers most likely to slip — visits whose
// date has passed, follow-ups nobody has been back to for a week, finalized
// customers still waiting on the intake form — longest-waiting first. A
// sales exec with many leads can't scan the whole board every day; this is the
// short list to start with. Hidden when nothing needs attention.
import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { attentionFor, EMPTY_VISIT_INFO, type Attention, type LeadVisitInfo } from '@/lib/visitBoard'
import { hapticSelect } from '@/lib/haptics'
import type { Lead } from '@/types/sales'
import { brand } from '@/constants/brand'

const COLLAPSED_COUNT = 2

interface Item {
  lead: Lead
  attention: Attention
}

interface Props {
  leads: Lead[]
  infoMap: Map<string, LeadVisitInfo> | undefined
  onOpen: (lead: Lead) => void
}

export default function NeedsAttentionCard({ leads, infoMap, onOpen }: Props) {
  const [expanded, setExpanded] = useState(false)

  const items = useMemo<Item[]>(() => {
    // Without the visit reports every lead would look like it was never visited.
    if (!infoMap) return []
    const out: Item[] = []
    for (const lead of leads) {
      const attention = attentionFor(lead, infoMap.get(lead.id) ?? EMPTY_VISIT_INFO)
      if (attention) out.push({ lead, attention })
    }
    return out.sort((a, b) => b.attention.days - a.attention.days)
  }, [leads, infoMap])

  if (items.length === 0) return null
  const shown = expanded ? items : items.slice(0, COLLAPSED_COUNT)

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="alert-circle" size={18} color={brand.danger} />
        <Text style={styles.title}>Needs attention</Text>
        <View style={styles.count}>
          <Text style={styles.countText}>{items.length}</Text>
        </View>
      </View>

      {shown.map(({ lead, attention }, i) => (
        <View key={lead.id} style={[styles.row, i > 0 && styles.rowDivider]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={0.6} onPress={() => { hapticSelect(); onOpen(lead) }} accessibilityLabel={`${lead.name}. ${attention.label}. Open.`}>
            <Text style={styles.name} numberOfLines={1}>{lead.name}</Text>
            <Text style={[styles.reason, (attention.kind === 'visit_overdue' || attention.kind === 'visit_date_invalid') && styles.reasonOverdue]} numberOfLines={1}>{attention.label}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.callBtn} onPress={() => { hapticSelect(); Linking.openURL(`tel:${lead.phone}`) }} hitSlop={6} accessibilityLabel={`Call ${lead.name}`}>
            <Ionicons name="call-outline" size={18} color={brand.navy} />
          </TouchableOpacity>
        </View>
      ))}

      {items.length > COLLAPSED_COUNT && (
        <TouchableOpacity style={styles.more} onPress={() => { hapticSelect(); setExpanded((e) => !e) }}>
          <Text style={styles.moreText}>{expanded ? 'Show less' : `See more (${items.length - COLLAPSED_COUNT})`}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: brand.dangerBorder, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  title: { fontSize: 15, fontWeight: '700', color: brand.ink, flex: 1 },
  count: { minWidth: 22, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: brand.dangerSoft, alignItems: 'center' },
  countText: { fontSize: 12, fontWeight: '700', color: brand.danger },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  rowDivider: { borderTopWidth: 1, borderTopColor: brand.surfaceAlt },
  name: { fontSize: 14, fontWeight: '600', color: brand.ink },
  reason: { fontSize: 12, color: brand.warning, marginTop: 2 },
  reasonOverdue: { color: brand.danger },
  callBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: brand.navySoft, alignItems: 'center', justifyContent: 'center' },
  more: { alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: brand.surfaceAlt },
  moreText: { fontSize: 12, fontWeight: '700', color: brand.navy },
})
