// src/components/sales/QualificationForm.tsx
// Mirrors the web CRM's QualificationForm — same status->stage/temperature
// mapping and same side effects (call log, activity row, callback reminder,
// lock release), rebuilt with plain RN inputs instead of react-hook-form.
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, ActivityIndicator, Alert } from 'react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useUpdateLead } from '@/hooks/useLeadMutations'
import { useLogCall } from '@/hooks/useCallLogs'
import { useReleaseLeadLock } from '@/hooks/useLeadLock'
import ExecAssignPicker from '@/components/sales/ExecAssignPicker'
import ChipSelect from '@/components/sales/ChipSelect'
import DateTimeField from '@/components/sales/DateTimeField'
import type { Lead } from '@/types/sales'

const STATUS_OPTIONS = [
  { value: 'visit_fixed', label: 'Visit Fixed' },
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
  { value: 'call_back', label: 'Call Back' },
  { value: 'not_qualified', label: 'Not Qualified' },
] as const

type Status = (typeof STATUS_OPTIONS)[number]['value']

const ROOF_OPTIONS = [{ value: 'rcc', label: 'RCC' }, { value: 'metal_terrace', label: 'Metal Terrace' }] as const
const OWNERSHIP_OPTIONS = [{ value: 'owned', label: 'Owned' }, { value: 'rented', label: 'Rented' }] as const
const PROPERTY_OPTIONS = [{ value: 'residential', label: 'Residential' }, { value: 'commercial', label: 'Commercial' }] as const

interface QualificationFormProps {
  lead: Lead
  onDone: () => void
}

