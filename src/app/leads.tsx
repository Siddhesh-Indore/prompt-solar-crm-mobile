// src/app/leads.tsx
// Sales Leads — a searchable browse of every lead, any stage (not just the
// Telecaller Queue's "still needs a call" bucket). Read-only here: tapping a
// lead opens the same detail sheet used elsewhere, with no qualification
// form attached. RLS still scopes what actually comes back per role — a
// telecaller sees the unassigned pool plus leads assigned to them, same
// as Queue, just across every stage instead of only new/calling.
import { useEffect, useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useLeadsPage } from '@/hooks/useLeads'
import LeadSourceBadge from '@/components/sales/badges/LeadSourceBadge'
import StageBadge from '@/components/sales/badges/StageBadge'
import TemperatureBadge from '@/components/sales/badges/TemperatureBadge'
import LeadDetailModal from '@/components/sales/LeadDetailModal'
import BackButton from '@/components/BackButton'
import type { Lead, LeadStage } from '@/types/sales'

const STAGE_OPTIONS: { value: LeadStage; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'calling', label: 'Calling' },
  { value: 'visit_fixed', label: 'Visit Fixed' },
  { value: 'visited', label: 'Visited' },
  { value: 'converted', label: 'Converted' },
  { value: 'not_qualified', label: 'Not Qualified' },
  { value: 'lost', label: 'Lost' },
]

export default function LeadsScreen() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [stage, setStage] = useState<LeadStage | null>(null)
  const [detailLead, setDetailLead] = useState<Lead | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const filters = useMemo(() => ({ search: debouncedSearch, stage }), [debouncedSearch, stage])
  const {
    data, isLoading, refetch, isRefetching, fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useLeadsPage(filters)
  const leads = useMemo(() => data?.pages.flatMap((p) => p.leads) ?? [], [data])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackButton onPress={() => router.back()} />
      <View style={styles.header}>
        <Text style={styles.title}>Sales Leads</Text>
        <Text style={styles.subtitle}>Every lead, any stage — search or filter to browse</Text>
      </View>

      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or phone…"
        placeholderTextColor="#9ca3af"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <FilterChip label="All Stages" active={!stage} onPress={() => setStage(null)} />
        {STAGE_OPTIONS.map((s) => (
          <FilterChip key={s.value} label={s.label} active={stage === s.value} onPress={() => setStage(stage === s.value ? null : s.value)} />
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4ade80" />
        </View>
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.listContent}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage() }}
          onEndReachedThreshold={0.5}
          refreshing={isRefetching}
          onRefresh={refetch}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator size="small" color="#4ade80" style={{ marginVertical: 16 }} /> : null}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No leads found</Text>
              <Text style={styles.emptySubtitle}>Try a different search or stage filter.</Text>
            </View>
          }
          renderItem={({ item: lead }) => (
            <TouchableOpacity style={styles.card} onPress={() => setDetailLead(lead)}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.leadName}>{lead.name}</Text>
                  <Text style={styles.leadPhone}>📞 {lead.phone}</Text>
                  {lead.address && <Text style={styles.leadAddress}>📍 {lead.address}</Text>}
                </View>
              </View>
              <View style={styles.badgeRow}>
                <LeadSourceBadge source={lead.source} />
                <StageBadge stage={lead.stage} />
                <TemperatureBadge temperature={lead.temperature} />
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      <LeadDetailModal lead={detailLead} onClose={() => setDetailLead(null)} />
    </SafeAreaView>
  )
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.filterChip, active && styles.filterChipActive]} onPress={onPress}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb', paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  searchInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#fff', marginBottom: 10 },
  chipRow: { flexDirection: 'row', gap: 8, paddingBottom: 12 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  filterChipActive: { backgroundColor: '#4ade80', borderColor: '#4ade80' },
  filterChipText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  filterChipTextActive: { color: '#052e16', fontWeight: '700' },
  listContent: { paddingBottom: 24, gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  emptySubtitle: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  leadName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  leadPhone: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  leadAddress: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
})
