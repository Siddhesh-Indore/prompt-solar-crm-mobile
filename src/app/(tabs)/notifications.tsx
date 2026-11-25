// src/app/(tabs)/notifications.tsx
// Notifications screen (sales exec), opened from the bell on Home and Profile: the leads that want attention right now —
// follow-ups due, visits due today or overdue, customers waiting on an intake
// form, new leads — most urgent first. Built live from the visit pipeline (see
// lib/notificationFeed), so an item disappears as soon as it's dealt with.
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/context/AuthContext'
import { useNotificationFeed } from '@/hooks/useNotificationFeed'
import LeadDetailModal from '@/components/sales/LeadDetailModal'
import { SkeletonList } from '@/components/ui/Skeleton'
import { hapticSelect } from '@/lib/haptics'
import type { FeedKind } from '@/lib/notificationFeed'
import type { Lead } from '@/types/sales'
import { brand } from '@/constants/brand'

type IconName = React.ComponentProps<typeof Ionicons>['name']

const KIND_STYLE: Record<FeedKind, { icon: IconName; tone: 'danger' | 'warning' | 'info' | 'green' }> = {
  followup_due: { icon: 'alarm', tone: 'danger' },
  visit_date_invalid: { icon: 'warning', tone: 'danger' },
  visit_overdue: { icon: 'calendar', tone: 'danger' },
  visit_today: { icon: 'car', tone: 'info' },
  followup_today: { icon: 'alarm-outline', tone: 'warning' },
  intake_waiting: { icon: 'document-text', tone: 'warning' },
  follow_up_stale: { icon: 'time', tone: 'warning' },
  new_lead: { icon: 'person-add', tone: 'green' },
}

const TONES = {
  danger: { bg: brand.dangerSoft, fg: brand.danger },
  warning: { bg: brand.warningSoft, fg: brand.warning },
  info: { bg: brand.infoSoft, fg: brand.info },
  green: { bg: brand.greenSoft, fg: brand.greenDark },
} as const

export default function NotificationsScreen() {
  const { user, profile } = useAuth()
  const router = useRouter()
  const isSalesExec = profile?.role === 'sales_exec'
  const { items, loading } = useNotificationFeed(isSalesExec, user?.id)
  const [detailLead, setDetailLead] = useState<Lead | null>(null)

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.subtitle}>{items.length > 0 ? `${items.length} lead${items.length === 1 ? '' : 's'} need your attention` : 'Leads that need your attention'}</Text>
      </View>

      {loading ? (
        <SkeletonList />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.key}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={44} color={brand.green} />
              <Text style={styles.emptyTitle}>You're all caught up</Text>
              <Text style={styles.emptyText}>No follow-ups due, overdue visits or waiting customers.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const style = KIND_STYLE[item.kind]
            const tone = TONES[style.tone]
            return (
              <View style={styles.row}>
                <TouchableOpacity
                  style={styles.rowMain}
                  activeOpacity={0.6}
                  onPress={() => {
                    hapticSelect()
                    // A follow-up reminder is handled in To-Do; a lead opens its details.
                    if (item.lead) setDetailLead(item.lead)
                    else router.push('/todo')
                  }}
                  accessibilityLabel={`${item.name}. ${item.detail}. Open.`}
                >
                  <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
                    <Ionicons name={style.icon} size={18} color={tone.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.detail, { color: tone.fg }]} numberOfLines={2}>{item.detail}</Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.callBtn} onPress={() => { hapticSelect(); Linking.openURL(`tel:${item.phone}`) }} hitSlop={6} accessibilityLabel={`Call ${item.name}`}>
                  <Ionicons name="call-outline" size={18} color={brand.navy} />
                </TouchableOpacity>
              </View>
            )
          }}
        />
      )}

      <LeadDetailModal lead={detailLead} onClose={() => setDetailLead(null)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: brand.bg },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: brand.ink },
  subtitle: { fontSize: 13, color: brand.muted, marginTop: 2 },
  list: { padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: brand.borderLight, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontWeight: '600', color: brand.ink },
  detail: { fontSize: 12, marginTop: 2 },
  callBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: brand.navySoft, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 70, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: brand.ink },
  emptyText: { fontSize: 12, color: brand.muted, textAlign: 'center', paddingHorizontal: 30 },
})
