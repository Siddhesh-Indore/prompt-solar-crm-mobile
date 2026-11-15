// src/components/sales/PostVisitForm.tsx
// Records a completed visit and branches the lead's stage per outcome:
//   finalized     -> stage=visited (client intake form becomes fillable — web-only for now)
//   second_visit  -> stage=visit_fixed with a new visit date (loops back);
//                    only offered on the first visit — once a customer is in
//                    Follow-up the choices are Follow-up / Lost / Finalized
//   follow_up     -> a next visit date is optional here too: if given, this
//                    behaves like second_visit (the next visit IS the plan);
//                    left blank, stage=visited and FollowUpSetter opens for
//                    a callback reminder instead
//   lost          -> stage=lost (terminal)
import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useAuth } from '@/context/AuthContext'
import { useCreateVisitReport, useVisitReports, type NewVisitReportInput } from '@/hooks/useVisitReports'
import { useUpdateLead } from '@/hooks/useLeadMutations'
import { uploadVisitPhoto } from '@/lib/uploadVisitPhoto'
import { hapticSuccess, hapticWarning } from '@/lib/haptics'
import ChipSelect from '@/components/sales/ChipSelect'
import PreviousNotes from '@/components/sales/PreviousNotes'
import DateTimeField from '@/components/sales/DateTimeField'
import FollowUpSetter from '@/components/sales/FollowUpSetter'
import LocationPhotoCapture, { type LocationPhotoValue } from '@/components/sales/LocationPhotoCapture'
import type { Lead } from '@/types/sales'
import { brand } from '@/constants/brand'

const OUTCOME_OPTIONS: { value: NonNullable<NewVisitReportInput['outcome']>; label: string }[] = [
  { value: 'finalized', label: 'Finalized' },
  { value: 'second_visit', label: 'Second Visit' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'lost', label: 'Lost' },
]

// A customer already in Follow-up (visited at least once) has run out of
// "second visit" — it's either still a follow-up, finalized, or lost.
const FOLLOW_UP_STAGE_OUTCOMES = OUTCOME_OPTIONS.filter((o) => o.value !== 'second_visit')

interface PostVisitFormProps {
  lead: Lead
  onDone: () => void
  onCancel?: () => void
}

