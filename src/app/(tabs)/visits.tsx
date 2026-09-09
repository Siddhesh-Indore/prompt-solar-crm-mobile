// src/app/(tabs)/visits.tsx
// Sales exec's visit list — leads at visit_fixed (upcoming) or visited
// (post-visit, pending intake form). Mirrors the web CRM's VisitsPage. A lead
// only unlocks the client intake form once its latest visit report outcome
// is 'finalized'. Telecaller also reaches this screen (084) but read-only —
// they can look up a lead's visit history for coordination, not log or edit
// one themselves; they don't have visits of their own, so they see every
// lead with a visit fixed/pending, same scope as admin/manager.
import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLeads } from '@/hooks/useLeads'
import { useAuth } from '@/context/AuthContext'
import { useLatestVisitOutcome } from '@/hooks/useVisitReports'
import { useClientIntakeForm } from '@/hooks/useClientIntake'
import LeadSourceBadge from '@/components/sales/badges/LeadSourceBadge'
import StageBadge from '@/components/sales/badges/StageBadge'
import PostVisitForm from '@/components/sales/PostVisitForm'
import PreVisitCallForm from '@/components/sales/PreVisitCallForm'
import ClientIntakeForm from '@/components/sales/ClientIntakeForm'
import ReassignToTelecallerForm from '@/components/sales/ReassignToTelecallerForm'
import LeadDetailModal from '@/components/sales/LeadDetailModal'
import FormSheet from '@/components/sales/FormSheet'
import type { Lead } from '@/types/sales'

function formatDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function VisitCard({ lead, onDone, onOpenDetail, canManage }: { lead: Lead; onDone: () => void; onOpenDetail: () => void; canManage: boolean }) {
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

      {!canManage ? (
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
    </View>
  )
}

const VISIT_FILTERS_STAGES: Lead['stage'][] = ['visit_fixed', 'visited']

export default function VisitsScreen() {
  const { user, profile } = useAuth()
  // Admin/manager can already fill an intake form for any lead per RLS
  // (client_intake_forms_insert allows admin/manager/sales_exec) — this
  // screen used to hard-filter to assignedExecId regardless of role, so
  // there was nothing to see or tap "Fill Client Intake Form" on even
  // though the submit itself would have gone through.
  const isTelecaller = profile?.role === 'telecaller'
  const seesEveryVisit = profile?.role === 'admin' || profile?.role === 'manager'
  // Telecaller has no visits of their own to filter to — read-only, so they
  // see every lead with a visit fixed/pending, same scope as admin/manager.
  const canManage = profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'sales_exec'
  const { data: leads = [], isLoading, refetch, isRefetching } = useLeads(
    user ? { stageIn: VISIT_FILTERS_STAGES, ...(seesEveryVisit || isTelecaller ? {} : { assignedExecId: user.id }) } : undefined,
    { enabled: !!user }
  )
  const [detailLead, setDetailLead] = useState<Lead | null>(null)

  const myVisits = useMemo(() => {
    return [...leads].sort((a, b) => (a.visit_date ?? '').localeCompare(b.visit_date ?? ''))
  }, [leads])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Visits</Text>
        <Text style={styles.subtitle}>{seesEveryVisit || isTelecaller ? 'Every lead with a visit fixed or pending intake form' : 'Leads assigned to you for a site visit'}</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4ade80" />
        </View>
      ) : (
        <FlatList
          data={myVisits}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No visits scheduled</Text>
              <Text style={styles.emptySubtitle}>
                {seesEveryVisit || isTelecaller ? 'Leads with a visit fixed will show up here.' : 'Leads assigned to you with a visit fixed will show up here.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => <VisitCard lead={item} onDone={refetch} onOpenDetail={() => setDetailLead(item)} canManage={canManage} />}
        />
      )}

      <LeadDetailModal lead={detailLead} onClose={() => setDetailLead(null)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  listContent: { padding: 16, gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  emptySubtitle: { fontSize: 12, color: '#9ca3af', marginTop: 4, textAlign: 'center', paddingHorizontal: 30 },
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
})
