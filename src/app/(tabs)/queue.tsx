// src/app/(tabs)/queue.tsx
// Telecaller's call queue — unassigned pool + leads already assigned to them,
// sorted hot -> warm -> cold. Opening a lead acquires the lock; submitting or
// releasing the qualification form releases it. Mirrors the web CRM's
// TelecallerQueuePage.
import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, ScrollView, StyleSheet, ActivityIndicator, RefreshControl, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLeads } from '@/hooks/useLeads'
import { useAcquireLeadLock, useReleaseLeadLock } from '@/hooks/useLeadLock'
import { useAssignLead } from '@/hooks/useAssignLead'
import { useAuth } from '@/context/AuthContext'
import LeadSourceBadge from '@/components/sales/badges/LeadSourceBadge'
import TemperatureBadge from '@/components/sales/badges/TemperatureBadge'
import QualificationForm from '@/components/sales/QualificationForm'
import ExecAssignPicker from '@/components/sales/ExecAssignPicker'
import type { Lead } from '@/types/sales'

const TEMP_ORDER: Record<string, number> = { hot: 0, warm: 1, cold: 2 }

function isLeadLocked(lead: Lead): boolean {
  if (!lead.locked_by || !lead.lock_expires_at) return false
  return new Date(lead.lock_expires_at).getTime() > Date.now()
}

export default function QueueScreen() {
  const { user } = useAuth()
  const { data: leads = [], isLoading, refetch, isRefetching } = useLeads()
  const acquireLock = useAcquireLeadLock()
  const releaseLock = useReleaseLeadLock()
  const assignLead = useAssignLead()
  const [openLead, setOpenLead] = useState<Lead | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const queue = useMemo(() => {
    const result = leads.filter((l) => l.stage === 'new' || l.stage === 'calling')
    return [...result].sort((a, b) => {
      const ta = a.temperature ? TEMP_ORDER[a.temperature] : 3
      const tb = b.temperature ? TEMP_ORDER[b.temperature] : 3
      return ta - tb
    })
  }, [leads])

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

  async function assignExec(lead: Lead, execId: string) {
    if (!execId) return
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
    Alert.alert('Leave this lead?', 'Any unsaved qualification details will be lost. The lead stays locked to you until you release it or the lock expires.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => setOpenLead(null) },
    ])
  }

  if (openLead) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.detailWrap} keyboardShouldPersistTaps="handled">
            <TouchableOpacity onPress={backToQueue}>
              <Text style={styles.backLink}>‹ Back to queue</Text>
            </TouchableOpacity>
            <View style={styles.detailHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailName}>{openLead.name}</Text>
                <Text style={styles.detailPhone}>{openLead.phone}</Text>
              </View>
              <LeadSourceBadge source={openLead.source} />
            </View>
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
              <Text style={styles.emptySubtitle}>No new or in-progress leads right now.</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },
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
  backLink: { fontSize: 14, color: '#047857', fontWeight: '600', marginBottom: 14 },
  detailHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  detailName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  detailPhone: { fontSize: 13, color: '#6b7280', marginTop: 2 },
})