export default function PostVisitForm({ lead, onDone, onCancel }: PostVisitFormProps) {
  const { user } = useAuth()
  const createVisitReport = useCreateVisitReport()
  const updateLead = useUpdateLead()
  // Every visit needs a site photo. The first visit also captures the GPS
  // location; follow-ups reuse it rather than asking for a fresh fix — the
  // site is the same, and the DB still wants a location on every visit
  // report (migration 027), so it's copied from the first one.
  const { data: existingVisits = [] } = useVisitReports(lead.id)
  const isFirstVisit = existingVisits.length === 0
  // useVisitReports is newest-first, so the first visit is the last entry.
  const firstVisit = existingVisits[existingVisits.length - 1]
  const inheritedLocation =
    !isFirstVisit && firstVisit?.latitude != null && firstVisit?.longitude != null
      ? { latitude: firstVisit.latitude, longitude: firstVisit.longitude, accuracy: firstVisit.location_accuracy }
      : null
  const outcomeOptions = isFirstVisit ? OUTCOME_OPTIONS : FOLLOW_UP_STAGE_OUTCOMES

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

  // Reports can finish loading after the form opens; if "Second Visit" was
  // picked in that window, move to the closest remaining option.
  useEffect(() => {
    if (!isFirstVisit && outcome === 'second_visit') setOutcome('follow_up')
  }, [isFirstVisit, outcome])

  const showNextVisitFields = outcome === 'second_visit' || outcome === 'follow_up'
  const nextVisitPlanned = showNextVisitFields && !!newVisitDate

  async function submit() {
    setError(null)
    if (outcome === 'second_visit' && !newVisitDate) {
      setError('Pick a date for the next visit.')
      return
    }
    const location = inheritedLocation ?? locationPhoto
    if (location.latitude == null || location.longitude == null) {
      setError('Capture the site location before saving.')
      return
    }
    if (!locationPhoto.photoUri) {
      setError('Add a site photo before saving — required for every visit.')
      return
    }

    setSubmitting(true)
    try {
      const photoPath = locationPhoto.photoUri
        ? await uploadVisitPhoto(user!.id, lead.id, locationPhoto.photoUri)
        : undefined

      await createVisitReport.mutateAsync({
        lead_id: lead.id,
        outcome,
        kw_interest: kwInterest ? Number(kwInterest) : undefined,
        quote_discussed: quoteDiscussed ? Number(quoteDiscussed) : undefined,
        next_step: nextStep || undefined,
        notes: notes || undefined,
        latitude: location.latitude,
        longitude: location.longitude,
        location_accuracy: location.accuracy,
        photo_url: photoPath,
      })

      hapticSuccess()
      if (outcome === 'second_visit' || (outcome === 'follow_up' && nextVisitPlanned)) {
        // The next visit itself is the plan — schedule it directly rather
        // than also opening FollowUpSetter for a separate reminder.
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
      hapticWarning()
      setError(err instanceof Error ? err.message : 'Failed to save visit report')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancel() {
    const hasInput = kwInterest || quoteDiscussed || nextStep || notes || newVisitDate || newVisitTime
      || locationPhoto.latitude != null || locationPhoto.photoUri
    if (!hasInput) {
      onCancel?.()
      return
    }
    Alert.alert('Discard this visit report?', 'What you entered — including any captured location or photo — will be lost.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onCancel },
    ])
  }

  if (showFollowUpSetter) {
    return <FollowUpSetter leadId={lead.id} onDone={onDone} onCancel={onDone} />
  }

  return (
    <View style={styles.form}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Field label="Outcome">
        <ChipSelect options={outcomeOptions} value={outcome} onChange={setOutcome} />
      </Field>

      <LocationPhotoCapture value={locationPhoto} onChange={setLocationPhoto} locationRequired={!inheritedLocation} />

      {showNextVisitFields && (
        <View style={styles.row2}>
          <View style={styles.col}>
            <DateTimeField
              label={outcome === 'second_visit' ? 'Next Visit Date *' : 'Next Visit Date (optional)'}
              value={newVisitDate}
              onChange={setNewVisitDate}
              mode="date"
              minimumDate={new Date()}
              placeholder="Pick a date"
            />
          </View>
          <View style={styles.col}>
            <DateTimeField label="Time" value={newVisitTime} onChange={setNewVisitTime} mode="time" placeholder="Pick a time" />
          </View>
        </View>
      )}

      {outcome === 'follow_up' && !nextVisitPlanned && (
        <Text style={styles.hint}>No next visit date? A follow-up reminder will be set instead after saving.</Text>
      )}

      <View style={styles.row2}>
        <View style={styles.col}>
          <Field label="kW Interest">
            <TextInput style={styles.input} value={kwInterest} onChangeText={setKwInterest} keyboardType="numeric" placeholder="e.g. 5" placeholderTextColor={brand.faint} />
          </Field>
        </View>
        <View style={styles.col}>
          <Field label="Quote Discussed (₹)">
            <TextInput style={styles.input} value={quoteDiscussed} onChangeText={setQuoteDiscussed} keyboardType="numeric" placeholderTextColor={brand.faint} />
          </Field>
        </View>
      </View>

      <Field label="Next Step">
        <TextInput style={styles.input} value={nextStep} onChangeText={setNextStep} placeholderTextColor={brand.faint} />
      </Field>

      <PreviousNotes lead={lead} visits={existingVisits} />

      <Field label="Notes">
        <TextInput
          style={[styles.input, styles.textarea]}
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          placeholder="Visit notes…"
          placeholderTextColor={brand.faint}
        />
      </Field>

      <View style={styles.actions}>
        {onCancel && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleCancel} disabled={submitting}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.primaryBtn, submitting && styles.btnDisabled]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color={brand.onGreen} /> : <Text style={styles.primaryBtnText}>Save Visit Report</Text>}
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
  label: { fontSize: 13, fontWeight: '600', color: brand.text, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: brand.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: brand.ink, backgroundColor: '#fff' },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  row2: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  col: { flex: 1 },
  hint: { fontSize: 12, color: brand.faint, marginTop: -8, marginBottom: 14 },
  errorBox: { backgroundColor: brand.dangerSoft, borderWidth: 1, borderColor: brand.dangerBorder, borderRadius: 10, padding: 10, marginBottom: 14 },
  errorText: { color: brand.danger, fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: brand.surfaceAlt },
  primaryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: brand.green, alignItems: 'center', justifyContent: 'center', minWidth: 160 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 13, color: brand.onGreen, fontWeight: '700' },
  secondaryBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: brand.border, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 13, color: brand.text, fontWeight: '600' },
})
