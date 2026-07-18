// src/components/sales/FollowUpSetter.tsx
// One pending follow-up per lead is enforced by a DB partial unique index —
// the resulting error is surfaced as a friendly message rather than a raw
// constraint violation.
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useCreateFollowUp } from '@/hooks/useFollowUps'
import DateTimeField from '@/components/sales/DateTimeField'

interface FollowUpSetterProps {
  leadId: string
  onDone: () => void
  onCancel?: () => void
}

export default function FollowUpSetter({ leadId, onDone, onCancel }: FollowUpSetterProps) {
  const createFollowUp = useCreateFollowUp()
  const [dueAt, setDueAt] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (!dueAt) {
      setError('Pick a follow-up date and time.')
      return
    }
    try {
      await createFollowUp.mutateAsync({
        lead_id: leadId,
        due_at: new Date(dueAt).toISOString(),
        reason: reason || undefined,
      })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set follow-up')
    }
  }

  function handleCancel() {
    const hasInput = dueAt || reason
    if (!hasInput) {
      onCancel?.()
      return
    }
    Alert.alert('Discard this follow-up?', 'What you entered will be lost.', [
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

      <View style={styles.field}>
        <DateTimeField label="Follow-up Due *" value={dueAt} onChange={setDueAt} mode="datetime" minimumDate={new Date()} />
      </View>

      <View style={styles.field}>
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
      </View>

      <View style={styles.actions}>
        {onCancel && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleCancel}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.btn, createFollowUp.isPending && styles.btnDisabled]} onPress={submit} disabled={createFollowUp.isPending}>
          {createFollowUp.isPending ? <ActivityIndicator color="#052e16" /> : <Text style={styles.btnText}>Set Follow-up</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827', backgroundColor: '#fff' },
  textarea: { minHeight: 60, textAlignVertical: 'top' },
  errorBox: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 10, marginBottom: 8 },
  errorText: { color: '#b91c1c', fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  secondaryBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  btn: { backgroundColor: '#4ade80', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', minWidth: 140 },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontSize: 13, color: '#052e16', fontWeight: '700' },
})
