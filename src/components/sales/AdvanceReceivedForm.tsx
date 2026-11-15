// src/components/sales/AdvanceReceivedForm.tsx
// Collects the advance from a customer who was finalized without paying one
// (advance_mode = 'none'). Saving moves them out of the Visits board's
// Advance Pending column.
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useMarkAdvanceReceived } from '@/hooks/useClientIntake'
import ChipSelect from '@/components/sales/ChipSelect'
import { hapticSuccess, hapticWarning } from '@/lib/haptics'
import type { ClientIntakeForm } from '@/types/sales'
import { brand } from '@/constants/brand'

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
      hapticSuccess()
      onDone()
    } catch (err) {
      hapticWarning()
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
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="numeric" placeholderTextColor={brand.faint} />
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
          {markReceived.isPending ? <ActivityIndicator color={brand.onGreen} /> : <Text style={styles.primaryBtnText}>Save Advance</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: 4 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: brand.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: brand.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: brand.ink, backgroundColor: '#fff' },
  caption: { fontSize: 11, color: brand.faint, marginTop: 5 },
  noteBox: { backgroundColor: brand.warningSoft, borderWidth: 1, borderColor: brand.warningBorder, borderRadius: 10, padding: 10, marginBottom: 14 },
  noteLabel: { fontSize: 11, fontWeight: '700', color: brand.warning, marginBottom: 2 },
  noteText: { fontSize: 13, color: '#78350f' },
  errorBox: { backgroundColor: brand.dangerSoft, borderWidth: 1, borderColor: brand.dangerBorder, borderRadius: 10, padding: 10, marginBottom: 14 },
  errorText: { color: brand.danger, fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: brand.surfaceAlt },
  secondaryBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: brand.border, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 13, color: brand.text, fontWeight: '600' },
  primaryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: brand.green, alignItems: 'center', justifyContent: 'center', minWidth: 140 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 13, color: brand.onGreen, fontWeight: '700' },
})
