// src/app/village-reference.tsx
// Finalized Customers — two tabs, mirroring the web CRM's page of the same
// name. "Reference List" is the original read-only lookup over already-
// completed installations (imported by admin from historical records) so
// field staff can show a prospect "we've already done a site near you."
// "New Finalized Customers" is every signed client intake form with full
// detail — opened to every internal role by migration 079, not just
// admin/manager/the signing exec.
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFinalizedCustomers } from '@/hooks/useFinalizedCustomers'
import { useAllClientIntakeForms } from '@/hooks/useClientIntake'
import ClientIntakeDetailCard from '@/components/sales/ClientIntakeDetailCard'
import BackButton from '@/components/BackButton'
import { shareText, mapsLinkFor } from '@/lib/share'
import type { FinalizedCustomer } from '@/types/sales'

const INTAKE_PAGE_SIZE = 10

const TABS = [
  { value: 'reference', label: 'Reference List' },
  { value: 'new', label: 'New Finalized' },
] as const
type Tab = (typeof TABS)[number]['value']

function CustomerCard({ customer }: { customer: FinalizedCustomer }) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{customer.name}</Text>
      <View style={styles.metaRow}>
        {customer.village && <Text style={styles.metaText}>📍 {customer.village}</Text>}
        {customer.kw != null && <Text style={styles.metaText}>⚡ {customer.kw}kW</Text>}
      </View>
      <View style={styles.cardActions}>
        {customer.phone && (
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${customer.phone}`)}>
            <Text style={styles.phone}>📞 {customer.phone}</Text>
          </TouchableOpacity>
        )}
        {customer.village && (
          <TouchableOpacity
            onPress={() => shareText({ title: `${customer.name}'s location`, message: `${customer.village}\n${mapsLinkFor(customer.village!)}` })}
          >
            <Text style={styles.shareLink}>📍 Share Location</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  )
}

export default function VillageReferenceScreen() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('reference')
  const [search, setSearch] = useState('')
  const { data: customers = [], isLoading } = useFinalizedCustomers(search)

  const [intakeSearch, setIntakeSearch] = useState('')
  const [intakePage, setIntakePage] = useState(0)
  const { data: intakePageResult, isLoading: intakeLoading } = useAllClientIntakeForms(intakeSearch, intakePage, INTAKE_PAGE_SIZE)
  const intakeForms = intakePageResult?.forms ?? []
  const intakeTotalCount = intakePageResult?.totalCount ?? 0
  const intakeTotalPages = Math.max(1, Math.ceil(intakeTotalCount / INTAKE_PAGE_SIZE))

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.title}>Finalized Customers</Text>
      </View>

      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.value} style={[styles.tab, tab === t.value && styles.tabActive]} onPress={() => setTab(t.value)}>
            <Text style={[styles.tabText, tab === t.value && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'reference' ? (
        <>
          <Text style={styles.subtitle}>Search by village or name to reference a nearby completed site</Text>
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search village or name…"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
            />
          </View>

          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#4ade80" />
            </View>
          ) : (
            <FlatList
              data={customers}
              keyExtractor={(c) => c.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => <CustomerCard customer={item} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>No matches</Text>
                  <Text style={styles.emptySubtitle}>
                    {search.trim() ? 'Try a different village or name.' : 'No finalized customers imported yet.'}
                  </Text>
                </View>
              }
            />
          )}
        </>
      ) : (
        <>
          <Text style={styles.subtitle}>Every client intake form signed, with full details</Text>
          <View style={styles.searchWrap}>
            <TextInput
              style={styles.searchInput}
              value={intakeSearch}
              onChangeText={(v) => { setIntakeSearch(v); setIntakePage(0) }}
              placeholder="Search by name, phone, or address…"
              placeholderTextColor="#9ca3af"
              autoCapitalize="none"
            />
          </View>

          {intakeLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#4ade80" />
            </View>
          ) : (
            <FlatList
              data={intakeForms}
              keyExtractor={(f) => f.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => <ClientIntakeDetailCard f={item} />}
              ListEmptyComponent={
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>No matches</Text>
                  <Text style={styles.emptySubtitle}>
                    {intakeSearch.trim() ? 'Try a different name, phone, or address.' : 'These appear the moment a sales exec finalizes a customer.'}
                  </Text>
                </View>
              }
              ListFooterComponent={
                intakeTotalCount > INTAKE_PAGE_SIZE ? (
                  <View style={styles.pager}>
                    <TouchableOpacity
                      style={[styles.pagerBtn, intakePage === 0 && styles.pagerBtnDisabled]}
                      onPress={() => setIntakePage((p) => Math.max(0, p - 1))}
                      disabled={intakePage === 0}
                    >
                      <Text style={styles.pagerBtnText}>Prev</Text>
                    </TouchableOpacity>
                    <Text style={styles.pagerLabel}>Page {intakePage + 1} of {intakeTotalPages}</Text>
                    <TouchableOpacity
                      style={[styles.pagerBtn, intakePage >= intakeTotalPages - 1 && styles.pagerBtnDisabled]}
                      onPress={() => setIntakePage((p) => Math.min(intakeTotalPages - 1, p + 1))}
                      disabled={intakePage >= intakeTotalPages - 1}
                    >
                      <Text style={styles.pagerBtnText}>Next</Text>
                    </TouchableOpacity>
                  </View>
                ) : null
              }
            />
          )}
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2, marginHorizontal: 20 },
  tabRow: { flexDirection: 'row', gap: 6, marginHorizontal: 20, marginTop: 10, backgroundColor: '#f3f4f6', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#fff' },
  tabText: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#111827' },
  searchWrap: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  searchInput: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 11, fontSize: 14, color: '#111827', backgroundColor: '#fff',
  },
  listContent: { padding: 16, paddingTop: 4, gap: 10 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  emptySubtitle: { fontSize: 12, color: '#9ca3af', marginTop: 4, textAlign: 'center', paddingHorizontal: 30 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 14 },
  name: { fontSize: 15, fontWeight: '600', color: '#111827' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  metaText: { fontSize: 12, color: '#6b7280' },
  phone: { fontSize: 12, color: '#047857', fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 16, marginTop: 6 },
  shareLink: { fontSize: 12, color: '#374151', fontWeight: '600' },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8 },
  pagerBtn: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#fff' },
  pagerBtnDisabled: { opacity: 0.4 },
  pagerBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  pagerLabel: { fontSize: 12, color: '#6b7280' },
})
