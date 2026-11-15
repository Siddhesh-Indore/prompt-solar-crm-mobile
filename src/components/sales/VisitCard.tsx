// src/components/sales/VisitCard.tsx
// One lead on the Visits screen: details, plus whichever action its progress
// unlocks (pre-visit call, record visit, intake form, send back, mark advance
// received). Shared by the plain list (admin / manager / telecaller) and the
// sales exec's stage board. A lead only unlocks the client intake form once
// its latest visit report outcome is 'finalized'.
import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
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
import { brand } from '@/constants/brand'
import { dateSlot } from '@/lib/visitBoard'
import { mapsLinkFor } from '@/lib/share'
import { hapticSelect } from '@/lib/haptics'

function formatDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// One size for every button on the card (Call, Navigate, Record Visit,
// Pre-Visit Call, Send to Telecaller, ...), so none looks bigger than another.
// Small and quiet on purpose: outlined by default, with a single filled brand
// button for the action that moves the customer forward.
const BUTTON_FONT_SIZE = 12
const BUTTON_ICON_SIZE = 15
const BUTTON_HEIGHT = 36

type ActionVariant = 'primary' | 'ghost' | 'muted'

function ActionButton({ variant, icon, label, onPress, wide }: { variant: ActionVariant; icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; wide?: boolean }) {
  const color = variant === 'primary' ? brand.onGreen : variant === 'ghost' ? brand.navy : brand.muted
  return (
    <TouchableOpacity
      style={[styles.actionBtn, variant === 'primary' ? styles.actionBtnPrimary : styles.actionBtnOutline, wide ? styles.actionBtnWide : styles.actionBtnHalf]}
      onPress={() => { hapticSelect(); onPress() }}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={BUTTON_ICON_SIZE} color={color} />
      <Text style={[styles.actionBtnText, { color }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  )
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

  const canRecord = (lead.stage === 'visit_fixed' || (lead.stage === 'visited' && outcome !== 'finalized')) && !recording && !loggingCall
  const canFillIntake = lead.stage === 'visited' && outcome === 'finalized' && !intakeForm && !fillingIntake
  const canSendBack = !intakeForm && !sendingToTelecaller

  // Same status colours used across the app: overdue red, today navy.
  const slot = lead.visit_date ? dateSlot(lead.visit_date) : null
  const visitDateColor = slot === 'overdue' ? brand.danger : slot === 'today' ? brand.navy : brand.muted

  function callLead() {
    hapticSelect()
    Linking.openURL(`tel:${lead.phone}`)
  }

  function navigateToLead() {
    hapticSelect()
    if (lead.address) Linking.openURL(mapsLinkFor(lead.address))
  }

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardTop} onPress={onOpenDetail} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <Text style={styles.leadName}>{lead.name}</Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="call-outline" size={13} color={brand.muted} />
              <Text style={styles.metaText}>{lead.phone}</Text>
            </View>
            {lead.address && (
              <View style={[styles.metaItem, { flexShrink: 1 }]}>
                <Ionicons name="location-outline" size={13} color={brand.muted} />
                <Text style={[styles.metaText, { flexShrink: 1 }]} numberOfLines={2}>{lead.address}</Text>
              </View>
            )}
          </View>
          {lead.visit_date && (
            <View style={[styles.metaItem, { marginTop: 4 }]}>
              <Ionicons name="calendar-outline" size={13} color={visitDateColor} />
              <Text style={[styles.metaText, { color: visitDateColor, fontWeight: '600' }]}>
                {formatDate(lead.visit_date)} {lead.visit_time ?? ''}
              </Text>
            </View>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <LeadSourceBadge source={lead.source} />
          <StageBadge stage={lead.stage} />
        </View>
      </TouchableOpacity>

      {extra}

      {showActions && canManage && lead.stage === 'visited' && canRecord && (
        <Text style={styles.hint}>Awaiting follow-up — log another visit below if you've been back.</Text>
      )}

      <View style={styles.buttonGrid}>
        {showActions && canManage && canRecord && <ActionButton variant="primary" icon="clipboard-outline" label="Record Visit" onPress={() => setRecording(true)} wide />}
        <ActionButton variant="ghost" icon="call-outline" label="Call" onPress={callLead} />
        {lead.address ? <ActionButton variant="ghost" icon="navigate-outline" label="Navigate" onPress={navigateToLead} /> : null}
        {showActions && canManage && canRecord && <ActionButton variant="ghost" icon="call-outline" label="Pre-Visit Call" onPress={() => setLoggingCall(true)} />}
        {showActions && canManage && canSendBack && <ActionButton variant="muted" icon="arrow-undo-outline" label="Send to Telecaller" onPress={() => setSendingToTelecaller(true)} />}
      </View>

      {showActions && !canManage && (
        intakeForm ? (
          <Text style={styles.hintDone}>Intake form submitted.</Text>
        ) : (
          <Text style={styles.hint}>{outcome === 'finalized' ? 'Awaiting client intake form.' : 'Awaiting the site visit / follow-up.'}</Text>
        )
      )}

      {showActions && canManage && canFillIntake && (
        <View style={styles.wideRow}>
          <ActionButton variant="primary" icon="document-text-outline" label="Fill Client Intake Form" onPress={() => setFillingIntake(true)} wide />
        </View>
      )}

      {showActions && canManage && intakeForm && <Text style={styles.hintDone}>Intake form submitted.</Text>}

      {canManage && intakeForm?.advance_mode === 'none' && (
        <View style={styles.advanceBox}>
          <Text style={styles.advanceTitle}>Advance not paid yet</Text>
          {intakeForm.advance_note ? <Text style={styles.advanceNote}>{intakeForm.advance_note}</Text> : null}
          <View style={styles.wideRow}>
            <ActionButton variant="primary" icon="cash-outline" label="Mark Advance Received" onPress={() => setReceivingAdvance(true)} wide />
          </View>
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
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: brand.borderLight, borderRadius: 14, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  leadName: { fontSize: 15, fontWeight: '600', color: brand.ink },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  metaText: { fontSize: 12, color: brand.muted },
  buttonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  wideRow: { marginTop: 8 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: BUTTON_HEIGHT, paddingHorizontal: 10, borderRadius: 10 },
  actionBtnHalf: { flexBasis: '48.5%', flexGrow: 0 },
  actionBtnWide: { width: '100%' },
  actionBtnPrimary: { backgroundColor: brand.green },
  actionBtnOutline: { backgroundColor: brand.white, borderWidth: 1, borderColor: brand.border },
  actionBtnText: { fontSize: BUTTON_FONT_SIZE, fontWeight: '600', flexShrink: 1 },
  hint: { fontSize: 12, color: brand.faint, marginTop: 10 },
  hintDone: { fontSize: 12, color: brand.greenDark, marginTop: 10 },
  advanceBox: { marginTop: 12, backgroundColor: brand.warningSoft, borderWidth: 1, borderColor: brand.warningBorder, borderRadius: 10, padding: 10, gap: 2, alignItems: 'stretch' },
  advanceTitle: { fontSize: 12, fontWeight: '700', color: brand.warning },
  advanceNote: { fontSize: 12, color: '#78350f' },
})
