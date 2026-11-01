// src/components/sales/VisitCard.tsx
// One lead on the Visits screen: details, plus whichever action its progress
// unlocks (pre-visit call, record visit, intake form, send back, mark advance
// received). Shared by the plain list (admin / manager / telecaller) and the
// sales exec's stage board. A lead only unlocks the client intake form once
// its latest visit report outcome is 'finalized'.
import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useLatestVisitOutcome } from '@/hooks/useVisitReports'
import { useClientIntakeForm } from '@/hooks/useClientIntake'
import LeadSourceBadge from '@/components/sales/badges/LeadSourceBadge'
import StageBadge from '@/components/sales/badges/StageBadge'
import PostVisitForm from '@/components/sales/PostVisitForm'
import PreVisitCallForm from '@/components/sales/PreVisitCallForm'
import ClientIntakeForm from '@/components/sales/ClientIntakeForm'
import ReassignToTelecallerForm from '@/components/sales/ReassignToTelecallerForm'
import AdvanceReceivedForm from '@/components/sales/AdvanceReceivedForm'
import FormSheet from '@/components/sales/FormSheet'
import type { Lead } from '@/types/sales'

function formatDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface VisitCardProps {
  lead: Lead
  onDone: () => void
  onOpenDetail: () => void
  canManage: boolean
  /** Badges / status line shown under the lead's details (visit number, last visited, ...). */
  extra?: React.ReactNode
  /** False for history cards (Done / Lost) and Advance Pending: only the details and, where it applies, "Mark Advance Received". */
  showActions?: boolean
}

export default function VisitCard({ lead, onDone, onOpenDetail, canManage, extra, showActions = true }: VisitCardProps) {
  const [receivingAdvance, setReceivingAdvance] = useState(false)
  const [recording, setRecording] = useState(false)
  const [loggingCall, setLoggingCall] = useState(false)
  const [fillingIntake, setFillingIntake] = useState(false)
  const [sendingToTelecaller, setSendingToTelecaller] = useState(false)
  const outcome = useLatestVisitOutcome(lead.id)
  const { data: intakeForm } = useClientIntakeForm(lead.id)

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardTop} onPress={onOpenDetail} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <Text style={styles.leadName}>{lead.name}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>📞 {lead.phone}</Text>
            {lead.address && <Text style={styles.metaText}>📍 {lead.address}</Text>}
          </View>
          {lead.visit_date && (
            <Text style={styles.metaText}>🗓 {formatDate(lead.visit_date)} {lead.visit_time ?? ''}</Text>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <LeadSourceBadge source={lead.source} />
          <StageBadge stage={lead.stage} />
        </View>
      </TouchableOpacity>

      {extra}

      {!showActions ? null : !canManage ? (
        intakeForm ? (
          <Text style={styles.hintDone}>Intake form submitted.</Text>
        ) : (
          <Text style={styles.hint}>{outcome === 'finalized' ? 'Awaiting client intake form.' : 'Awaiting the site visit / follow-up.'}</Text>
        )
      ) : (
        <>
          {(lead.stage === 'visit_fixed' || (lead.stage === 'visited' && outcome !== 'finalized')) && !recording && !loggingCall && (
            <>
              {lead.stage === 'visited' && (
                <Text style={styles.hint}>Awaiting follow-up — log another visit below if you've been back.</Text>
              )}
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => setLoggingCall(true)}>
                  <Text style={styles.secondaryBtnText}>Log Pre-Visit Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => setRecording(true)}>
                  <Text style={styles.primaryBtnText}>Record Visit</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {lead.stage === 'visited' && outcome === 'finalized' && !intakeForm && !fillingIntake && (
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => setFillingIntake(true)}>
                <Text style={styles.primaryBtnText}>Fill Client Intake Form</Text>
              </TouchableOpacity>
            </View>
          )}

          {intakeForm && <Text style={styles.hintDone}>Intake form submitted.</Text>}

          {!intakeForm && !sendingToTelecaller && (
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => setSendingToTelecaller(true)}>
                <Text style={styles.secondaryBtnText}>Send to Telecaller</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {canManage && intakeForm?.advance_mode === 'none' && (
        <View style={styles.advanceBox}>
          <Text style={styles.advanceTitle}>Advance not paid yet</Text>
          {intakeForm.advance_note ? <Text style={styles.advanceNote}>{intakeForm.advance_note}</Text> : null}
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setReceivingAdvance(true)}>
            <Text style={styles.primaryBtnText}>Mark Advance Received</Text>
          </TouchableOpacity>
        </View>
      )}

      <FormSheet visible={loggingCall} title="Log Pre-Visit Call" onClose={() => setLoggingCall(false)}>
        <PreVisitCallForm lead={lead} onDone={() => { setLoggingCall(false); onDone() }} onCancel={() => setLoggingCall(false)} />
      </FormSheet>

      <FormSheet visible={recording} title="Record Visit" onClose={() => setRecording(false)}>
        <PostVisitForm lead={lead} onDone={() => { setRecording(false); onDone() }} onCancel={() => setRecording(false)} />
      </FormSheet>

      <FormSheet visible={fillingIntake} title="Client Intake Form" onClose={() => setFillingIntake(false)}>
        <ClientIntakeForm lead={lead} onDone={() => { setFillingIntake(false); onDone() }} onCancel={() => setFillingIntake(false)} />
      </FormSheet>

      <FormSheet visible={sendingToTelecaller} title="Send Back to Telecaller" onClose={() => setSendingToTelecaller(false)}>
        <ReassignToTelecallerForm lead={lead} onDone={() => { setSendingToTelecaller(false); onDone() }} onCancel={() => setSendingToTelecaller(false)} />
      </FormSheet>
      {intakeForm && (
        <FormSheet visible={receivingAdvance} title="Advance Received" onClose={() => setReceivingAdvance(false)}>
          <AdvanceReceivedForm form={intakeForm} onDone={() => { setReceivingAdvance(false); onDone() }} onCancel={() => setReceivingAdvance(false)} />
        </FormSheet>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  leadName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  metaText: { fontSize: 12, color: '#6b7280' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  secondaryBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db' },
  secondaryBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  primaryBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#4ade80' },
  primaryBtnText: { fontSize: 12, fontWeight: '700', color: '#052e16' },
  hint: { fontSize: 12, color: '#9ca3af', marginTop: 10 },
  hintDone: { fontSize: 12, color: '#047857', marginTop: 10 },
  advanceBox: { marginTop: 12, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 10, padding: 10, gap: 6, alignItems: 'flex-start' },
  advanceTitle: { fontSize: 12, fontWeight: '700', color: '#b45309' },
  advanceNote: { fontSize: 12, color: '#78350f' },
})
