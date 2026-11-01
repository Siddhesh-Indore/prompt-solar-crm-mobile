// src/components/sales/VisitsBoard.tsx
// The sales exec's Visits screen as a stage board: swipeable stage tabs with
// counts, or the same visits grouped into time slots. A phone is too narrow
// for side-by-side Kanban columns, so one column shows at a time.
//
// Cards move on their own — a lead's stage is derived from its visit reports
// and intake form (see lib/visitBoard), never set by hand.
import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useQueryClient } from '@tanstack/react-query'
import { useLeads } from '@/hooks/useLeads'
import { useLeadVisitInfo, useAdvancePendingLeads, useDoneLeads, useLostLeads } from '@/hooks/useVisitBoard'
import {
  BOARD_STAGES, DATE_SLOTS, EMPTY_VISIT_INFO, classifyActiveLead, compareByLastVisitOldest, compareByVisit,
  dateSlot, daysSince, type BoardStage, type DateSlot, type LeadVisitInfo,
} from '@/lib/visitBoard'
import VisitCard from '@/components/sales/VisitCard'
import type { Lead } from '@/types/sales'

const ACTIVE_STAGES: Lead['stage'][] = ['visit_fixed', 'visited']
// Past this many days without a visit, a waiting customer is flagged red.
const STALE_AFTER_DAYS = 7

type ViewMode = 'stage' | 'date'
type Row = { kind: 'header'; slot: DateSlot; title: string; count: number } | { kind: 'lead'; lead: Lead }

