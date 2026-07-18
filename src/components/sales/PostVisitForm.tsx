// src/components/sales/PostVisitForm.tsx
// Records a completed visit and branches the lead's stage per outcome:
//   finalized     -> stage=visited (client intake form becomes fillable — web-only for now)
//   second_visit  -> stage=visit_fixed with a new visit date (loops back)
//   follow_up     -> stage=visited, opens FollowUpSetter
//   lost          -> stage=lost (terminal)
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useAuth } from '@/context/AuthContext'
import { useCreateVisitReport, type NewVisitReportInput } from '@/hooks/useVisitReports'
import { useUpdateLead } from '@/hooks/useLeadMutations'
import { uploadVisitPhoto } from '@/lib/uploadVisitPhoto'
import ChipSelect from '@/components/sales/ChipSelect'
import FollowUpSetter from '@/components/sales/FollowUpSetter'
import LocationPhotoCapture, { type LocationPhotoValue } from '@/components/sales/LocationPhotoCapture'
import type { Lead } from '@/types/sales'

const OUTCOME_OPTIONS: { value: NonNullable<NewVisitReportInput['outcome']>; label: string }[] = [
  { value: 'finalized', label: 'Finalized' },
  { value: 'second_visit', label: 'Second Visit' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'lost', label: 'Lost' },
]

interface PostVisitFormProps {
  lead: Lead
  onDone: () => void
  onCancel?: () => void
}

export default function PostVisitForm({ lead, onDone, onCancel }: PostVisitFormProps) {
  const { user } = useAuth()
  const createVisitReport = useCreateVisitReport()
  const updateLead = useUpdateLead()

  const [outcome, setOutcome] = useState<NonNullable<NewVisitReportInput['outcome']>>('finalized')
  const [kwInterest, setKwInterest] = useState('')
  const [quoteDiscussed, setQuoteDiscussed] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [notes, setNotes] = useState('')
  const [newVisitDate, setNewVisitDate] = useState('')
  const [newVisitTime, setNewVisitTime] = useState('')
  const [locationPhoto, setLocationPhoto] = useState<LocationPhotoValue>({
    latitude: null, longitude: null, accuracy: null, photoUri: null,
  })
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showFollowUpSetter, setShowFollowUpSetter] = useState(false)

  async function submit() {
    setError(null)
    if (outcome === 'second_visit' && !newVisitDate) {
      setError('Enter a date for the next visit (YYYY-MM-DD).')
      return
    }
    if (locationPhoto.latitude == null || locationPhoto.longitude == null) {
      setError('Capture the site location before saving — required for every visit.')
      return
    }
    if (!locationPhoto.photoUri) {
      setError('Add a site photo before saving — required for every visit.')
      return
    }

    setSubmitting(true)
    try {
      const photoPath = await uploadVisitPhoto(user!.id, lead.id, locationPhoto.photoUri)

      await createVisitReport.mutateAsync({
        lead_id: lead.id,
        outcome,
        kw_interest: kwInterest ? Number(kwInterest) : undefined,
        quote_discussed: quoteDiscussed ? Number(quoteDiscussed) : undefined,
        next_step: nextStep || undefined,
        notes: notes || undefined,
        latitude: locationPhoto.latitude,
        longitude: locationPhoto.longitude,
        location_accuracy: locationPhoto.accuracy,
        photo_url: photoPath,
      })

      if (outcome === 'second_visit') {
        await updateLead.mutateAsync({
          id: lead.id,
          patch: { stage: 'visit_fixed', visit_date: newVisitDate, visit_time: newVisitTime || null },
        })
        onDone()
      } else if (outcome === 'lost') {
        await updateLead.mutateAsync({ id: lead.id, patch: { stage: 'lost' } })
        onDone()
      } else if (outcome === 'follow_up') {
        await updateLead.mutateAsync({ id: lead.id, patch: { stage: 'visited' } })
        setShowFollowUpSetter(true)
      } else {
        await updateLead.mutateAsync({ id: lead.id, patch: { stage: 'visited' } })
        onDone()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save visit report')
    } finally {
      setSubmitting(false)
    }
  }

  if (showFollowUpSetter) {
    return <FollowUpSetter leadId={lead.id} onDone={onDone} />
  }

  return (
    <View style={styles.form}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Field label="Outcome">
        <ChipSelect options={OUTCOME_OPTIONS} value={outcome} onChange={setOutcome} />
      </Field>

      <LocationPhotoCapture value={locationPhoto} onChange={setLocationPhoto} />

      {outcome === 'second_visit' && (
        <View style={styles.row2}>
          <View style={styles.col}>
            <Field label="Next Visit Date *">
              <TextInput style={styles.input} value={newVisitDate} onChangeText={setNewVisitDate} placeholder="2026-07-22" placeholderTextColor="#9ca3af" />
            </Field>
          </View>
          <View style={styles.col}>
            <Field label="Time">
              <TextInput style={styles.input} value={newVisitTime} onChangeText={setNewVisitTime} placeholder="15:00" placeholderTextColor="#9ca3af" />
            </Field>
          </View>
        </View>
      )}

      <View style={styles.row2}>
        <View style={styles.col}>
          <Field label="kW Interest">
            <TextInput style={styles.input} value={kwInterest} onChangeText={setKwInterest} keyboardType="numeric" placeholder="e.g. 5" placeholderTextColor="#9ca3af" />
          </Field>
        </View>
        <View style={styles.col}>
          <Field label="Quote Discussed (₹)">
            <TextInput style={styles.input} value={quoteDiscussed} onChangeText={setQuoteDiscussed} keyboardType="numeric" placeholderTextColor="#9ca3af" />
          </Field>
        </View>
      </View>

      <Field label="Next Step">
        <TextInput style={styles.input} value={nextStep} onChangeText={setNextStep} placeholderTextColor="#9ca3af" />
      </Field>

      <Field label="Notes">
        <TextInput
          style={[styles.input, styles.textarea]}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          placeholder="Visit notes…"
          placeholderTextColor="#9ca3af"
        />
      </Field>

      <View style={styles.actions}>
        {onCancel && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel} disabled={submitting}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.primaryBtn, submitting && styles.btnDisabled]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#052e16" /> : <Text style={styles.primaryBtnText}>Save Visit Report</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: 4 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827', backgroundColor: '#fff' },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  errorBox: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 10, marginBottom: 14 },
  errorText: { color: '#b91c1c', fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  primaryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: '#4ade80', alignItems: 'center', justifyContent: 'center', minWidth: 160 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 13, color: '#052e16', fontWeight: '700' },
  secondaryBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 13, color: '#374151', fontWeight: '600' },
})
