// src/app/new-lead.tsx
// New Lead — mirrors the web CRM's NewLeadPage: just the basics (name,
// phone, address, source); the telecaller fills in the rest during the
// qualification call. Blocks on a duplicate phone number, checked
// org-wide (find_leads_by_phone, migration 086) rather than only against
// leads this user can see.
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useCreateLead, findDuplicateLeadsByPhone, type DuplicateLead } from '@/hooks/useLeadMutations'
import BackButton from '@/components/BackButton'
import ChipSelect from '@/components/sales/ChipSelect'
import StageBadge from '@/components/sales/badges/StageBadge'
import type { LeadSource } from '@/types/sales'

// Matches what customers.source's CHECK constraint accepts — the lead's
// source is copied onto its customer record, so a value outside this set
// would fail that step after the lead itself was already created.
const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'owner_ref', label: 'Owner Ref' },
  { value: 'employee_ref', label: 'Employee Ref' },
  { value: 'meta', label: 'Meta Ads' },
  { value: 'google', label: 'Google Ads' },
  { value: 'website', label: 'Website' },
]

export default function NewLeadScreen() {
  const router = useRouter()
  const createLead = useCreateLead()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [source, setSource] = useState<LeadSource>('manual')
  const [notes, setNotes] = useState('')
  const [duplicates, setDuplicates] = useState<DuplicateLead[]>([])
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function checkDuplicates(value: string): Promise<DuplicateLead[]> {
    if (value.length !== 10) {
      setDuplicates([])
      return []
    }
    setChecking(true)
    try {
      const matches = await findDuplicateLeadsByPhone(value)
      setDuplicates(matches)
      return matches
    } finally {
      setChecking(false)
    }
  }

  function onPhoneChange(value: string) {
    const digits = value.replace(/\D/g, '')
    setPhone(digits)
    setDuplicates([])
    if (digits.length === 10) checkDuplicates(digits).catch(() => {})
  }

  async function submit() {
    setError(null)
    if (name.trim().length < 2) return setError('Name is required.')
    if (!/^\d{10}$/.test(phone)) return setError('Phone must be exactly 10 digits.')

    try {
      // A failed check must not fall through to creating the lead — better
      // to make the user retry than to risk a duplicate going in unseen.
      const matches = await checkDuplicates(phone)
      if (matches.length > 0) return

      await createLead.mutateAsync({
        name: name.trim(),
        phone,
        address: address.trim() || undefined,
        source,
        notes: notes.trim() || undefined,
      })
      Alert.alert('Lead created', `${name.trim()} was added and is now in the telecaller queue.`, [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lead')
    }
  }

  const blocked = duplicates.length > 0

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <BackButton onPress={() => router.back()} />
          <Text style={styles.title}>New Lead</Text>
          <Text style={styles.subtitle}>Capture the basics — the telecaller fills in the rest after the qualification call.</Text>

          {error && <Text style={styles.error}>{error}</Text>}

          {blocked && (
            <View style={styles.dupBox}>
              <Text style={styles.dupTitle}>This number already exists</Text>
              {duplicates.map((d) => (
                <View key={d.id} style={styles.dupRow}>
                  <Text style={styles.dupName}>{d.name}</Text>
                  <StageBadge stage={d.stage} />
                </View>
              ))}
              <Text style={styles.dupHint}>Change the number to continue, or ask the telecaller to follow up on the existing lead.</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.label}>Name <Text style={styles.required}>*</Text></Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Suresh Patil" placeholderTextColor="#9ca3af" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={[styles.input, blocked && styles.inputBlocked]}
              value={phone}
              onChangeText={onPhoneChange}
              placeholder="10-digit mobile number"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              maxLength={10}
            />
            {checking && <Text style={styles.hint}>Checking for duplicates…</Text>}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Address</Text>
            <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholder="Site address / village" placeholderTextColor="#9ca3af" />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Source</Text>
            <ChipSelect options={SOURCE_OPTIONS} value={source} onChange={setSource} />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, { height: 80 }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional"
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, (blocked || createLead.isPending) && styles.submitBtnDisabled]}
            onPress={submit}
            disabled={blocked || createLead.isPending}
          >
            {createLead.isPending ? <ActivityIndicator size="small" color="#052e16" /> : <Text style={styles.submitBtnText}>Create Lead</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2, marginBottom: 16 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  required: { color: '#dc2626' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827', backgroundColor: '#fff' },
  inputBlocked: { borderColor: '#f59e0b' },
  hint: { fontSize: 11, color: '#9ca3af', marginTop: 4 },
  error: { fontSize: 12, color: '#dc2626', backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 10, marginBottom: 14 },
  dupBox: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 12, marginBottom: 14, gap: 8 },
  dupTitle: { fontSize: 13, fontWeight: '700', color: '#b45309' },
  dupRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dupName: { fontSize: 13, color: '#111827', fontWeight: '600', flexShrink: 1 },
  dupHint: { fontSize: 11, color: '#92400e' },
  submitBtn: { marginTop: 6, paddingVertical: 14, borderRadius: 12, backgroundColor: '#4ade80', alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 14, fontWeight: '700', color: '#052e16' },
})
