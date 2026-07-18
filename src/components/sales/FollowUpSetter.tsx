// src/components/sales/FollowUpSetter.tsx
// One pending follow-up per lead is enforced by a DB partial unique index —
// the resulting error is surfaced as a friendly message rather than a raw
// constraint violation.
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useCreateFollowUp } from '@/hooks/useFollowUps'

interface FollowUpSetterProps {
  leadId: string
  onDone: () => void
}

export default function FollowUpSetter({ leadId, onDone }: FollowUpSetterProps) {
  const createFollowUp = useCreateFollowUp()
  const [dueAt, setDueAt] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (!dueAt) {
      setError('Enter a follow-up date/time (YYYY-MM-DD HH:MM).')
      return
    }
    const parsed = new Date(dueAt.replace(' ', 'T'))
    try {
      await createFollowUp.mutateAsync({
        lead_id: leadId,
        due_at: isNaN(parsed.getTime()) ? dueAt : parsed.toISOString(),
        reason: reason || undefined,
      })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set follow-up')
    }
  }

  return (
    <View style={styles.wrap}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <Text style={styles.label}>Follow-up Due * (YYYY-MM-DD HH:MM)</Text>
      <TextInput style={styles.input} value={dueAt} onChangeText={setDueAt} placeholder="2026-07-22 11:00" placeholderTextColor="#9ca3af" />

      <Text style={styles.label}>Reason</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={reason}
        onChangeText={setReason}
        multiline
        numberOfLines={2}
        placeholder="Why the follow-up was set…"
        placeholderTextColor="#9ca3af"
      />

      <TouchableOpacity style={[styles.btn, createFollowUp.isPending && styles.btnDisabled]} onPress={submit} disabled={createFollowUp.isPending}>
        {createFollowUp.isPending ? <ActivityIndicator color="#052e16" /> : <Text style={styles.btnText}>Set Follow-up</Text>}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, gap: 4 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827', backgroundColor: '#fff' },
  textarea: { minHeight: 60, textAlignVertical: 'top' },
  errorBox: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 10, marginBottom: 8 },
  errorText: { color: '#b91c1c', fontSize: 12 },
  btn: { marginTop: 14, backgroundColor: '#4ade80', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 13, color: '#052e16', fontWeight: '700' },
})
