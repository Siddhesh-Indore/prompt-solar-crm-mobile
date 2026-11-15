// src/components/sales/RemindersCard.tsx
// Home screen list of the current user's pending reminders (visit/callback)
// — in-app only, no OS push. Only renders once there's something to show,
// so it doesn't add empty-state clutter to every role's Home screen.
import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useReminders, useDismissReminder } from '@/hooks/useReminders'
import { brand } from '@/constants/brand'

const TYPE_LABEL: Record<string, string> = {
  callback: 'Callback',
  visit_reminder: 'Visit',
  follow_up: 'Follow-up',
}

function formatDueAt(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })
  if (sameDay) return `Today, ${time}`
  return `${d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })}, ${time}`
}

const COLLAPSED_COUNT = 2

export default function RemindersCard() {
  const { data: reminders = [], isLoading } = useReminders()
  const dismiss = useDismissReminder()
  const [expanded, setExpanded] = useState(false)

  if (isLoading || reminders.length === 0) return null

  // Home shouldn't be dominated by a long reminder list — show the next couple
  // and tuck the rest behind a tap.
  const visible = expanded ? reminders : reminders.slice(0, COLLAPSED_COUNT)
  const hidden = reminders.length - visible.length

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="notifications-outline" size={16} color={brand.navy} />
        <Text style={styles.title}>Reminders</Text>
        <Text style={styles.count}>{reminders.length}</Text>
      </View>
      {visible.map((r) => (
        <View key={r.id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle} numberOfLines={1}>
              {TYPE_LABEL[r.reminder_type] ?? r.reminder_type}{r.lead ? ` · ${r.lead.name}` : ''}
            </Text>
            <Text style={styles.rowDue}>{formatDueAt(r.due_at)}</Text>
            {r.note && <Text style={styles.rowNote} numberOfLines={1}>{r.note}</Text>}
          </View>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={() => dismiss.mutate(r.id)}
            disabled={dismiss.isPending}
            accessibilityLabel="Dismiss reminder"
            hitSlop={8}
          >
            <Ionicons name="close" size={18} color={brand.faint} />
          </TouchableOpacity>
        </View>
      ))}
      {(hidden > 0 || expanded) && reminders.length > COLLAPSED_COUNT && (
        <TouchableOpacity style={styles.moreBtn} onPress={() => setExpanded((e) => !e)}>
          <Text style={styles.moreText}>{expanded ? 'Show less' : `Show ${hidden} more`}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: brand.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: brand.borderLight },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  title: { fontSize: 14, fontWeight: '700', color: brand.ink, flex: 1 },
  count: { fontSize: 12, fontWeight: '700', color: brand.navy, backgroundColor: brand.navySoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: brand.surfaceAlt },
  rowTitle: { fontSize: 13, fontWeight: '600', color: brand.ink },
  rowDue: { fontSize: 12, color: brand.navy, fontWeight: '600', marginTop: 2 },
  rowNote: { fontSize: 12, color: brand.muted, marginTop: 2 },
  dismissBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  moreBtn: { paddingTop: 8, alignItems: 'center', borderTopWidth: 1, borderTopColor: brand.surfaceAlt },
  moreText: { fontSize: 12, fontWeight: '700', color: brand.navy },
})
