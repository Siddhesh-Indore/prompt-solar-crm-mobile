// src/app/(tabs)/index.tsx
// Home. For a sales exec the first thing on screen is what's due today
// (visits + follow-ups), then punch in/out, then a list of shortcuts. Other
// roles get the same shortcut list without the today summary. The Sales Leads
// shortcut is intentionally absent.
import { useMemo } from 'react'
import { useRouter } from 'expo-router'
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/context/AuthContext'
import { useLeads } from '@/hooks/useLeads'
import { useMyFollowUps } from '@/hooks/useFollowUps'
import { useLeadVisitInfo, useVisitsDoneToday } from '@/hooks/useVisitBoard'
import { localDateKey, classifyActiveLead, EMPTY_VISIT_INFO } from '@/lib/visitBoard'
import { hapticSelect } from '@/lib/haptics'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import TimeTrackingCard from '@/components/sales/TimeTrackingCard'
import RemindersCard from '@/components/sales/RemindersCard'
import { brand } from '@/constants/brand'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  telecaller: 'Telecaller',
  sales_exec: 'Sales Executive',
  viewer: 'Viewer',
}

type IconName = React.ComponentProps<typeof Ionicons>['name']

interface Shortcut {
  key: string
  label: string
  icon: IconName
  href: string
  show: boolean
}