export default function QualificationForm({ lead, onDone }: QualificationFormProps) {
  const { user } = useAuth()
  const updateLead = useUpdateLead()
  const logCall = useLogCall()
  const releaseLock = useReleaseLeadLock()

  const [status, setStatus] = useState<Status>('hot')
  const [roofType, setRoofType] = useState<string | undefined>()
  const [ownership, setOwnership] = useState<string | undefined>()
  const [propertyType, setPropertyType] = useState<string | undefined>()
  const [billAmount, setBillAmount] = useState('')
  const [quoteMin, setQuoteMin] = useState('')
  const [quoteMax, setQuoteMax] = useState('')
  const [competitorContacted, setCompetitorContacted] = useState(false)
  const [assignedExecId, setAssignedExecId] = useState<string | null>(null)
  const [visitDate, setVisitDate] = useState('')
  const [visitTime, setVisitTime] = useState('')
  const [callbackDue, setCallbackDue] = useState('')
  const [callbackReason, setCallbackReason] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit() {
    setError(null)

    if (status === 'visit_fixed' && !assignedExecId) {
      setError('Assign a Sales Executive to fix a visit.')
      return
    }
    if (status === 'visit_fixed' && !visitDate) {
      setError('Pick a visit date.')
      return
    }
    if (status === 'call_back' && !callbackDue) {
      setError('Pick a callback date and time.')
      return
    }

    const patch: Partial<Lead> = {
      roof_type: (roofType || null) as Lead['roof_type'],
      ownership: (ownership || null) as Lead['ownership'],
      property_type: (propertyType || null) as Lead['property_type'],
      approx_bill_amount: billAmount ? Number(billAmount) : null,
      quote_range_min: quoteMin ? Number(quoteMin) : null,
      quote_range_max: quoteMax ? Number(quoteMax) : null,
      competitor_contacted: competitorContacted,
      notes: notes || lead.notes,
    }

    if (status === 'visit_fixed') {
      patch.stage = 'visit_fixed'
      patch.assigned_exec_id = assignedExecId!
      patch.visit_date = visitDate
      patch.visit_time = visitTime || null
    } else if (status === 'not_qualified') {
      patch.stage = 'not_qualified'
    } else if (status === 'call_back') {
      patch.stage = 'calling'
    } else {
      patch.stage = 'calling'
      patch.temperature = status
    }

    setSubmitting(true)
    try {
      await updateLead.mutateAsync({ id: lead.id, patch, previousStage: lead.stage })

      await logCall.mutateAsync({
        lead_id: lead.id,
        call_type: 'qualification',
        outcome: status === 'call_back' ? 'callback_requested' : 'answered',
        notes,
      })

      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        actor_id: user?.id ?? null,
        action_type: 'stage_change',
        old_value: { stage: lead.stage },
        new_value: { stage: patch.stage, temperature: patch.temperature ?? null, status },
      })

      if (status === 'call_back' && callbackDue) {
        await supabase.from('reminders').insert({
          lead_id: lead.id,
          assigned_to: user?.id ?? null,
          reminder_type: 'callback',
          due_at: new Date(callbackDue).toISOString(),
          note: callbackReason || null,
        })
      }

      await releaseLock.mutateAsync({ leadId: lead.id })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save qualification')
    } finally {
      setSubmitting(false)
    }
  }

  async function releaseAndExit() {
    await releaseLock.mutateAsync({ leadId: lead.id })
    onDone()
  }

  function handleRelease() {
    const hasInput = status !== 'hot' || roofType || ownership || propertyType || billAmount
      || quoteMin || quoteMax || competitorContacted || assignedExecId || visitDate || visitTime
      || callbackDue || callbackReason || notes
    if (!hasInput) {
      releaseAndExit()
      return
    }
    Alert.alert('Release this lead?', 'What you entered will be lost and the lead goes back to the queue.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Release', style: 'destructive', onPress: releaseAndExit },
    ])
  }

  return (
    <View style={styles.form}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Field label="Status">
        <ChipSelect options={STATUS_OPTIONS as any} value={status} onChange={(v) => setStatus(v as Status)} />
      </Field>

      {status === 'visit_fixed' && (
        <>
          <Field label="Sales Executive *">
            <ExecAssignPicker value={assignedExecId} onChange={setAssignedExecId} required />
          </Field>
          <View style={styles.field}>
            <DateTimeField label="Visit Date *" value={visitDate} onChange={setVisitDate} mode="date" minimumDate={new Date()} placeholder="Pick a date" />
          </View>
          <View style={styles.field}>
            <DateTimeField label="Visit Time" value={visitTime} onChange={setVisitTime} mode="time" placeholder="Pick a time" />
          </View>
        </>
      )}

      {status === 'call_back' && (
        <>
          <View style={styles.field}>
            <DateTimeField label="Callback Due *" value={callbackDue} onChange={setCallbackDue} mode="datetime" minimumDate={new Date()} placeholder="Pick date & time" />
          </View>
          <Field label="Reason">
            <TextInput style={styles.input} value={callbackReason} onChangeText={setCallbackReason} placeholder="e.g. asked to call after 6pm" placeholderTextColor="#9ca3af" />
          </Field>
        </>
      )}

      <Field label="Roof Type">
        <ChipSelect options={ROOF_OPTIONS as any} value={roofType as any} onChange={setRoofType} />
      </Field>

      <Field label="Ownership">
        <ChipSelect options={OWNERSHIP_OPTIONS as any} value={ownership as any} onChange={setOwnership} />
      </Field>

      <Field label="Property Type">
        <ChipSelect options={PROPERTY_OPTIONS as any} value={propertyType as any} onChange={setPropertyType} />
      </Field>

      <Field label="Monthly Bill (₹)">
        <TextInput style={styles.input} value={billAmount} onChangeText={setBillAmount} keyboardType="numeric" placeholder="e.g. 3000" placeholderTextColor="#9ca3af" />
      </Field>

      <View style={styles.row2}>
        <View style={styles.col}>
          <Field label="Quote Min (₹)">
            <TextInput style={styles.input} value={quoteMin} onChangeText={setQuoteMin} keyboardType="numeric" placeholderTextColor="#9ca3af" />
          </Field>
        </View>
        <View style={styles.col}>
          <Field label="Quote Max (₹)">
            <TextInput style={styles.input} value={quoteMax} onChangeText={setQuoteMax} keyboardType="numeric" placeholderTextColor="#9ca3af" />
          </Field>
        </View>
      </View>

      <View style={styles.switchRow}>
        <Switch value={competitorContacted} onValueChange={setCompetitorContacted} />
        <Text style={styles.switchLabel}>Customer contacted a competitor</Text>
      </View>

      <Field label="Notes">
        <TextInput
          style={[styles.input, styles.textarea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Call notes…"
          placeholderTextColor="#9ca3af"
          multiline
          numberOfLines={3}
        />
      </Field>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={handleRelease}>
          <Text style={styles.secondaryBtnText}>Release Lead</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.primaryBtn, submitting && styles.btnDisabled]} onPress={onSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#052e16" /> : <Text style={styles.primaryBtnText}>Save</Text>}
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
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  switchLabel: { fontSize: 13, color: '#374151', flexShrink: 1 },
  errorBox: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 10, marginBottom: 14 },
  errorText: { color: '#b91c1c', fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  secondaryBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db' },
  secondaryBtnText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  primaryBtn: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 10, backgroundColor: '#4ade80', alignItems: 'center', justifyContent: 'center', minWidth: 80 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 13, color: '#052e16', fontWeight: '700' },
})
