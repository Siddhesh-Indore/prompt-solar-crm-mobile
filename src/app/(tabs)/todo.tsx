// src/app/(tabs)/todo.tsx
// A sales exec's daily worklist — combines two different sources into one
// list since the app doesn't have a single generic "todo" table:
//   - pending follow_ups assigned to them (one slot per lead, DB-enforced)
//   - their own leads at stage 'visit_fixed' (a scheduled site visit)
// Split into Overdue / Today / Upcoming by comparing each item's date
// against today's date in the device's local timezone. Visits are the same
// cards as on the Visits tab, so a visit can be called, recorded or sent back
// from here.
import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, RefreshControl, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLeads } from '@/hooks/useLeads'
import { useAuth } from '@/context/AuthContext'
import { useMyFollowUps, useCompleteFollowUp } from '@/hooks/useFollowUps'
import LeadDetailModal from '@/components/sales/LeadDetailModal'
import SharedVisitCard from '@/components/sales/VisitCard'
import { localDateKey, daysUntil } from '@/lib/visitBoard'
import FollowUpSetter from '@/components/sales/FollowUpSetter'
import FormSheet from '@/components/sales/FormSheet'
import type { Lead } from '@/types/sales'
import { brand } from '@/constants/brand'
import { SkeletonList } from '@/components/ui/Skeleton'

type TodoItem =
  | { kind: 'visit'; sortKey: string; lead: Lead }
  | { kind: 'follow_up'; sortKey: string; id: string; leadId: string; leadName: string; leadPhone: string; dueAt: string; reason: string | null }

function todayKey(): string {
  return localDateKey()
}

// A follow-up's due_at is a timestamp — take its date in local time, not
// UTC, so one due at 1am IST doesn't count as yesterday's.
function dateKeyOf(iso: string): string {
  return localDateKey(new Date(iso))
}

function bucketOf(dateKey: string): 'overdue' | 'today' | 'upcoming' {
  const today = todayKey()
  if (dateKey < today) return 'overdue'
  if (dateKey === today) return 'today'
  return 'upcoming'
}

type RangeFilter = 'today' | 'week' | 'all'

const RANGE_OPTIONS: { value: RangeFilter; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'all', label: 'All' },
]

// Last day of the current calendar week (Sunday), local time.
function endOfWeekKey(): string {
  const d = new Date()
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7))
  return localDateKey(d)
}

// Overdue always shows — a missed visit is the thing most worth seeing.
function inRange(dateKey: string, range: RangeFilter): boolean {
  if (range === 'all') return true
  if (dateKey <= todayKey()) return true
  return range === 'week' && dateKey <= endOfWeekKey()
}

function dayTitle(dateKey: string): string {
  const diff = daysUntil(dateKey)
  return diff === 1 ? `Tomorrow · ${formatDate(dateKey)}` : formatDate(dateKey)
}

