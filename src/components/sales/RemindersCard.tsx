// src/components/sales/RemindersCard.tsx
// Home screen list of the current user's pending reminders (visit/callback)
// — in-app only, no OS push. Only renders once there's something to show,
// so it doesn't add empty-state clutter to every role's Home screen.
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useReminders, useDismissReminder } from '@/hooks/useReminders'

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

export default function RemindersCard() {
  const { data: reminders = [], isLoading } = useReminders()
  const dismiss = useDismissReminder()
  const router = useRouter()

  if (isLoading || reminders.length === 0) return null

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Reminders</Text>
      {reminders.map((r) => (
        <View key={r.id} style={styles.row}>
          <TouchableOpacity
            style={{ flex: 1 }}
            disabled={!r.lead}
            onPress={() => r.lead && router.push(`/sales/${r.lead.id}` as never)}
          >
            <Text style={styles.rowTitle}>
              {TYPE_LABEL[r.reminder_type] ?? r.reminder_type}{r.lead ? ` · ${r.lead.name}` : ''}
            </Text>
            <Text style={styles.rowDue}>{formatDueAt(r.due_at)}</Text>
            {r.note && <Text style={styles.rowNote}>{r.note}</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={() => dismiss.mutate(r.id)}
            disabled={dismiss.isPending}
            accessibilityLabel="Dismiss reminder"
          >
            {dismiss.isPending ? <ActivityIndicator size="small" color="#9ca3af" /> : <Text style={styles.dismissText}>✕</Text>}
          </TouchableOpacity>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12 },
  title: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  rowTitle: { fontSize: 13, fontWeight: '600', color: '#1f2937' },
  rowDue: { fontSize: 12, color: '#4ade80', fontWeight: '600', marginTop: 2 },
  rowNote: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  dismissBtn: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  dismissText: { fontSize: 12, color: '#9ca3af', fontWeight: '700' },
})
