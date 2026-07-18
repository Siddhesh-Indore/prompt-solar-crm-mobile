// src/components/sales/PreVisitCallForm.tsx
// Replaces the old one-tap "Log Pre-Visit Call" action. A customer confirming
// the visit is the common case, but they often ask to push it — this always
// takes a note, and lets the exec reschedule the lead's visit_date/time
// directly instead of that being a dead end.
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useLogCall } from '@/hooks/useCallLogs'
import { useUpdateLead } from '@/hooks/useLeadMutations'
import DateTimeField from '@/components/sales/DateTimeField'
import type { Lead } from '@/types/sales'

interface PreVisitCallFormProps {
  lead: Lead
  onDone: () => void
  onCancel: () => void
}

export default function PreVisitCallForm({ lead, onDone, onCancel }: PreVisitCallFormProps) {
  const logCall = useLogCall()
  const updateLead = useUpdateLead()

  const [rescheduling, setRescheduling] = useState(false)
  const [notes, setNotes] = useState('')
  const [newVisitDate, setNewVisitDate] = useState('')
  const [newVisitTime, setNewVisitTime] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    setError(null)
    if (rescheduling && !newVisitDate) {
      setError('Pick the new visit date.')
      return
    }

    setSubmitting(true)
    try {
      await logCall.mutateAsync({
        lead_id: lead.id,
        call_type: 'pre_visit',
        outcome: rescheduling ? 'rescheduled' : 'confirmed',
        notes: notes || undefined,
      })

      if (rescheduling) {
        await updateLead.mutateAsync({
          id: lead.id,
          patch: { visit_date: newVisitDate, visit_time: newVisitTime || null },
        })
      }

      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log call')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancel() {
    const hasInput = notes || newVisitDate || newVisitTime || rescheduling
    if (!hasInput) {
      onCancel()
      return
    }
    Alert.alert('Discard this call log?', 'What you entered will be lost.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onCancel },
    ])
  }

  return (
    <View style={styles.wrap}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, !rescheduling && styles.toggleBtnActive]}
          onPress={() => setRescheduling(false)}
        >
          <Text style={[styles.toggleText, !rescheduling && styles.toggleTextActive]}>Visit Confirmed</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, rescheduling && styles.toggleBtnActive]}
          onPress={() => setRescheduling(true)}
        >
          <Text style={[styles.toggleText, rescheduling && styles.toggleTextActive]}>Customer Postponed</Text>
        </TouchableOpacity>
      </View>

      {rescheduling && (
        <View style={styles.row2}>
          <View style={styles.col}>
            <DateTimeField label="New Visit Date *" value={newVisitDate} onChange={setNewVisitDate} mode="date" minimumDate={new Date()} placeholder="Pick a date" />
          </View>
          <View style={styles.col}>
            <DateTimeField label="Time" value={newVisitTime} onChange={setNewVisitTime} mode="time" placeholder="Pick a time" />
          </View>
        </View>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Note</Text>
        <TextInput
          style={[styles.input, styles.textarea]}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={2}
          placeholder={rescheduling ? 'Why the customer postponed…' : 'Anything worth noting…'}
          placeholderTextColor="#9ca3af"
        />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleCancel} disabled={submitting}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btn, submitting && styles.btnDisabled]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#052e16" /> : <Text style={styles.btnText}>{rescheduling ? 'Save & Reschedule' : 'Log Call'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14 },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  toggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#4ade80', borderColor: '#4ade80' },
  toggleText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  toggleTextActive: { color: '#052e16' },
  row2: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  col: { flex: 1 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827', backgroundColor: '#fff' },
  textarea: { minHeight: 60, textAlignVertical: 'top' },
  errorBox: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 10, marginBottom: 8 },
  errorText: { color: '#b91c1c', fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  secondaryBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  btn: { backgroundColor: '#4ade80', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', minWidth: 150 },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 13, color: '#052e16', fontWeight: '700' },
})
