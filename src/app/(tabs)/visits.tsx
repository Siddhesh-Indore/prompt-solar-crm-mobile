// src/app/(tabs)/visits.tsx
// Visits. Sales exec gets a stage board (VisitsBoard) — First Visit, Follow-up,
// Intake Pending, Advance Pending, Done, Lost — that sorts itself as visits
// are logged. Admin / manager get the plain list of leads at visit_fixed
// (upcoming) or visited (post-visit, pending intake form), mirroring the web
// CRM's VisitsPage. A lead only unlocks the client intake form once its latest
// visit report outcome is 'finalized'. Telecaller also reaches this screen
// (084) but read-only — they can look up a lead's visit history for
// coordination, not log or edit one themselves; they don't have visits of
// their own, so they see every lead with a visit fixed/pending, same scope as
// admin/manager.
import { useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLeads } from '@/hooks/useLeads'
import { useAuth } from '@/context/AuthContext'
import VisitCard from '@/components/sales/VisitCard'
import VisitsBoard from '@/components/sales/VisitsBoard'
import LeadDetailModal from '@/components/sales/LeadDetailModal'
import type { Lead } from '@/types/sales'

const VISIT_FILTERS_STAGES: Lead['stage'][] = ['visit_fixed', 'visited']

export default function VisitsScreen() {
  const { user, profile } = useAuth()
  const router = useRouter()
  // Admin/manager can already fill an intake form for any lead per RLS
  // (client_intake_forms_insert allows admin/manager/sales_exec) — this
  // screen used to hard-filter to assignedExecId regardless of role, so
  // there was nothing to see or tap "Fill Client Intake Form" on even
  // though the submit itself would have gone through.
  const isTelecaller = profile?.role === 'telecaller'
  const isSalesExec = profile?.role === 'sales_exec'
  const seesEveryVisit = profile?.role === 'admin' || profile?.role === 'manager'
  // Telecaller has no visits of their own to filter to — read-only, so they
  // see every lead with a visit fixed/pending, same scope as admin/manager.
  const canManage = profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'sales_exec'
  const { data: leads = [], isLoading, refetch, isRefetching } = useLeads(
    user ? { stageIn: VISIT_FILTERS_STAGES, ...(seesEveryVisit || isTelecaller ? {} : { assignedExecId: user.id }) } : undefined,
    { enabled: !!user && !isSalesExec }
  )
  const [detailLead, setDetailLead] = useState<Lead | null>(null)

  const myVisits = useMemo(() => {
    return [...leads].sort((a, b) => (a.visit_date ?? '').localeCompare(b.visit_date ?? ''))
  }, [leads])

  if (isSalesExec && user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={[styles.header, styles.headerRow]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Visits</Text>
            <Text style={styles.subtitle}>Your customers, by where they are in the visit journey</Text>
          </View>
          <TouchableOpacity style={styles.newLeadBtn} onPress={() => router.push('/new-lead')}>
            <Text style={styles.newLeadBtnText}>+ New Lead</Text>
          </TouchableOpacity>
        </View>
        <VisitsBoard execId={user.id} onOpenDetail={setDetailLead} />
        <LeadDetailModal lead={detailLead} onClose={() => setDetailLead(null)} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[styles.header, styles.headerRow]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Visits</Text>
          <Text style={styles.subtitle}>{seesEveryVisit || isTelecaller ? 'Every lead with a visit fixed or pending intake form' : 'Leads assigned to you for a site visit'}</Text>
        </View>
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
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  newLeadBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#4ade80' },
  newLeadBtnText: { fontSize: 13, fontWeight: '700', color: '#052e16' },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  listContent: { padding: 16, gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  emptySubtitle: { fontSize: 12, color: '#9ca3af', marginTop: 4, textAlign: 'center', paddingHorizontal: 30 },
})