function greetingFor(hour: number): string {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// What the day looks like for a sales exec. Built from the same data as the
// Visits board (so the numbers agree with what's on that screen):
//   done       visits saved today, whatever the outcome
//   toVisit    leads still scheduled for a visit today
//   followUps  customers visited but with no next visit booked (the board's
//              Follow-up stage), plus any follow-up reminder due today or late
//   overdue    scheduled visits whose date has passed
// A recorded visit leaves "visit fixed", so counting only scheduled visits
// made the number fall as the day went on and showed nothing for follow-ups.
function useTodaySummary(enabled: boolean, userId: string | undefined) {
  const { data: activeLeads = [], isLoading: leadsLoading } = useLeads(
    userId ? { stageIn: ['visit_fixed', 'visited'], assignedExecId: userId } : undefined,
    { enabled: enabled && !!userId },
  )
  const leadIds = useMemo(() => activeLeads.map((l) => l.id), [activeLeads])
  const { data: infoMap, isLoading: infoLoading } = useLeadVisitInfo(leadIds)
  const { data: followUps = [], isLoading: followUpsLoading } = useMyFollowUps()
  const { data: done = 0, isLoading: doneLoading } = useVisitsDoneToday(userId, enabled)

  const summary = useMemo(() => {
    const today = localDateKey()
    let toVisit = 0
    let overdue = 0
    const followUpLeadIds = new Set<string>()

    for (const lead of activeLeads) {
      const date = lead.visit_date?.slice(0, 10)
      if (lead.stage === 'visit_fixed' && date) {
        if (date === today) toVisit++
        else if (date < today) overdue++
      }
      // Visited, not finalized, no next visit booked.
      if (lead.stage === 'visited' && infoMap && classifyActiveLead(lead, infoMap.get(lead.id) ?? EMPTY_VISIT_INFO) === 'follow_up') {
        followUpLeadIds.add(lead.id)
      }
    }
    for (const f of followUps) {
      if (localDateKey(new Date(f.due_at)) <= today) followUpLeadIds.add(f.lead_id)
    }

    return { done, toVisit, followUps: followUpLeadIds.size, overdue }
  }, [activeLeads, infoMap, followUps, done])

  const waitingOnInfo = leadIds.length > 0 && infoLoading
  return { ...summary, loading: enabled && (leadsLoading || waitingOnInfo || followUpsLoading || doneLoading) }
}

function Stat({ value, label, tone, onPress }: { value: number; label: string; tone?: 'alert'; onPress?: () => void }) {
  const body = (
    <>
      <Text style={[styles.statValue, tone === 'alert' && value > 0 && styles.statValueAlert]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </>
  )
  if (!onPress) return <View style={styles.stat}>{body}</View>
  return (
    <TouchableOpacity style={styles.stat} onPress={onPress} activeOpacity={0.7} accessibilityLabel={`${label}: ${value}. Open.`}>
      {body}
    </TouchableOpacity>
  )
}

export default function HomeScreen() {
  const { profile, session, loading, user, signOut } = useAuth()
  const router = useRouter()
  const role = profile?.role
  const isSalesExec = role === 'sales_exec'
  const today = useTodaySummary(isSalesExec, user?.id)

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={brand.green} />
      </SafeAreaView>
    )
  }

  const canSeeQueue = role === 'telecaller' || role === 'admin' || role === 'manager'
  const canSeeVisits = role === 'sales_exec' || role === 'admin' || role === 'manager' || role === 'telecaller'
  const canSeeFieldTools = role === 'telecaller' || role === 'sales_exec' || role === 'admin' || role === 'manager'
  const canSeeCustomers = role === 'telecaller' || role === 'admin'
  const canSeeEmployeeTimeline = role === 'telecaller' || role === 'admin' || role === 'manager'

  const allShortcuts: Shortcut[] = [
    { key: 'queue', label: 'Telecaller Queue', icon: 'call-outline', href: '/queue', show: canSeeQueue },
    { key: 'visits', label: 'Visits', icon: 'car-outline', href: '/visits', show: canSeeVisits },
    { key: 'new-lead', label: 'New Lead', icon: 'person-add-outline', href: '/new-lead', show: isSalesExec },
    { key: 'customers', label: 'Customers', icon: 'people-outline', href: '/customers', show: canSeeCustomers },
    { key: 'timeline', label: 'Employee Timeline', icon: 'map-outline', href: '/employee-timeline', show: canSeeEmployeeTimeline },
    { key: 'finalized', label: 'Finalized Customers', icon: 'checkmark-done-outline', href: '/village-reference', show: canSeeFieldTools },
    { key: 'emi', label: 'EMI Calculator', icon: 'calculator-outline', href: '/emi-calculator', show: canSeeFieldTools },
  ]
  const shortcuts = allShortcuts.filter((s) => s.show)

  const displayName = profile?.full_name ?? session?.user.email ?? ''
  const firstName = displayName.split(/[\s@]/)[0]
  const initials = displayName.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'
  const roleLabel = profile ? (ROLE_LABELS[profile.role] ?? profile.role) : ''

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greetingFor(new Date().getHours())}{roleLabel ? ` · ${roleLabel}` : ''}</Text>
            <Text style={styles.name} numberOfLines={1}>{firstName || 'there'}</Text>
          </View>
          <TouchableOpacity style={styles.signOutBtn} onPress={signOut} accessibilityLabel="Sign out" hitSlop={8}>
            <Ionicons name="log-out-outline" size={22} color={brand.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.stack}>
        {isSalesExec && (
          <TouchableOpacity
            style={styles.todayCard}
            activeOpacity={0.85}
            onPress={() => { hapticSelect(); router.push('/todo') }}
            accessibilityLabel="Open your To-Do list"
          >
            <View style={styles.todayHeader}>
              <View>
                <Text style={styles.todayTitle}>Today</Text>
                <Text style={styles.todayDate}>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</Text>
              </View>
              <View style={styles.todayLink}>
                <Text style={styles.todayLinkText}>To-Do</Text>
                <Ionicons name="chevron-forward" size={16} color={brand.green} />
              </View>
            </View>
            {today.loading ? (
              <View style={styles.statsRow}>
                {[0, 1, 2, 3].map((i) => <SkeletonBlock key={i} width={48} height={34} radius={8} style={styles.skeletonOnNavy} />)}
              </View>
            ) : (
              <View style={styles.statsRow}>
                <Stat value={today.done} label="Done" />
                <View style={styles.statDivider} />
                <Stat value={today.toVisit} label="To visit" />
                <View style={styles.statDivider} />
                <Stat value={today.followUps} label="Follow-ups" onPress={() => { hapticSelect(); router.push(`/visits?stage=follow_up&t=${Date.now()}` as never) }} />
                <View style={styles.statDivider} />
                <Stat value={today.overdue} label="Overdue" tone="alert" />
              </View>
            )}
          </TouchableOpacity>
        )}

          {isSalesExec && <TimeTrackingCard />}
          <RemindersCard />
        </View>

        <Text style={styles.sectionLabel}>Quick access</Text>
        <View style={styles.list}>
          {shortcuts.map((s, i) => (
            <TouchableOpacity
              key={s.key}
              style={[styles.row, i < shortcuts.length - 1 && styles.rowDivider]}
              activeOpacity={0.6}
              onPress={() => { hapticSelect(); router.push(s.href as never) }}
              accessibilityLabel={s.label}
            >
              <View style={styles.rowIcon}>
                <Ionicons name={s.icon} size={20} color={brand.navy} />
              </View>
              <Text style={styles.rowLabel}>{s.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={brand.faint} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: brand.bg },
  center: { flex: 1, backgroundColor: brand.bg, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: brand.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: brand.white, fontSize: 15, fontWeight: '700' },
  greeting: { color: brand.muted, fontSize: 12 },
  name: { color: brand.ink, fontSize: 20, fontWeight: '700', marginTop: 1 },
  signOutBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stack: { gap: 12 },
  todayCard: { backgroundColor: brand.navy, borderRadius: 16, padding: 16 },
  todayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  todayTitle: { color: brand.white, fontSize: 16, fontWeight: '700' },
  todayDate: { color: brand.navyBorder, fontSize: 12, marginTop: 1 },
  todayLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  todayLinkText: { color: brand.green, fontSize: 13, fontWeight: '700' },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.18)' },
  statValue: { color: brand.white, fontSize: 28, fontWeight: '800' },
  statValueAlert: { color: brand.dangerBorder },
  statLabel: { color: brand.navyBorder, fontSize: 12, marginTop: 1 },
  skeletonOnNavy: { backgroundColor: 'rgba(255,255,255,0.18)' },
  sectionLabel: { color: brand.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 24, marginBottom: 12 },
  list: { backgroundColor: brand.white, borderRadius: 16, borderWidth: 1, borderColor: brand.borderLight, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 60 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: brand.surfaceAlt },
  rowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: brand.navySoft, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, color: brand.ink, fontSize: 15, fontWeight: '600' },
})
