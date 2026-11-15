// src/components/sales/PreviousNotes.tsx
// Everything already written about a customer — the note on the lead itself,
// each telecaller call note and each earlier visit note — shown while filling
// in the next visit report, so the exec carries the full history in and
// nothing earlier is lost from view. Read-only: every visit saves its own
// report row, so earlier notes are never overwritten, just not visible in a
// fresh Notes box. Newest first; the latest few are shown, the rest behind a
// tap.
import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useCallLogs } from '@/hooks/useCallLogs'
import { brand } from '@/constants/brand'
import type { Lead, VisitReport } from '@/types/sales'

const VISIT_OUTCOME_LABEL: Record<string, string> = {
  finalized: 'Finalized', second_visit: 'Second visit', follow_up: 'Follow-up', lost: 'Lost',
}
const CALL_TYPE_LABEL: Record<string, string> = {
  qualification: 'Qualification call', pre_visit: 'Pre-visit call', follow_up: 'Follow-up call', callback: 'Callback',
}

const COLLAPSED_COUNT = 3

interface Entry {
  id: string
  when: string | null
  label: string
  detail: string | null
  text: string
  tone: 'visit' | 'call' | 'lead'
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PreviousNotes({ lead, visits }: { lead: Lead; visits: VisitReport[] }) {
  const { data: callLogs = [] } = useCallLogs(lead.id)
  const [expanded, setExpanded] = useState(false)

  const entries: Entry[] = []

  for (const v of visits) {
    const text = [v.notes, v.next_step ? `Next step: ${v.next_step}` : null].filter(Boolean).join('\n')
    if (!text) continue
    entries.push({
      id: `visit-${v.id}`,
      when: v.visited_at,
      label: `Visit #${v.visit_number}`,
      detail: v.exec?.full_name ?? null,
      text,
      tone: 'visit',
    })
  }
  for (const c of callLogs) {
    if (!c.notes) continue
    entries.push({
      id: `call-${c.id}`,
      when: c.called_at,
      label: CALL_TYPE_LABEL[c.call_type] ?? 'Call',
      detail: c.caller?.full_name ?? null,
      text: c.notes,
      tone: 'call',
    })
  }
  // Newest first, with the lead's own note (no date of its own) last as the origin.
  entries.sort((a, b) => (b.when ?? '').localeCompare(a.when ?? ''))
  if (lead.notes) {
    entries.push({ id: 'lead-note', when: null, label: 'Lead note', detail: null, text: lead.notes, tone: 'lead' })
  }

  if (entries.length === 0) return null

  const shown = expanded ? entries : entries.slice(0, COLLAPSED_COUNT)
  const hidden = entries.length - shown.length

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Ionicons name="document-text-outline" size={16} color={brand.navy} />
        <Text style={styles.title}>Previous notes</Text>
        <Text style={styles.count}>{entries.length}</Text>
      </View>

      {shown.map((e, i) => (
        <View key={e.id} style={[styles.entry, i === shown.length - 1 && hidden === 0 && styles.entryLast]}>
          <View style={styles.entryTop}>
            <View style={[styles.tag, e.tone === 'visit' ? styles.tagVisit : e.tone === 'call' ? styles.tagCall : styles.tagLead]}>
              <Text style={[styles.tagText, e.tone === 'visit' ? styles.tagTextVisit : e.tone === 'call' ? styles.tagTextCall : styles.tagTextLead]}>{e.label}</Text>
            </View>
            {e.when && <Text style={styles.meta}>{formatWhen(e.when)}{e.detail ? ` · ${e.detail}` : ''}</Text>}
          </View>
          <Text style={styles.text}>{e.text}</Text>
        </View>
      ))}

      {entries.length > COLLAPSED_COUNT && (
        <TouchableOpacity style={styles.moreBtn} onPress={() => setExpanded((x) => !x)}>
          <Text style={styles.moreText}>{expanded ? 'Show fewer' : `Show ${hidden} earlier`}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: brand.bg, borderWidth: 1, borderColor: brand.borderLight, borderRadius: 12, padding: 12, marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  title: { flex: 1, fontSize: 13, fontWeight: '700', color: brand.ink },
  count: { fontSize: 12, fontWeight: '700', color: brand.navy, backgroundColor: brand.navySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  entry: { paddingBottom: 10, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: brand.borderLight },
  entryLast: { paddingBottom: 0, marginBottom: 0, borderBottomWidth: 0 },
  entryTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  tagVisit: { backgroundColor: brand.navySoft },
  tagCall: { backgroundColor: brand.warningSoft },
  tagLead: { backgroundColor: brand.surfaceAlt },
  tagText: { fontSize: 11, fontWeight: '700' },
  tagTextVisit: { color: brand.navy },
  tagTextCall: { color: brand.warning },
  tagTextLead: { color: brand.muted },
  meta: { fontSize: 11, color: brand.faint },
  text: { fontSize: 13, color: brand.text, marginTop: 5, lineHeight: 18 },
  moreBtn: { alignItems: 'center', paddingTop: 4 },
  moreText: { fontSize: 12, fontWeight: '700', color: brand.navy },
})
