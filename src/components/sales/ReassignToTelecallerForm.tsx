// src/components/sales/ReassignToTelecallerForm.tsx
// Lets a sales exec hand a lead back into the Telecaller Queue for another
// call (e.g. to confirm a detail or chase a document) without giving up
// ownership — stage moves back to 'calling' and a follow-up is created for
// the chosen telecaller, but assigned_exec_id is untouched, so the lead
// returns to this same exec once it's qualified again. Mirrors the web
// CRM's ReassignToTelecallerForm.
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Modal, FlatList, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useSalesTeam } from '@/hooks/useSalesTeam'
import { useUpdateLead } from '@/hooks/useLeadMutations'
import { useCreateFollowUp } from '@/hooks/useFollowUps'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import DateTimeField from '@/components/sales/DateTimeField'
import type { Lead } from '@/types/sales'

interface Props {
  lead: Lead
  onDone: () => void
  onCancel: () => void
}

export default function ReassignToTelecallerForm({ lead, onDone, onCancel }: Props) {
  const { user } = useAuth()
  const { data: telecallers = [], isLoading: loadingTeam } = useSalesTeam('telecaller')
  const updateLead = useUpdateLead()
  const createFollowUp = useCreateFollowUp()
  const [telecallerId, setTelecallerId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [dueAt, setDueAt] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const selectedTelecaller = telecallers.find((t) => t.id === telecallerId)

  async function submit() {
    setError(null)
    if (!telecallerId) {
      setError('Pick a telecaller.')
      return
    }
    if (!dueAt) {
      setError('Pick a follow-up date/time.')
      return
    }
    setSubmitting(true)
    try {
      await updateLead.mutateAsync({ id: lead.id, patch: { stage: 'calling', assigned_caller_id: telecallerId } })
      await createFollowUp.mutateAsync({ lead_id: lead.id, due_at: dueAt, reason: note || undefined, assigned_to: telecallerId })

      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        actor_id: user?.id ?? null,
        action_type: 'reassigned_to_telecaller',
        old_value: { stage: lead.stage },
        new_value: { stage: 'calling', assigned_caller_id: telecallerId, assignee_name: selectedTelecaller?.full_name ?? null, due_at: dueAt },
        note: note || null,
      })

      onDone()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send back to telecaller'
      setError(message)
      Alert.alert('Error', message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={styles.wrap}>
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.label}>Telecaller *</Text>
      <TouchableOpacity style={styles.field} onPress={() => setPickerOpen(true)} disabled={loadingTeam}>
        {loadingTeam ? (
          <ActivityIndicator size="small" color="#6b7280" />
        ) : (
          <Text style={selectedTelecaller ? styles.value : styles.placeholder}>
            {selectedTelecaller ? selectedTelecaller.full_name : 'Select a telecaller…'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.fieldGap}>
        <DateTimeField label="Follow-up Due *" value={dueAt} onChange={setDueAt} mode="datetime" minimumDate={new Date()} placeholder="Pick date & time" />
      </View>

      <Text style={[styles.label, styles.fieldGap]}>Note for the telecaller</Text>
      <TextInput
        style={styles.textArea}
        value={note}
        onChangeText={setNote}
        placeholder="What should they follow up on?"
        placeholderTextColor="#9ca3af"
        multiline
        numberOfLines={3}
      />

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} disabled={submitting}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={submitting}>
          <Text style={styles.submitBtnText}>{submitting ? 'Sending…' : 'Send to Telecaller'}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select Telecaller</Text>
            <FlatList
              data={telecallers}
              keyExtractor={(t) => t.id}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.row} onPress={() => { setTelecallerId(item.id); setPickerOpen(false) }}>
                  <Text style={styles.rowText}>{item.full_name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No telecallers found.</Text>}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  error: { fontSize: 12, color: '#dc2626', backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 8, padding: 8, marginBottom: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 4 },
  fieldGap: { marginTop: 10 },
  field: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
  value: { fontSize: 14, color: '#111827' },
  placeholder: { fontSize: 14, color: '#9ca3af' },
  textArea: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', minHeight: 70, textAlignVertical: 'top' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  cancelBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  submitBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: '#4ade80', alignItems: 'center' },
  submitBtnText: { fontSize: 13, fontWeight: '700', color: '#052e16' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '60%' },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowText: { fontSize: 14, color: '#111827' },
  empty: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 20 },
})
