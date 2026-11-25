// src/app/(tabs)/profile.tsx
// Profile: who is signed in, their notifications (sales exec) and sign out.
// The bell at the top shows how many leads need attention and opens the
// Notifications tab; the phone-reminders row says whether reminders can reach
// this phone and, if not, takes them to the system settings to switch them on.
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'expo-router'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Linking, AppState } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import * as Notifications from 'expo-notifications'
import { useAuth } from '@/context/AuthContext'
import { useNotificationFeed } from '@/hooks/useNotificationFeed'
import NotificationBell from '@/components/sales/NotificationBell'
import { hapticSelect } from '@/lib/haptics'
import { brand } from '@/constants/brand'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  telecaller: 'Telecaller',
  sales_exec: 'Sales Executive',
  viewer: 'Viewer',
}

type IconName = React.ComponentProps<typeof Ionicons>['name']

function Row({ icon, label, value, onPress, valueTone }: { icon: IconName; label: string; value?: string; onPress?: () => void; valueTone?: 'good' | 'bad' }) {
  const body = (
    <>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={18} color={brand.navy} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      {value ? <Text style={[styles.rowValue, valueTone === 'good' && styles.valueGood, valueTone === 'bad' && styles.valueBad]} numberOfLines={1}>{value}</Text> : null}
      {onPress && <Ionicons name="chevron-forward" size={18} color={brand.faint} />}
    </>
  )
  if (!onPress) return <View style={styles.row}>{body}</View>
  return <TouchableOpacity style={styles.row} onPress={() => { hapticSelect(); onPress() }} activeOpacity={0.6}>{body}</TouchableOpacity>
}

export default function ProfileScreen() {
  const { profile, session, user, signOut } = useAuth()
  const router = useRouter()
  const isSalesExec = profile?.role === 'sales_exec'
  const { items } = useNotificationFeed(isSalesExec, user?.id)
  const [remindersOn, setRemindersOn] = useState<boolean | null>(null)

  // Whether the phone lets this app show reminders — re-checked when the app
  // comes back from the system settings.
  const checkPermission = useCallback(() => {
    Notifications.getPermissionsAsync().then((p) => setRemindersOn(p.granted)).catch(() => setRemindersOn(null))
  }, [])
  useEffect(() => {
    if (!isSalesExec) return
    checkPermission()
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') checkPermission() })
    return () => sub.remove()
  }, [isSalesExec, checkPermission])

  const displayName = profile?.full_name ?? session?.user.email ?? ''
  const initials = displayName.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'
  const roleLabel = profile ? (ROLE_LABELS[profile.role] ?? profile.role) : ''

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You will need to sign in again to use the app.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => { signOut() } },
    ])
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Text style={styles.title}>Profile</Text>
          {isSalesExec && <NotificationBell count={items.length} onPress={() => router.push('/notifications')} />}
        </View>

        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name} numberOfLines={2}>{displayName || 'Signed in'}</Text>
          {roleLabel ? (
            <View style={styles.roleChip}>
              <Text style={styles.roleChipText}>{roleLabel}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          {profile?.email ? <Row icon="mail-outline" label="Email" value={profile.email} /> : null}
          {profile?.phone ? <Row icon="call-outline" label="Phone" value={profile.phone} /> : null}
          {profile?.branch ? <Row icon="location-outline" label="Branch" value={profile.branch} /> : null}
          <Row icon="information-circle-outline" label="App version" value={Constants.expoConfig?.version ?? ''} />
        </View>

        {isSalesExec && (
          <>
            <Text style={styles.sectionLabel}>Notifications</Text>
            <View style={styles.card}>
              <Row
                icon="notifications-outline"
                label="Lead notifications"
                value={items.length > 0 ? `${items.length} need attention` : 'All caught up'}
                valueTone={items.length > 0 ? 'bad' : 'good'}
                onPress={() => router.push('/notifications')}
              />
              <Row
                icon="alarm-outline"
                label="Phone reminders"
                value={remindersOn === null ? '' : remindersOn ? 'On' : 'Off — tap to turn on'}
                valueTone={remindersOn ? 'good' : 'bad'}
                onPress={remindersOn === false ? () => { Linking.openSettings() } : undefined}
              />
            </View>
            <Text style={styles.note}>Reminders: a summary each morning at 9, and an alert when a follow-up is due.</Text>
          </>
        )}

        <TouchableOpacity style={styles.signOut} onPress={() => { hapticSelect(); confirmSignOut() }} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={18} color={brand.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: brand.bg },
  content: { padding: 20, paddingBottom: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 },
  title: { fontSize: 20, fontWeight: '700', color: brand.ink },
  identity: { alignItems: 'center', marginTop: 12, marginBottom: 8, gap: 8 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: brand.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: brand.white, fontSize: 26, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '700', color: brand.ink, textAlign: 'center' },
  roleChip: { backgroundColor: brand.greenSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  roleChipText: { fontSize: 12, fontWeight: '700', color: brand.greenDark },
  sectionLabel: { color: brand.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 22, marginBottom: 10 },
  card: { backgroundColor: brand.white, borderRadius: 16, borderWidth: 1, borderColor: brand.borderLight, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 54, borderBottomWidth: 1, borderBottomColor: brand.surfaceAlt },
  rowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: brand.navySoft, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, color: brand.ink, fontSize: 14, fontWeight: '600' },
  rowValue: { color: brand.muted, fontSize: 13, flexShrink: 1, maxWidth: '55%', textAlign: 'right' },
  valueGood: { color: brand.greenDark, fontWeight: '600' },
  valueBad: { color: brand.danger, fontWeight: '600' },
  note: { fontSize: 12, color: brand.faint, marginTop: 8 },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 28, height: 48, borderRadius: 14, borderWidth: 1, borderColor: brand.dangerBorder, backgroundColor: brand.dangerSoft },
  signOutText: { color: brand.danger, fontSize: 14, fontWeight: '700' },
})
