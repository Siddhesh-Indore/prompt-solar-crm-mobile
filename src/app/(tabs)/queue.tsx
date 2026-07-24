// src/app/(tabs)/queue.tsx
// Telecaller's call queue — unassigned pool + leads already assigned to them,
// sorted hot -> warm -> cold. Opening a lead acquires the lock; submitting or
// releasing the qualification form releases it. Mirrors the web CRM's
// TelecallerQueuePage.
import { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLeads, usePendingFollowupLeadIds, useLeadsByLastCallOutcome } from '@/hooks/useLeads'
import { useAcquireLeadLock, useReleaseLeadLock } from '@/hooks/useLeadLock'
import { useAssignLead } from '@/hooks/useAssignLead'
import { useSalesTeam } from '@/hooks/useSalesTeam'
import { useAuth } from '@/context/AuthContext'
import LeadSourceBadge from '@/components/sales/badges/LeadSourceBadge'
import TemperatureBadge from '@/components/sales/badges/TemperatureBadge'
import QualificationForm from '@/components/sales/QualificationForm'
import ExecAssignPicker from '@/components/sales/ExecAssignPicker'
import CallVisitHistory from '@/components/sales/CallVisitHistory'
import BackButton from '@/components/BackButton'
import type { Lead, LeadTemperature } from '@/types/sales'

const TEMP_ORDER: Record<string, number> = { hot: 0, warm: 1, cold: 2 }

const SECTION_OPTIONS = [
  'Ale Section', 'AWSARI', 'Belha Section', 'Loni', 'MCR R', 'MCR U',
  'Nirgudsar', 'Otur Rural Section', 'Otur Urban Section', 'Ranjani', 'Unmapped Consumer',
]

const TEMPERATURE_OPTIONS: { value: LeadTemperature; label: string }[] = [
  { value: 'hot', label: 'Hot' },
  { value: 'warm', label: 'Warm' },
  { value: 'cold', label: 'Cold' },
]

