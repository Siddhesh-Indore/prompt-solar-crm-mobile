// src/components/sales/AdvanceReceivedForm.tsx
// Collects the advance from a customer who was finalized without paying one
// (advance_mode = 'none'). Saving moves them out of the Visits board's
// Advance Pending column.
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useMarkAdvanceReceived } from '@/hooks/useClientIntake'
import ChipSelect from '@/components/sales/ChipSelect'
import type { ClientIntakeForm } from '@/types/sales'

const MODE_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'online', label: 'Online (Prompt Solar account)' },
  { value: 'cheque', label: 'Cheque' },
] as const

interface Props {
  form: ClientIntakeForm
  onDone: () => void
  onCancel: () => void
}

export default function AdvanceReceivedForm({ form, onDone, onCancel }: Props) {
  const markReceived = useMarkAdvanceReceived()
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState<'cash' | 'online' | 'cheque' | undefined>()
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    const value = Number(amount)
    if (!amount || !(value > 0)) return setError('Enter the advance amount received.')
    if (value > form.total_cost) return setError('Advance can’t be more than the total cost.')
    if (!mode) return setError('Choose how the advance was received.')
    try {
      await markReceived.mutateAsync({ form, amount: value, mode })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save the advance')
    }
  }

  return (
    <View style={styles.form}>
      {form.advance_note ? (
        <View style={styles.noteBox}>
          <Text style={styles.noteLabel}>Earlier note</Text>
          <Text style={styles.noteText}>{form.advance_note}</Text>
        </View>
      ) : null}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Advance Received (₹) *</Text>
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholderTextColor="#9ca3af" />
        <Text style={styles.caption}>Total cost ₹{form.total_cost.toLocaleString('en-IN')}</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Received In *</Text>
        <ChipSelect options={MODE_OPTIONS as any} value={mode as any} onChange={(v) => setMode(v as 'cash' | 'online' | 'cheque')} />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel} disabled={markReceived.isPending}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryBtn, markReceived.isPending && styles.btnDisabled]} onPress={submit} disabled={markReceived.isPending}>
          {markReceived.isPending ? <ActivityIndicator color="#052e16" /> : <Text style={styles.primaryBtnText}>Save Advance</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: 4 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827', backgroundColor: '#fff' },
  caption: { fontSize: 11, color: '#9ca3af', marginTop: 5 },
  noteBox: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 10, padding: 10, marginBottom: 14 },
  noteLabel: { fontSize: 11, fontWeight: '700', color: '#b45309', marginBottom: 2 },
  noteText: { fontSize: 13, color: '#78350f' },
  errorBox: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 10, marginBottom: 14 },
  errorText: { color: '#b91c1c', fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  secondaryBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  primaryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: '#4ade80', alignItems: 'center', justifyContent: 'center', minWidth: 140 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 13, color: '#052e16', fontWeight: '700' },
})
