// src/app/employee-timeline.tsx
// Employee Timeline — pick a sales exec and a date, see their visits that
// day in chronological order (mirrors the web CRM's EmployeeTimelinePage,
// minus the embedded Google Map — a "Open in Maps" link per stop covers the
// same need without pulling in a native maps SDK). Read-only: no logging or
// editing here. Telecaller can view ANY exec's day (migration 084) — that's
// the point, checking on a team member's day for coordination.
import { useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, ScrollView, StyleSheet, ActivityIndicator, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useSalesTeam } from '@/hooks/useSalesTeam'
import { useExecDayVisits, type VisitReportWithRelations } from '@/hooks/useVisitReports'
import BackButton from '@/components/BackButton'
import DateTimeField from '@/components/sales/DateTimeField'
import { mapsLinkFor } from '@/lib/share'
import { brand } from '@/constants/brand'

function todayIso() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

const OUTCOME_LABEL: Record<string, string> = {
  finalized: 'Finalized', second_visit: 'Second Visit', follow_up: 'Follow-up', lost: 'Lost',
}

function StopCard({ visit, index }: { visit: VisitReportWithRelations; index: number }) {
  const hasLocation = visit.latitude != null && visit.longitude != null

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.stopBadge}>
          <Text style={styles.stopBadgeText}>{index + 1}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.leadName}>{visit.lead?.name ?? 'Lead'}</Text>
          {visit.lead?.address && <Text style={styles.meta}>📍 {visit.lead.address}</Text>}
        </View>
        <Text style={styles.time}>{formatTime(visit.visited_at)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.outcomeTag}>{OUTCOME_LABEL[visit.outcome] ?? visit.outcome}</Text>
        {visit.location_accuracy != null && <Text style={styles.metaSmall}>±{Math.round(visit.location_accuracy)}m</Text>}
      </View>
      {hasLocation && (
        <TouchableOpacity onPress={() => Linking.openURL(mapsLinkFor(`${visit.latitude},${visit.longitude}`))}>
          <Text style={styles.mapLink}>Open in Maps →</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function EmployeeTimelineScreen() {
  const router = useRouter()
  const { data: execs = [] } = useSalesTeam('sales_exec')
  const [execId, setExecId] = useState<string | null>(null)
  const [date, setDate] = useState(todayIso())
  const { data: visits = [], isLoading } = useExecDayVisits(execId ?? undefined, date)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackButton onPress={() => router.back()} />
      <View style={styles.header}>
        <Text style={styles.title}>Employee Timeline</Text>
        <Text style={styles.subtitle}>A sales exec's visits for one day, in order</Text>
      </View>

      <Text style={styles.label}>Sales Exec</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {execs.map((e) => (
          <TouchableOpacity
            key={e.id}
            style={[styles.chip, execId === e.id && styles.chipActive]}
            onPress={() => setExecId(execId === e.id ? null : e.id)}
          >
            <Text style={[styles.chipText, execId === e.id && styles.chipTextActive]}>{e.full_name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.dateField}>
        <DateTimeField label="Date" mode="date" value={date} onChange={setDate} />
      </View>

      {!execId ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Pick a sales exec</Text>
          <Text style={styles.emptySubtitle}>Choose someone above to see their day.</Text>
        </View>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={brand.green} />
        </View>
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(v) => v.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No visits that day</Text>
              <Text style={styles.emptySubtitle}>Nothing logged for this exec on this date.</Text>
            </View>
          }
          renderItem={({ item, index }) => <StopCard visit={item} index={index} />}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: brand.bg, paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: brand.ink },
  subtitle: { fontSize: 13, color: brand.muted, marginTop: 2 },
  label: { fontSize: 12, fontWeight: '700', color: brand.muted, textTransform: 'uppercase', marginBottom: 6 },
  chipRow: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: brand.border, backgroundColor: '#fff' },
  chipActive: { backgroundColor: brand.green, borderColor: brand.green },
  chipText: { fontSize: 13, fontWeight: '600', color: brand.text },
  chipTextActive: { color: brand.onGreen },
  dateField: { marginBottom: 12 },
  listContent: { paddingBottom: 24, gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: brand.textMuted },
  emptySubtitle: { fontSize: 12, color: brand.faint, marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: brand.borderLight, borderRadius: 14, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stopBadge: { width: 24, height: 24, borderRadius: 12, backgroundColor: brand.greenSoft, alignItems: 'center', justifyContent: 'center' },
  stopBadgeText: { fontSize: 12, fontWeight: '700', color: brand.greenDark },
  leadName: { fontSize: 15, fontWeight: '600', color: brand.ink },
  meta: { fontSize: 12, color: brand.muted, marginTop: 2 },
  time: { fontSize: 12, color: brand.muted, fontWeight: '600' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  outcomeTag: { fontSize: 11, fontWeight: '600', color: brand.text, backgroundColor: brand.surfaceAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  metaSmall: { fontSize: 11, color: brand.faint },
  mapLink: { fontSize: 12, color: brand.greenDark, fontWeight: '600', marginTop: 10 },
})