function ordinal(n: number): string {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`
}

function Pill({ text, tone }: { text: string; tone: 'blue' | 'amber' | 'violet' | 'red' | 'green' | 'gray' }) {
  return (
    <View style={[styles.pill, pillTones[tone].box]}>
      <Text style={[styles.pillText, pillTones[tone].text]}>{text}</Text>
    </View>
  )
}

function cardBadges(stage: BoardStage, lead: Lead, info: LeadVisitInfo) {
  const pills: { text: string; tone: Parameters<typeof Pill>[0]['tone'] }[] = []

  if (stage === 'first_visit') {
    pills.push({ text: '1st visit', tone: 'blue' })
  } else if (stage === 'follow_up') {
    pills.push(
      lead.stage === 'visit_fixed'
        ? { text: `${ordinal(info.visitCount + 1)} visit scheduled`, tone: 'violet' }
        : { text: `Follow-up · ${info.visitCount} visit${info.visitCount === 1 ? '' : 's'} done`, tone: 'violet' },
    )
  } else if (stage === 'intake_pending') {
    pills.push({ text: `Finalized on visit ${info.visitCount}`, tone: 'green' })
  }

  if ((stage === 'first_visit' || stage === 'follow_up') && lead.stage === 'visit_fixed' && dateSlot(lead.visit_date) === 'overdue') {
    pills.push({ text: 'Overdue', tone: 'red' })
  }

  if (info.lastVisitedAt && (stage === 'follow_up' || stage === 'intake_pending')) {
    const days = daysSince(info.lastVisitedAt)
    pills.push({
      text: days === 0 ? 'Visited today' : `Last visited ${days} day${days === 1 ? '' : 's'} ago`,
      tone: days >= STALE_AFTER_DAYS ? 'red' : 'gray',
    })
  }
  return pills
}

interface Props {
  execId: string
  onOpenDetail: (lead: Lead) => void
}

export default function VisitsBoard({ execId, onOpenDetail }: Props) {
  const queryClient = useQueryClient()
  const [view, setView] = useState<ViewMode>('stage')
  const [stage, setStage] = useState<BoardStage>('first_visit')

  const { data: activeLeads = [], isLoading: leadsLoading, refetch: refetchLeads, isRefetching } = useLeads({ stageIn: ACTIVE_STAGES, assignedExecId: execId })
  const leadIds = useMemo(() => activeLeads.map((l) => l.id), [activeLeads])
  const { data: infoMap, isLoading: infoLoading } = useLeadVisitInfo(leadIds)
  const { data: advanceLeads = [] } = useAdvancePendingLeads(execId)
  const { data: doneLeads = [], isLoading: doneLoading } = useDoneLeads(execId, stage === 'done')
  const { data: lostLeads = [], isLoading: lostLoading } = useLostLeads(execId, stage === 'lost')

  const infoFor = (id: string): LeadVisitInfo => infoMap?.get(id) ?? EMPTY_VISIT_INFO

  // Classification needs the visit reports — without them every lead would
  // read as "0 visits" and land in First Visit.
  const waitingOnInfo = leadIds.length > 0 && (infoLoading || !infoMap)

  const byStage = useMemo(() => {
    const buckets: Record<BoardStage, Lead[]> = { first_visit: [], follow_up: [], intake_pending: [], advance_pending: advanceLeads, done: doneLeads, lost: lostLeads }
    if (!infoMap) return buckets
    const get = (id: string) => infoMap.get(id) ?? EMPTY_VISIT_INFO
    for (const lead of activeLeads) {
      const s = classifyActiveLead(lead, get(lead.id))
      if (s === 'first_visit' || s === 'follow_up' || s === 'intake_pending') buckets[s].push(lead)
    }
    buckets.first_visit.sort(compareByVisit(get))
    buckets.follow_up.sort(compareByVisit(get))
    buckets.intake_pending.sort(compareByLastVisitOldest(get))
    return buckets
  }, [activeLeads, infoMap, advanceLeads, doneLeads, lostLeads])

  // The time-slot view covers customers with a visit to plan around —
  // intake / advance pending have no visit date to slot by.
  const dateRows = useMemo<Row[]>(() => {
    const scheduled = [...byStage.first_visit, ...byStage.follow_up].sort(compareByVisit((id) => infoMap?.get(id) ?? EMPTY_VISIT_INFO))
    const rows: Row[] = []
    for (const slot of DATE_SLOTS) {
      const inSlot = scheduled.filter((l) => dateSlot(l.visit_date) === slot.value)
      if (inSlot.length === 0) continue
      rows.push({ kind: 'header', slot: slot.value, title: slot.label, count: inSlot.length })
      for (const lead of inSlot) rows.push({ kind: 'lead', lead })
    }
    return rows
  }, [byStage.first_visit, byStage.follow_up, infoMap])

  function refreshAll() {
    refetchLeads()
    queryClient.invalidateQueries({ queryKey: ['visit-board'] })
  }

  function renderLead(lead: Lead, s: BoardStage) {
    const history = s === 'done' || s === 'lost' || s === 'advance_pending'
    const badges = history ? [] : cardBadges(s, lead, infoFor(lead.id))
    return (
      <VisitCard
        lead={lead}
        onDone={refreshAll}
        onOpenDetail={() => onOpenDetail(lead)}
        canManage
        showActions={!history}
        extra={badges.length > 0 ? (
          <View style={styles.pillRow}>
            {badges.map((b) => <Pill key={b.text} text={b.text} tone={b.tone} />)}
          </View>
        ) : null}
      />
    )
  }

  const stageList = byStage[stage]
  const stageLoading = (stage === 'done' && doneLoading) || (stage === 'lost' && lostLoading)
  const emptyText = BOARD_STAGES.find((s) => s.value === stage)?.empty ?? ''
  const showHistoryCap = (stage === 'done' || stage === 'lost') && stageList.length > 0

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.viewToggle}>
        {(['stage', 'date'] as const).map((v) => (
          <TouchableOpacity key={v} style={[styles.toggleBtn, view === v && styles.toggleBtnActive]} onPress={() => setView(v)}>
            <Text style={[styles.toggleText, view === v && styles.toggleTextActive]}>{v === 'stage' ? 'By Stage' : 'By Date'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {view === 'stage' && (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {BOARD_STAGES.map((s) => {
              const active = s.value === stage
              // Done / Lost aren't loaded until opened, so they show no count
              // rather than a misleading 0.
              const count = (s.value === 'done' || s.value === 'lost') && s.value !== stage ? null : byStage[s.value].length
              return (
                <TouchableOpacity key={s.value} style={[styles.tab, active && styles.tabActive]} onPress={() => setStage(s.value)}>
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{s.label}</Text>
                  {count !== null && (
                    <View style={[styles.tabCount, active && styles.tabCountActive]}>
                      <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )
            })}
          </ScrollView>
        </View>
      )}

      {leadsLoading || waitingOnInfo || (view === 'stage' && stageLoading) ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4ade80" />
        </View>
      ) : view === 'stage' ? (
        <FlatList
          data={stageList}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refreshAll} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{emptyText}</Text>
            </View>
          }
          ListFooterComponent={showHistoryCap ? <Text style={styles.footerNote}>Showing the 50 most recent.</Text> : null}
          renderItem={({ item }) => renderLead(item, stage)}
        />
      ) : (
        <FlatList
          data={dateRows}
          keyExtractor={(r) => (r.kind === 'header' ? `h-${r.slot}` : r.lead.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refreshAll} />}
          ListHeaderComponent={<Text style={styles.dateNote}>First visits and follow-ups, by when the next visit is due.</Text>}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No visits to plan.</Text>
            </View>
          }
          renderItem={({ item }) =>
            item.kind === 'header' ? (
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, item.slot === 'overdue' && styles.sectionTitleOverdue]}>{item.title}</Text>
                <Text style={styles.sectionCount}>{item.count}</Text>
              </View>
            ) : (
              renderLead(item.lead, classifyActiveLead(item.lead, infoFor(item.lead.id)) ?? 'follow_up')
            )
          }
        />
      )}
    </View>
  )
}

const pillTones = {
  blue: { box: { backgroundColor: '#dbeafe' }, text: { color: '#1d4ed8' } },
  amber: { box: { backgroundColor: '#fef3c7' }, text: { color: '#b45309' } },
  violet: { box: { backgroundColor: '#ede9fe' }, text: { color: '#6d28d9' } },
  red: { box: { backgroundColor: '#fee2e2' }, text: { color: '#b91c1c' } },
  green: { box: { backgroundColor: '#d1fae5' }, text: { color: '#047857' } },
  gray: { box: { backgroundColor: '#f3f4f6' }, text: { color: '#4b5563' } },
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewToggle: { flexDirection: 'row', alignSelf: 'flex-start', marginHorizontal: 20, marginTop: 4, marginBottom: 10, padding: 3, borderRadius: 10, backgroundColor: '#f3f4f6' },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  toggleBtnActive: { backgroundColor: '#fff' },
  toggleText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  toggleTextActive: { color: '#111827' },
  tabs: { paddingHorizontal: 16, paddingBottom: 6, gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  tabActive: { backgroundColor: '#4ade80', borderColor: '#4ade80' },
  tabText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  tabTextActive: { color: '#052e16', fontWeight: '700' },
  tabCount: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: '#f3f4f6', alignItems: 'center' },
  tabCountActive: { backgroundColor: '#052e16' },
  tabCountText: { fontSize: 11, fontWeight: '700', color: '#4b5563' },
  tabCountTextActive: { color: '#4ade80' },
  listContent: { padding: 16, gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#4b5563', textAlign: 'center', paddingHorizontal: 30 },
  footerNote: { fontSize: 11, color: '#9ca3af', textAlign: 'center', paddingVertical: 8 },
  dateNote: { fontSize: 12, color: '#6b7280', marginBottom: 10 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#111827' },
  sectionTitleOverdue: { color: '#b91c1c' },
  sectionCount: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  pill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
  pillText: { fontSize: 11, fontWeight: '600' },
})
