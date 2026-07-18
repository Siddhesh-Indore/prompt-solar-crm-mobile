// src/app/(tabs)/visits.tsx
// Sales exec's visit list — leads at visit_fixed (upcoming) or visited
// (post-visit). Mirrors the web CRM's VisitsPage. Client intake form stays
// web-only for now (it's the most complex piece of the spec — cash/loan
// branches, doc checklist, signatures).
import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLeads } from '@/hooks/useLeads'
import { useAuth } from '@/context/AuthContext'
import { useLogCall } from '@/hooks/useCallLogs'
import { useLatestVisitOutcome } from '@/hooks/useVisitReports'
import LeadSourceBadge from '@/components/sales/badges/LeadSourceBadge'
import StageBadge from '@/components/sales/badges/StageBadge'
import PostVisitForm from '@/components/sales/PostVisitForm'
import LeadDetailModal from '@/components/sales/LeadDetailModal'
import type { Lead } from '@/types/sales'

function formatDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function VisitCard({ lead, onDone, onOpenDetail }: { lead: Lead; onDone: () => void; onOpenDetail: () => void }) {
  const logCall = useLogCall()
  const [recording, setRecording] = useState(false)
  const outcome = useLatestVisitOutcome(lead.id)

  async function logPreVisitCall() {
    try {
      await logCall.mutateAsync({ lead_id: lead.id, call_type: 'pre_visit', outcome: 'confirmed' })
      Alert.alert('Logged', 'Pre-visit call logged.')
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to log call')
    }
  }

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

      {lead.stage === 'visit_fixed' && !recording && (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={logPreVisitCall}>
            <Text style={styles.secondaryBtnText}>Log Pre-Visit Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setRecording(true)}>
            <Text style={styles.primaryBtnText}>Record Visit</Text>
          </TouchableOpacity>
        </View>
      )}

      {lead.stage === 'visited' && outcome !== 'finalized' && (
        <Text style={styles.hint}>Awaiting follow-up or next visit.</Text>
      )}

      {lead.stage === 'visited' && outcome === 'finalized' && (
        <Text style={styles.hintDone}>Visit finalized — fill the client intake form on the web app to continue.</Text>
      )}

      {recording && (
        <View style={styles.formWrap}>
          <PostVisitForm lead={lead} onDone={() => { setRecording(false); onDone() }} onCancel={() => setRecording(false)} />
        </View>
      )}
    </View>
  )
}

export default function VisitsScreen() {
  const { user } = useAuth()
  const { data: leads = [], isLoading, refetch, isRefetching } = useLeads()
  const [detailLead, setDetailLead] = useState<Lead | null>(null)

  const myVisits = useMemo(() => {
    return leads
      .filter((l) => (l.stage === 'visit_fixed' || l.stage === 'visited') && l.assigned_exec_id === user?.id)
      .sort((a, b) => (a.visit_date ?? '').localeCompare(b.visit_date ?? ''))
  }, [leads, user])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Visits</Text>
        <Text style={styles.subtitle}>Leads assigned to you for a site visit</Text>
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
              <Text style={styles.emptySubtitle}>Leads assigned to you with a visit fixed will show up here.</Text>
            </View>
          }
          renderItem={({ item }) => <VisitCard lead={item} onDone={refetch} onOpenDetail={() => setDetailLead(item)} />}
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
  formWrap: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
})
