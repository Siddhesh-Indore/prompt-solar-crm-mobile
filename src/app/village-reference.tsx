// src/app/village-reference.tsx
// Read-only lookup over already-completed installations (imported by admin
// from historical records on the web app) — lets a telecaller/sales exec
// search by village or name to show a prospect "we've already done a site
// near you," without needing to dig through the leads pipeline.
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useFinalizedCustomers } from '@/hooks/useFinalizedCustomers'
import BackButton from '@/components/BackButton'
import type { FinalizedCustomer } from '@/types/sales'

function CustomerCard({ customer }: { customer: FinalizedCustomer }) {
  return (
    <View style={styles.card}>
      <Text style={styles.name}>{customer.name}</Text>
      <View style={styles.metaRow}>
        {customer.village && <Text style={styles.metaText}>📍 {customer.village}</Text>}
        {customer.kw != null && <Text style={styles.metaText}>⚡ {customer.kw}kW</Text>}
      </View>
      {customer.phone && (
        <TouchableOpacity onPress={() => Linking.openURL(`tel:${customer.phone}`)}>
          <Text style={styles.phone}>📞 {customer.phone}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function VillageReferenceScreen() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const { data: customers = [], isLoading } = useFinalizedCustomers(search)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => router.back()} />
        <Text style={styles.title}>Finalized Customers</Text>
        <Text style={styles.subtitle}>Search by village or name to reference a nearby completed site</Text>
      </View>

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
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  searchWrap: { paddingHorizontal: 20, paddingBottom: 8 },
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
  phone: { fontSize: 12, color: '#047857', fontWeight: '600', marginTop: 6 },
})
