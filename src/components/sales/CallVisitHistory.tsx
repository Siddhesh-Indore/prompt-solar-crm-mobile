// src/components/sales/CallVisitHistory.tsx
// Every call note (telecaller) and visit note (sales exec) for a lead, so
// either role can see what the other one wrote. Mirrors the web CRM's
// LeadDetailPage call-logs/visit-reports sections.
import { View, Text, StyleSheet } from 'react-native'
import { useCallLogs } from '@/hooks/useCallLogs'
import { useVisitReports } from '@/hooks/useVisitReports'

const CALL_TYPE_LABEL: Record<string, string> = {
  qualification: 'Qualification', pre_visit: 'Pre-Visit', follow_up: 'Follow-up', callback: 'Callback',
}
const CALL_OUTCOME_LABEL: Record<string, string> = {
  answered: 'Answered', no_answer: 'No Answer', busy: 'Busy',
  callback_requested: 'Callback Requested', confirmed: 'Confirmed', rescheduled: 'Rescheduled',
  incoming_call_barred: 'Incoming Call Barred', invalid_phone_number: 'Invalid Phone Number',
}
const VISIT_OUTCOME_LABEL: Record<string, string> = {
  finalized: 'Finalized', second_visit: 'Second Visit Needed', follow_up: 'Follow-up Needed', lost: 'Lost',
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function CallVisitHistory({ leadId }: { leadId: string | undefined }) {
  const { data: callLogs = [] } = useCallLogs(leadId)
  const { data: visitReports = [] } = useVisitReports(leadId)

  if (callLogs.length === 0 && visitReports.length === 0) return null

  return (
    <>
      {callLogs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Call Logs</Text>
          <View style={styles.sectionCard}>
            {callLogs.map((c, i) => (
              <View key={c.id} style={[styles.entry, i === callLogs.length - 1 && styles.entryLast]}>
                <View style={styles.entryTopRow}>
                  <Text style={styles.entryKind}>{CALL_TYPE_LABEL[c.call_type] ?? c.call_type}</Text>
                  {c.outcome && (
                    <View style={styles.pill}>
                      <Text style={styles.pillText}>{CALL_OUTCOME_LABEL[c.outcome] ?? c.outcome}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.entryMeta}>
                  {formatWhen(c.called_at)}{c.caller?.full_name ? ` · by ${c.caller.full_name}` : ''}
                </Text>
                {c.notes ? <Text style={styles.entryNotes}>{c.notes}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      )}

      {visitReports.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visit Reports</Text>
          <View style={styles.sectionCard}>
            {visitReports.map((v, i) => (
              <View key={v.id} style={[styles.entry, i === visitReports.length - 1 && styles.entryLast]}>
                <View style={styles.entryTopRow}>
                  <Text style={styles.entryKind}>Visit #{v.visit_number}</Text>
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{VISIT_OUTCOME_LABEL[v.outcome] ?? v.outcome}</Text>
                  </View>
                </View>
                <Text style={styles.entryMeta}>
                  {formatWhen(v.visited_at)}{v.exec?.full_name ? ` · by ${v.exec.full_name}` : ''}
                </Text>
                {v.next_step ? <Text style={styles.entryNotes}>Next: {v.next_step}</Text> : null}
                {v.notes ? <Text style={styles.entryNotes}>{v.notes}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  sectionCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14 },
  entry: { paddingBottom: 10, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  entryLast: { paddingBottom: 0, marginBottom: 0, borderBottomWidth: 0 },
  entryTopRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  entryKind: { fontSize: 13, fontWeight: '600', color: '#111827' },
  pill: { backgroundColor: '#f3f4f6', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 11, color: '#6b7280' },
  entryMeta: { fontSize: 11, color: '#9ca3af', marginTop: 3 },
  entryNotes: { fontSize: 12, color: '#4b5563', marginTop: 4 },
})
