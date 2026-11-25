// src/components/sales/NotificationBell.tsx
// Bell in Home's header with a count of the leads that want attention, and a
// sheet listing them: follow-ups due, visits due today or overdue, customers
// waiting on an intake form, new leads. Rows open the lead (or To-Do for a
// follow-up reminder); the call button rings the customer.
import { useState } from 'react'
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { hapticSelect } from '@/lib/haptics'
import type { FeedItem, FeedKind } from '@/lib/notificationFeed'
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

interface Props {
  items: FeedItem[]
  /** Open a lead from the pipeline (the sheet closes first). */
  onOpenLead: (lead: Lead) => void
  /** Open the To-Do tab — where a follow-up reminder is handled. */
  onOpenTodo: () => void
}

export default function NotificationBell({ items, onOpenLead, onOpenTodo }: Props) {
  const [open, setOpen] = useState(false)
  const count = items.length

  function pick(item: FeedItem) {
    hapticSelect()
    setOpen(false)
    // Let this sheet finish closing first — iOS drops a modal presented while
    // another is still on its way out.
    setTimeout(() => {
      if (item.lead) onOpenLead(item.lead)
      else onOpenTodo()
    }, 350)
  }

  return (
    <>
      <TouchableOpacity style={styles.bell} onPress={() => { hapticSelect(); setOpen(true) }} accessibilityLabel={count > 0 ? `Notifications: ${count} lead${count === 1 ? '' : 's'} need attention` : 'Notifications'} hitSlop={8}>
        <Ionicons name={count > 0 ? 'notifications' : 'notifications-outline'} size={23} color={count > 0 ? brand.navy : brand.muted} />
        {count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Text style={styles.title}>Notifications{count > 0 ? ` · ${count}` : ''}</Text>
            <TouchableOpacity onPress={() => setOpen(false)} hitSlop={10} accessibilityLabel="Close notifications">
              <Ionicons name="close" size={24} color={brand.ink} />
            </TouchableOpacity>
          </View>

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
            renderItem={({ item, index }) => {
              const style = KIND_STYLE[item.kind]
              const tone = TONES[style.tone]
              return (
                <View style={[styles.row, index > 0 && styles.rowDivider]}>
                  <TouchableOpacity style={styles.rowMain} activeOpacity={0.6} onPress={() => pick(item)} accessibilityLabel={`${item.name}. ${item.detail}. Open.`}>
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
        </SafeAreaView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  bell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 3, right: 1, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: brand.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: brand.bg },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  safe: { flex: 1, backgroundColor: brand.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: brand.borderLight, backgroundColor: '#fff' },
  title: { fontSize: 17, fontWeight: '700', color: brand.ink },
  list: { padding: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 12 },
  rowDivider: { borderTopWidth: 1, borderTopColor: brand.surfaceAlt },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontWeight: '600', color: brand.ink },
  detail: { fontSize: 12, marginTop: 2 },
  callBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: brand.navySoft, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingVertical: 70, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: brand.ink },
  emptyText: { fontSize: 12, color: brand.muted, textAlign: 'center', paddingHorizontal: 30 },
})
