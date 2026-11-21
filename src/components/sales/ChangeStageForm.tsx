// src/components/sales/ChangeStageForm.tsx
// Lets a sales exec undo a mistaken outcome: a customer marked Finalized (or
// Lost) by accident can be moved back to Follow-up, or across to the other
// outcome. Changes the latest visit's outcome and the lead's stage together
// (change_visit_outcome, migration 092); the change is written to the lead's
// activity log. Not offered once the intake form is in.
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useChangeVisitOutcome, type CorrectedOutcome } from '@/hooks/useVisitReports'
import { hapticSuccess, hapticWarning } from '@/lib/haptics'
import type { Lead } from '@/types/sales'
import { brand } from '@/constants/brand'

const OPTIONS: { value: CorrectedOutcome; label: string; hint: string }[] = [
  { value: 'follow_up', label: 'Follow-up', hint: 'Back to Follow-up — keep working on this customer.' },
  { value: 'finalized', label: 'Finalized', hint: 'Customer agreed — moves to Intake Pending.' },
  { value: 'lost', label: 'Lost', hint: 'Customer is not going ahead.' },
]

interface Props {
  lead: Lead
  /** Where the customer sits now — that option is not offered. */
  current: CorrectedOutcome
  onDone: () => void
  onCancel: () => void
}

export default function ChangeStageForm({ lead, current, onDone, onCancel }: Props) {
  const changeOutcome = useChangeVisitOutcome()
  const options = OPTIONS.filter((o) => o.value !== current)
  const [choice, setChoice] = useState<CorrectedOutcome | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!choice) {
      setError('Pick the stage to move this customer to.')
      return
    }
    setError(null)
    try {
      await changeOutcome.mutateAsync({ leadId: lead.id, outcome: choice, note })
      hapticSuccess()
      onDone()
    } catch (err) {
      hapticWarning()
      setError(err instanceof Error ? err.message : 'Could not change the stage')
    }
  }

  return (
    <View>
      <Text style={styles.intro}>
        Move <Text style={styles.bold}>{lead.name}</Text> to a different stage. This corrects the outcome of the last visit you recorded.
      </Text>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.label}>Move to</Text>
      <View style={styles.options}>
        {options.map((o) => {
          const active = o.value === choice
          return (
            <TouchableOpacity key={o.value} style={[styles.option, active && styles.optionActive]} onPress={() => setChoice(o.value)} activeOpacity={0.7}>
              <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{o.label}</Text>
              <Text style={styles.optionHint}>{o.hint}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <Text style={styles.label}>Reason (optional)</Text>
      <TextInput
        style={styles.input}
        value={note}
        onChangeText={setNote}
        multiline
        placeholder="e.g. Marked Finalized by mistake"
        placeholderTextColor={brand.faint}
      />

      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel} disabled={changeOutcome.isPending}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryBtn, (!choice || changeOutcome.isPending) && styles.btnDisabled]} onPress={submit} disabled={!choice || changeOutcome.isPending}>
          {changeOutcome.isPending ? <ActivityIndicator color={brand.onGreen} /> : <Text style={styles.primaryBtnText}>Change Stage</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  intro: { fontSize: 13, color: brand.text, lineHeight: 19, marginBottom: 16 },
  bold: { fontWeight: '700', color: brand.ink },
  label: { fontSize: 13, fontWeight: '600', color: brand.text, marginBottom: 8 },
  options: { gap: 8, marginBottom: 16 },
  option: { borderWidth: 1, borderColor: brand.border, borderRadius: 12, padding: 12, backgroundColor: '#fff' },
  optionActive: { borderColor: brand.green, backgroundColor: brand.greenSoft },
  optionLabel: { fontSize: 14, fontWeight: '600', color: brand.ink },
  optionLabelActive: { color: brand.greenDark },
  optionHint: { fontSize: 12, color: brand.muted, marginTop: 2 },
  input: { borderWidth: 1, borderColor: brand.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: brand.ink, backgroundColor: '#fff', minHeight: 70, textAlignVertical: 'top' },
  errorBox: { backgroundColor: brand.dangerSoft, borderWidth: 1, borderColor: brand.dangerBorder, borderRadius: 10, padding: 10, marginBottom: 14 },
  errorText: { color: brand.danger, fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: brand.surfaceAlt },
  primaryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: brand.green, alignItems: 'center', justifyContent: 'center', minWidth: 140 },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 13, color: brand.onGreen, fontWeight: '700' },
  secondaryBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: brand.border, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 13, color: brand.text, fontWeight: '600' },
})
