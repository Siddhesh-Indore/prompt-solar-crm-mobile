// src/app/customers.tsx
// Customer directory — the intake buffer before a raw contact becomes a
// tracked Lead. Reopened to telecaller (view + add only; editing/deleting an
// existing record stays admin-only) via migration 083. Mirrors the web CRM's
// CustomersPage, minus the admin-only edit/delete/convert-to-lead actions.
import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Linking, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useCustomersPage, useCreateCustomer } from '@/hooks/useCustomers'
import BackButton from '@/components/BackButton'
import FormSheet from '@/components/sales/FormSheet'
import ChipSelect from '@/components/sales/ChipSelect'
import type { Customer, LeadSource } from '@/types/sales'

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'meta', label: 'Meta Ads' },
  { value: 'google', label: 'Google Ads' },
  { value: 'website', label: 'Website' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'owner_ref', label: 'Owner Ref' },
  { value: 'employee_ref', label: 'Employee Ref' },
  { value: 'manual', label: 'Manual' },
]

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function CustomerCard({ customer }: { customer: Customer }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.name}>{customer.name}</Text>
        {customer.lead_id && (
          <View style={styles.convertedBadge}>
            <Text style={styles.convertedBadgeText}>Converted</Text>
          </View>
        )}
      </View>
      <TouchableOpacity onPress={() => Linking.openURL(`tel:${customer.phone}`)}>
        <Text style={styles.phone}>📞 {customer.phone}</Text>
      </TouchableOpacity>
      {customer.address && <Text style={styles.meta}>📍 {customer.address}</Text>}
      <View style={styles.metaRow}>
        {customer.source && <Text style={styles.metaTag}>{customer.source}</Text>}
        <Text style={styles.metaDate}>Added {formatDate(customer.created_at)}</Text>
      </View>
      {customer.notes && <Text style={styles.notes}>{customer.notes}</Text>}
    </View>
  )
}

function AddCustomerForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const createCustomer = useCreateCustomer()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [source, setSource] = useState<LeadSource>('manual')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    if (!name.trim()) return setError('Name is required.')
    if (!/^\d{10}$/.test(phone)) return setError('Phone must be 10 digits.')
    try {
      await createCustomer.mutateAsync({ name: name.trim(), phone, address: address.trim() || undefined, source, notes: notes.trim() || undefined })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add customer')
    }
  }

  return (
    <View style={{ gap: 12 }}>
      {error && <Text style={styles.error}>{error}</Text>}
      <View>
        <Text style={styles.label}>Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor="#9ca3af" />
      </View>
      <View>
        <Text style={styles.label}>Phone</Text>
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="10-digit number" placeholderTextColor="#9ca3af" keyboardType="phone-pad" maxLength={10} />
      </View>
      <View>
        <Text style={styles.label}>Address</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Optional" placeholderTextColor="#9ca3af" />
      </View>
      <View>
        <Text style={styles.label}>Source</Text>
        <ChipSelect options={SOURCE_OPTIONS} value={source} onChange={setSource} />
      </View>
      <View>
        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, { height: 70 }]} value={notes} onChangeText={setNotes} placeholder="Optional" placeholderTextColor="#9ca3af" multiline textAlignVertical="top" />
      </View>
      <View style={styles.formActions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={createCustomer.isPending}>
          {createCustomer.isPending ? <ActivityIndicator size="small" color="#052e16" /> : <Text style={styles.submitBtnText}>Add Customer</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

export default function CustomersScreen() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [adding, setAdding] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data, isLoading, refetch } = useCustomersPage(debouncedSearch)
  const customers = data?.customers ?? []

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <BackButton onPress={() => router.back()} />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Customers</Text>
          <Text style={styles.subtitle}>Raw contacts, before they become a Sales Lead</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setAdding(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Search by name or phone…"
        placeholderTextColor="#9ca3af"
      />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4ade80" />
        </View>
      ) : (
        <FlatList
          data={customers}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No customers found</Text>
              <Text style={styles.emptySubtitle}>Add a new contact to get started.</Text>
            </View>
          }
          renderItem={({ item }) => <CustomerCard customer={item} />}
        />
      )}

      <FormSheet visible={adding} title="Add Customer" onClose={() => setAdding(false)}>
        <AddCustomerForm
          onDone={() => { setAdding(false); refetch(); Alert.alert('Added', 'Customer added.') }}
          onCancel={() => setAdding(false)}
        />
      </FormSheet>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb', paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12, gap: 12 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  addBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, backgroundColor: '#4ade80' },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#052e16' },
  searchInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#fff', marginBottom: 12 },
  listContent: { paddingBottom: 24, gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  emptySubtitle: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 15, fontWeight: '600', color: '#111827' },
  convertedBadge: { backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  convertedBadgeText: { fontSize: 11, fontWeight: '600', color: '#047857' },
  phone: { fontSize: 13, color: '#047857', fontWeight: '600', marginTop: 6 },
  meta: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  metaTag: { fontSize: 11, color: '#374151', backgroundColor: '#f3f4f6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, textTransform: 'capitalize' },
  metaDate: { fontSize: 11, color: '#9ca3af' },
  notes: { fontSize: 12, color: '#6b7280', marginTop: 8, fontStyle: 'italic' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827', backgroundColor: '#fff' },
  error: { fontSize: 12, color: '#dc2626', backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 10 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center' },
  cancelBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  submitBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#4ade80', alignItems: 'center' },
  submitBtnText: { fontSize: 13, fontWeight: '700', color: '#052e16' },
})