// Same status colours as the rest of the app: overdue red, today navy, later grey.
const DUE_COLOR = { overdue: brand.danger, today: brand.navy, upcoming: brand.muted } as const

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
          <Text style={[styles.dueText, { color: DUE_COLOR[bucketOf(dateKeyOf(item.dueAt))] }]}>Due {new Date(item.dueAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
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

export default function TodoScreen() {
  const { user, profile } = useAuth()
  const showsVisits = profile?.role === 'sales_exec' || profile?.role === 'admin' || profile?.role === 'manager'
  // Scoped to this exec's own visit_fixed leads (a naturally small set)
  // rather than the old useLeads() + client-side filter over every lead in
  // the table. Telecallers never see visits here, so skip the fetch entirely.
  const { data: leads = [], isLoading: leadsLoading, refetch: refetchLeads, isRefetching: leadsRefetching } = useLeads(
    user ? { stage: 'visit_fixed', assignedExecId: user.id } : undefined,
    { enabled: !!user && showsVisits }
  )
  const { data: followUps = [], isLoading: followUpsLoading, refetch: refetchFollowUps, isRefetching: followUpsRefetching } = useMyFollowUps()
  const [detailLead, setDetailLead] = useState<Lead | null>(null)
  const [range, setRange] = useState<RangeFilter>('today')

  const items = useMemo(() => {
    const visitItems: TodoItem[] = leads
      .filter((l) => l.visit_date)
      .map((lead) => ({ kind: 'visit' as const, sortKey: `${lead.visit_date!.slice(0, 10)} ${lead.visit_time ?? '00:00'}`, lead }))

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
  }, [leads, followUps])

  const visible = useMemo(() => items.filter((i) => inRange(i.sortKey.slice(0, 10), range)), [items, range])
  const overdue = visible.filter((i) => bucketOf(i.sortKey.slice(0, 10)) === 'overdue')
  const today = visible.filter((i) => bucketOf(i.sortKey.slice(0, 10)) === 'today')
  const upcoming = visible.filter((i) => bucketOf(i.sortKey.slice(0, 10)) === 'upcoming')

  // Counts on the chips are for the whole list, so each one shows what
  // switching to it would reveal.
  const rangeCounts: Record<RangeFilter, number> = {
    today: items.filter((i) => inRange(i.sortKey.slice(0, 10), 'today')).length,
    week: items.filter((i) => inRange(i.sortKey.slice(0, 10), 'week')).length,
    all: items.length,
  }

  const isLoading = leadsLoading || followUpsLoading
  const isRefetching = leadsRefetching || followUpsRefetching

  function refetchAll() {
    refetchLeads()
    refetchFollowUps()
  }

  // Upcoming is split per day so a week reads as a schedule.
  const upcomingByDay = new Map<string, TodoItem[]>()
  for (const item of upcoming) {
    const key = item.sortKey.slice(0, 10)
    upcomingByDay.set(key, [...(upcomingByDay.get(key) ?? []), item])
  }

  const sections: { title: string; tone: 'overdue' | 'today' | 'upcoming'; data: TodoItem[] }[] = [
    { title: `Today (${today.length})`, tone: 'today' as const, data: today },
    { title: `Overdue (${overdue.length})`, tone: 'overdue' as const, data: overdue },
    ...[...upcomingByDay.entries()].map(([key, data]) => ({ title: `${dayTitle(key)} (${data.length})`, tone: 'upcoming' as const, data })),
  ].filter((s) => s.data.length > 0)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>To-Do</Text>
        <Text style={styles.subtitle}>{showsVisits ? 'Your visits and follow-ups' : 'Your follow-ups'}</Text>
      </View>

      <View style={styles.rangeRow}>
        {RANGE_OPTIONS.map((o) => {
          const active = o.value === range
          return (
            <TouchableOpacity key={o.value} style={[styles.rangeChip, active && styles.rangeChipActive]} onPress={() => setRange(o.value)}>
              <Text style={[styles.rangeChipText, active && styles.rangeChipTextActive]}>{o.label} · {rangeCounts[o.value]}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {isLoading ? (
        <SkeletonList />
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(s) => s.title}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetchAll() }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{range === 'today' ? 'Nothing due today' : range === 'week' ? 'Nothing due this week' : 'Nothing on your list'}</Text>
              <Text style={styles.emptySubtitle}>
                {range === 'all'
                  ? (showsVisits ? 'Visits and follow-ups assigned to you will show up here.' : 'Follow-ups assigned to you will show up here.')
                  : 'Switch the filter above to see what\'s coming up.'}
              </Text>
            </View>
          }
          renderItem={({ item: section }) => (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: DUE_COLOR[section.tone] }]}>{section.title}</Text>
              {section.data.map((item) =>
                item.kind === 'visit' ? (
                  <SharedVisitCard key={`visit-${item.lead.id}`} lead={item.lead} onDone={refetchAll} onOpenDetail={() => setDetailLead(item.lead)} canManage />
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
  safe: { flex: 1, backgroundColor: brand.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: brand.ink },
  subtitle: { fontSize: 13, color: brand.muted, marginTop: 2 },
  rangeRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
  rangeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: brand.border, backgroundColor: '#fff' },
  rangeChipActive: { backgroundColor: brand.green, borderColor: brand.green },
  rangeChipText: { fontSize: 13, fontWeight: '500', color: brand.text },
  rangeChipTextActive: { color: brand.onGreen, fontWeight: '700' },
  listContent: { padding: 16, gap: 4 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: brand.textMuted },
  emptySubtitle: { fontSize: 12, color: brand.faint, marginTop: 4, textAlign: 'center', paddingHorizontal: 30 },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: brand.faint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 8 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: brand.borderLight, borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: 'row' },
  kindRow: { flexDirection: 'row', marginBottom: 4 },
  kindTag: { fontSize: 11, fontWeight: '600', color: brand.muted },
  leadName: { fontSize: 15, fontWeight: '600', color: brand.ink },
  leadPhone: { fontSize: 13, color: brand.muted, marginTop: 2 },
  dueText: { fontSize: 12, color: brand.warning, marginTop: 4, fontWeight: '600' },
  reasonText: { fontSize: 12, color: brand.muted, marginTop: 4, fontStyle: 'italic' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  secondaryBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: brand.border, alignItems: 'center' },
  secondaryBtnText: { fontSize: 12, fontWeight: '600', color: brand.text },
  primaryBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, backgroundColor: brand.green, alignItems: 'center' },
  primaryBtnText: { fontSize: 12, fontWeight: '700', color: brand.onGreen },
})
