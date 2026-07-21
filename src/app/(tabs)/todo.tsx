// src/app/(tabs)/todo.tsx
// A sales exec's daily worklist — combines two different sources into one
// list since the app doesn't have a single generic "todo" table:
//   - pending follow_ups assigned to them (one slot per lead, DB-enforced)
//   - their own leads at stage 'visit_fixed' (a scheduled site visit)
// Split into Overdue / Today / Upcoming by comparing each item's date
// against today's date in the device's local timezone.
import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, RefreshControl, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLeads } from '@/hooks/useLeads'
import { useAuth } from '@/context/AuthContext'
import { useMyFollowUps, useCompleteFollowUp } from '@/hooks/useFollowUps'
import LeadDetailModal from '@/components/sales/LeadDetailModal'
import FollowUpSetter from '@/components/sales/FollowUpSetter'
import FormSheet from '@/components/sales/FormSheet'
import type { Lead } from '@/types/sales'

type TodoItem =
  | { kind: 'visit'; sortKey: string; lead: Lead }
  | { kind: 'follow_up'; sortKey: string; id: string; leadId: string; leadName: string; leadPhone: string; dueAt: string; reason: string | null }

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function dateKeyOf(iso: string): string {
  return iso.slice(0, 10)
}

function bucketOf(dateKey: string): 'overdue' | 'today' | 'upcoming' {
  const today = todayKey()
  if (dateKey < today) return 'overdue'
  if (dateKey === today) return 'today'
  return 'upcoming'
}

function formatDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function FollowUpCard({ item, onDone }: { item: Extract<TodoItem, { kind: 'follow_up' }>; onDone: () => void }) {
  const complete = useCompleteFollowUp()
  const [busy, setBusy] = useState(false)
  const [showReplan, setShowReplan] = useState(false)

  async function act(status: 'completed' | 'dismissed') {
    setBusy(true)
    try {
      await complete.mutateAsync({ id: item.id, status })
      if (status === 'dismissed') {
        // Dismissing doesn't mean the lead is closed out — offer to plan the
        // next follow-up/visit right away instead of just losing the lead
        // from view once this card refetches away.
        setShowReplan(true)
      } else {
        onDone()
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update follow-up')
    } finally {
      setBusy(false)
    }
  }

  function confirmDismiss() {
    Alert.alert('Dismiss this follow-up?', `You'll get a chance to plan the next follow-up for ${item.leadName}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Dismiss', style: 'destructive', onPress: () => act('dismissed') },
    ])
  }

  if (showReplan) {
    return (
      <FormSheet visible title="Plan Next Follow-up" onClose={onDone}>
        <Text style={styles.leadName}>{item.leadName}</Text>
        <Text style={styles.reasonText}>Plan the next follow-up, or skip to leave it for later.</Text>
        <View style={{ marginTop: 10 }}>
          <FollowUpSetter leadId={item.leadId} onDone={onDone} onCancel={onDone} />
        </View>
      </FormSheet>
    )
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <View style={styles.kindRow}>
            <Text style={styles.kindTag}>📞 Follow-up</Text>
          </View>
          <Text style={styles.leadName}>{item.leadName}</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.leadPhone}`)}>
            <Text style={styles.leadPhone}>📞 {item.leadPhone}</Text>
          </TouchableOpacity>
          <Text style={styles.dueText}>Due {new Date(item.dueAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
          {item.reason && <Text style={styles.reasonText}>{item.reason}</Text>}
        </View>
      </View>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={confirmDismiss} disabled={busy}>
          <Text style={styles.secondaryBtnText}>Dismiss</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryBtn} onPress={() => act('completed')} disabled={busy}>
          <Text style={styles.primaryBtnText}>{busy ? 'Saving…' : 'Mark Done'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function VisitCard({ lead, onOpenDetail }: { lead: Lead; onOpenDetail: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onOpenDetail} activeOpacity={0.7}>
      <View style={styles.kindRow}>
        <Text style={styles.kindTag}>🚗 Site Visit</Text>
      </View>
      <Text style={styles.leadName}>{lead.name}</Text>
      <Text style={styles.leadPhone}>📞 {lead.phone}</Text>
      {lead.address && <Text style={styles.leadPhone}>📍 {lead.address}</Text>}
      {lead.visit_date && (
        <Text style={styles.dueText}>
          {formatDate(lead.visit_date)} {lead.visit_time ?? ''}
        </Text>
      )}
    </TouchableOpacity>
  )
}

export default function TodoScreen() {
  const { user } = useAuth()
  const { data: leads = [], isLoading: leadsLoading, refetch: refetchLeads, isRefetching: leadsRefetching } = useLeads()
  const { data: followUps = [], isLoading: followUpsLoading, refetch: refetchFollowUps, isRefetching: followUpsRefetching } = useMyFollowUps()
  const [detailLead, setDetailLead] = useState<Lead | null>(null)

  const items = useMemo(() => {
    const visitItems: TodoItem[] = leads
      .filter((l) => l.stage === 'visit_fixed' && l.assigned_exec_id === user?.id && l.visit_date)
      .map((lead) => ({ kind: 'visit' as const, sortKey: lead.visit_date!, lead }))

    const followUpItems: TodoItem[] = followUps
      .filter((f): f is typeof f & { lead: NonNullable<typeof f.lead> } => !!f.lead)
      .map((f) => ({
        kind: 'follow_up' as const,
        sortKey: dateKeyOf(f.due_at),
        id: f.id,
        leadId: f.lead.id,
        leadName: f.lead.name,
        leadPhone: f.lead.phone,
        dueAt: f.due_at,
        reason: f.reason,
      }))

    return [...visitItems, ...followUpItems].sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }, [leads, followUps, user])

  const overdue = items.filter((i) => bucketOf(i.sortKey) === 'overdue')
  const today = items.filter((i) => bucketOf(i.sortKey) === 'today')
  const upcoming = items.filter((i) => bucketOf(i.sortKey) === 'upcoming')

  const isLoading = leadsLoading || followUpsLoading
  const isRefetching = leadsRefetching || followUpsRefetching

  function refetchAll() {
    refetchLeads()
    refetchFollowUps()
  }

  const sections: { title: string; data: TodoItem[] }[] = [
    { title: `Today (${today.length})`, data: today },
    { title: `Overdue (${overdue.length})`, data: overdue },
    { title: `Upcoming (${upcoming.length})`, data: upcoming },
  ].filter((s) => s.data.length > 0)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>To-Do</Text>
        <Text style={styles.subtitle}>Your visits and follow-ups</Text>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4ade80" />
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(s) => s.title}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetchAll} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing on your list</Text>
              <Text style={styles.emptySubtitle}>Visits and follow-ups assigned to you will show up here.</Text>
            </View>
          }
          renderItem={({ item: section }) => (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.data.map((item) =>
                item.kind === 'visit' ? (
                  <VisitCard key={`visit-${item.lead.id}`} lead={item.lead} onOpenDetail={() => setDetailLead(item.lead)} />
                ) : (
                  <FollowUpCard key={`fu-${item.id}`} item={item} onDone={refetchAll} />
                ),
              )}
            </View>
          )}
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
  listContent: { padding: 16, gap: 4 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  emptySubtitle: { fontSize: 12, color: '#9ca3af', marginTop: 4, textAlign: 'center', paddingHorizontal: 30 },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 8 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row' },
  kindRow: { flexDirection: 'row', marginBottom: 4 },
  kindTag: { fontSize: 11, fontWeight: '600', color: '#6b7280' },
  leadName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  leadPhone: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  dueText: { fontSize: 12, color: '#b45309', marginTop: 4, fontWeight: '600' },
  reasonText: { fontSize: 12, color: '#6b7280', marginTop: 4, fontStyle: 'italic' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  secondaryBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' },
  secondaryBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  primaryBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: '#4ade80', alignItems: 'center' },
  primaryBtnText: { fontSize: 12, fontWeight: '700', color: '#052e16' },
})