const CALL_OUTCOME_OPTIONS = [
  { value: 'no_answer', label: 'No Answer' },
  { value: 'callback_requested', label: 'Call Back' },
  { value: 'answered', label: 'Answered' },
  { value: 'busy', label: 'Busy' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rescheduled', label: 'Rescheduled' },
  { value: 'incoming_call_barred', label: 'Incoming Call Barred' },
  { value: 'invalid_phone_number', label: 'Invalid Phone Number' },
]

function isLeadLocked(lead: Lead): boolean {
  if (!lead.locked_by || !lead.lock_expires_at) return false
  return new Date(lead.lock_expires_at).getTime() > Date.now()
}

export default function QueueScreen() {
  const { user } = useAuth()
  const { data: leads = [], isLoading, refetch, isRefetching } = useLeads()
  const { data: pendingFollowupLeadIds = [] } = usePendingFollowupLeadIds()
  const acquireLock = useAcquireLeadLock()
  const releaseLock = useReleaseLeadLock()
  const assignLead = useAssignLead()
  const [openLead, setOpenLead] = useState<Lead | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [village, setVillage] = useState('')
  const [section, setSection] = useState<string | null>(null)
  const [temperature, setTemperature] = useState<LeadTemperature | null>(null)
  const [callOutcome, setCallOutcome] = useState<string | null>(null)
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false)
  const [telecallerFilter, setTelecallerFilter] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const { data: callOutcomeLeadIds = [] } = useLeadsByLastCallOutcome(callOutcome ?? undefined)
  const { data: telecallers = [] } = useSalesTeam('telecaller')

  const activeFilterCount = [village, section, temperature, callOutcome, telecallerFilter].filter(Boolean).length + (assignedToMeOnly ? 1 : 0)

  // "Assigned to me" and the Telecaller chip row both narrow to a single
  // caller — mutually exclusive so one doesn't silently override the other.
  function toggleAssignedToMe() {
    setAssignedToMeOnly((v) => {
      const next = !v
      if (next) setTelecallerFilter(null)
      return next
    })
  }
  function changeTelecallerFilter(id: string | null) {
    setTelecallerFilter(id)
    if (id) setAssignedToMeOnly(false)
  }

  const queue = useMemo(() => {
    const pendingSet = new Set(pendingFollowupLeadIds)
    const outcomeSet = callOutcome ? new Set(callOutcomeLeadIds) : null
    const searchTerm = search.trim().toLowerCase()
    const villageTerm = village.trim().toLowerCase()
    const effectiveCallerId = assignedToMeOnly ? user?.id : telecallerFilter

    const result = leads.filter((l) => {
      if (l.stage !== 'new' && l.stage !== 'calling') return false
      if (pendingSet.has(l.id)) return false
      if (effectiveCallerId && l.assigned_caller_id !== effectiveCallerId) return false
      if (section && l.section !== section) return false
      if (temperature && l.temperature !== temperature) return false
      if (outcomeSet && !outcomeSet.has(l.id)) return false
      if (searchTerm && !l.name.toLowerCase().includes(searchTerm) && !l.phone.includes(searchTerm)) return false
      if (villageTerm && !(l.address ?? '').toLowerCase().includes(villageTerm)) return false
      return true
    })
    return [...result].sort((a, b) => {
      const ta = a.temperature ? TEMP_ORDER[a.temperature] : 3
      const tb = b.temperature ? TEMP_ORDER[b.temperature] : 3
      return ta - tb
    })
  }, [leads, pendingFollowupLeadIds, callOutcome, callOutcomeLeadIds, assignedToMeOnly, telecallerFilter, section, temperature, search, village, user?.id])

  async function assignToMe(lead: Lead) {
    if (!user) return
    setBusyId(lead.id)
    try {
      await assignLead.mutateAsync({ leadId: lead.id, role: 'telecaller', userId: user.id })
      refetch()
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to self-assign')
    } finally {
      setBusyId(null)
    }
  }

  async function assignExec(lead: Lead, execId: string | null) {
    if (execId === (lead.assigned_exec_id ?? null)) return
    setBusyId(lead.id)
    try {
      await assignLead.mutateAsync({
        leadId: lead.id,
        role: 'sales_exec',
        userId: execId,
        previousUserId: lead.assigned_exec_id,
      })
      refetch()
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to assign sales exec')
    } finally {
      setBusyId(null)
    }
  }

  async function unlockLead(lead: Lead) {
    Alert.alert(
      'Unlock lead?',
      `${lead.locked_by_profile?.full_name ?? 'Whoever currently holds it'} will lose their hold on "${lead.name}".`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlock',
          style: 'destructive',
          onPress: async () => {
            setBusyId(lead.id)
            try {
              const result = await releaseLock.mutateAsync({ leadId: lead.id, reason: 'Force-released from Telecaller Queue' })
              if (!result.released) throw new Error(result.error ?? 'Not allowed to unlock this lead')
              refetch()
            } catch (err) {
              Alert.alert('Error', err instanceof Error ? err.message : 'Failed to unlock lead')
            } finally {
              setBusyId(null)
            }
          },
        },
      ],
    )
  }

  async function openLeadForCall(lead: Lead) {
    if (isLeadLocked(lead)) {
      Alert.alert('Locked', `Locked by ${lead.locked_by_profile?.full_name ?? 'another telecaller'}`)
      return
    }
    setBusyId(lead.id)
    try {
      const result = await acquireLock.mutateAsync(lead.id)
      if (!result.acquired) {
        Alert.alert('Locked', `Held by ${result.held_by ?? 'another telecaller'} until ${result.until ? new Date(result.until).toLocaleTimeString() : ''}`)
        await refetch()
        return
      }
      setOpenLead(lead)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not lock lead')
    } finally {
      setBusyId(null)
    }
  }

  function backToQueue() {
    Alert.alert('Leave this lead?', 'Any unsaved qualification details will be lost.', [
      { text: 'Keep Editing', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          const leadId = openLead?.id
          setOpenLead(null)
          if (leadId) {
            try {
              await releaseLock.mutateAsync({ leadId })
            } catch {
              // Best-effort — still leave the card even if the lock was
              // already released or expired server-side.
            }
            refetch()
          }
        },
      },
    ])
  }

  if (openLead) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.detailWrap} keyboardShouldPersistTaps="handled">
            <BackButton onPress={backToQueue} label="Back to queue" />
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailName}>{openLead.name}</Text>
                <Text style={styles.detailPhone}>{openLead.phone}</Text>
              </View>
              <LeadSourceBadge source={openLead.source} />
            </View>
            <CallVisitHistory leadId={openLead.id} />
            <View style={styles.card}>
              <QualificationForm lead={openLead} onDone={() => { setOpenLead(null); refetch() }} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Telecaller Queue</Text>
        <Text style={styles.subtitle}>Unassigned and in-progress leads — hot first</Text>
      </View>

      <View style={styles.filterBar}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or phone…"
          placeholderTextColor="#9ca3af"
        />
        <View style={styles.filterBarRow}>
          <TouchableOpacity
            style={[styles.toggleChip, assignedToMeOnly && styles.toggleChipActive]}
            onPress={toggleAssignedToMe}
          >
            <Text style={[styles.toggleChipText, assignedToMeOnly && styles.toggleChipTextActive]}>Assigned to me</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filtersBtn} onPress={() => setShowFilters((v) => !v)}>
            <Text style={styles.filtersBtnText}>
              {showFilters ? 'Hide filters' : 'More filters'}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {showFilters && (
          <View style={styles.filterPanel}>
            <TextInput
              style={styles.searchInput}
              value={village}
              onChangeText={setVillage}
              placeholder="Search by village/address…"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.filterGroupLabel}>Section</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScrollRow}>
              <FilterChip label="All" active={!section} onPress={() => setSection(null)} />
              {SECTION_OPTIONS.map((s) => (
                <FilterChip key={s} label={s} active={section === s} onPress={() => setSection(section === s ? null : s)} />
              ))}
            </ScrollView>

            <Text style={styles.filterGroupLabel}>Temperature</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScrollRow}>
              <FilterChip label="All" active={!temperature} onPress={() => setTemperature(null)} />
              {TEMPERATURE_OPTIONS.map((t) => (
                <FilterChip key={t.value} label={t.label} active={temperature === t.value} onPress={() => setTemperature(temperature === t.value ? null : t.value)} />
              ))}
            </ScrollView>

            <Text style={styles.filterGroupLabel}>Call Outcome</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScrollRow}>
              <FilterChip label="All" active={!callOutcome} onPress={() => setCallOutcome(null)} />
              {CALL_OUTCOME_OPTIONS.map((o) => (
                <FilterChip key={o.value} label={o.label} active={callOutcome === o.value} onPress={() => setCallOutcome(callOutcome === o.value ? null : o.value)} />
              ))}
            </ScrollView>

            {telecallers.length > 0 && (
              <>
                <Text style={styles.filterGroupLabel}>Telecaller</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScrollRow}>
                  <FilterChip label="All" active={!telecallerFilter} onPress={() => changeTelecallerFilter(null)} />
                  {telecallers.map((t) => (
                    <FilterChip
                      key={t.id}
                      label={t.full_name}
                      active={telecallerFilter === t.id}
                      onPress={() => changeTelecallerFilter(telecallerFilter === t.id ? null : t.id)}
                    />
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4ade80" />
        </View>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Queue is empty</Text>
              <Text style={styles.emptySubtitle}>No new or in-progress leads match the current filters.</Text>
            </View>
          }
          renderItem={({ item: lead }) => {
            const locked = isLeadLocked(lead)
            const unassigned = !lead.assigned_caller_id
            const mine = lead.assigned_caller_id === user?.id
            const busy = busyId === lead.id
            return (
              <TouchableOpacity
                style={[styles.card, locked && styles.cardLocked]}
                onPress={() => !locked && openLeadForCall(lead)}
                disabled={locked || busy}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      {locked && <Text style={styles.lockIcon}>🔒</Text>}
                      <Text style={styles.leadName}>{lead.name}</Text>
                    </View>
                    {mine && <Text style={styles.mineTag}>Assigned to you</Text>}
                    <Text style={styles.leadPhone}>📞 {lead.phone}</Text>
                    {lead.address && <Text style={styles.leadAddress}>📍 {lead.address}</Text>}
                    {locked && (
                      <Text style={styles.lockedText}>Locked by {lead.locked_by_profile?.full_name ?? 'someone'}</Text>
                    )}
                  </View>
                  {busy && <ActivityIndicator size="small" color="#4ade80" />}
                </View>
                <View style={styles.badgeRow}>
                  <LeadSourceBadge source={lead.source} />
                  <TemperatureBadge temperature={lead.temperature} />
                </View>
                <View style={styles.execRow}>
                  <Text style={styles.execLabel}>Sales Exec</Text>
                  <ExecAssignPicker
                    value={lead.assigned_exec_id}
                    onChange={(id) => assignExec(lead, id)}
                  />
                </View>
                <View style={styles.actionsRow}>
                  {unassigned && (
                    <TouchableOpacity style={styles.assignBtn} onPress={() => assignToMe(lead)} disabled={busy}>
                      <Text style={styles.assignBtnText}>Assign to me</Text>
                    </TouchableOpacity>
                  )}
                  {locked && (
                    <TouchableOpacity style={styles.unlockBtn} onPress={() => unlockLead(lead)} disabled={busy}>
                      <Text style={styles.unlockBtnText}>Unlock</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            )
          }}
        />
      )}
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
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  filterBar: { paddingHorizontal: 20, paddingBottom: 10, gap: 8 },
  searchInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#111827', backgroundColor: '#fff' },
  filterBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  toggleChipActive: { backgroundColor: '#4ade80', borderColor: '#4ade80' },
  toggleChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  toggleChipTextActive: { color: '#052e16' },
  filtersBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  filtersBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  filterPanel: { gap: 8, marginTop: 4, padding: 12, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  filterGroupLabel: { fontSize: 11, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', marginTop: 4 },
  chipScrollRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  filterChipActive: { backgroundColor: '#4ade80', borderColor: '#4ade80' },
  filterChipText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  filterChipTextActive: { color: '#052e16', fontWeight: '700' },
  listContent: { padding: 16, gap: 12 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 14, fontWeight: '600', color: '#4b5563' },
  emptySubtitle: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 14, marginBottom: 12 },
  cardLocked: { opacity: 0.6 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lockIcon: { fontSize: 12 },
  leadName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  mineTag: { fontSize: 11, color: '#047857', backgroundColor: '#d1fae5', alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 4 },
  leadPhone: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  leadAddress: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  lockedText: { fontSize: 11, color: '#b45309', marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  execRow: { marginTop: 10, gap: 6 },
  execLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280' },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  assignBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#d1fae5', borderWidth: 1, borderColor: '#a7f3d0' },
  assignBtnText: { fontSize: 12, fontWeight: '600', color: '#047857' },
  unlockBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: '#fef3c7', borderWidth: 1, borderColor: '#fde68a' },
  unlockBtnText: { fontSize: 12, fontWeight: '600', color: '#b45309' },
  detailWrap: { padding: 16 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  detailName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  detailPhone: { fontSize: 13, color: '#6b7280', marginTop: 2 },
})
