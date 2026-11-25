// src/app/(tabs)/_layout.tsx
// Bottom tab nav. Queue is shown to telecallers/admins/managers. Visits is
// shown to sales execs/admins/managers (full access — log/edit) and now also
// to telecallers (read-only there, see visits.tsx's canManage gate) —
// matching the web CRM's role gating (084_visit_reports_visible_to_telecaller.sql).
import { Redirect, Tabs } from 'expo-router'
import type { ColorValue } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { brand } from '@/constants/brand'
import { hapticSelect } from '@/lib/haptics'
import { useReminderSync } from '@/hooks/useReminderSync'
import { useNotificationFeed } from '@/hooks/useNotificationFeed'

type IconName = React.ComponentProps<typeof Ionicons>['name']

function tabIcon(outline: IconName, filled: IconName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? filled : outline} size={24} color={typeof color === 'string' ? color : brand.navy} />
  )
}

// Renders nothing — keeps a sales exec's phone reminders up to date while the
// tabs are showing. Its own component so the hook isn't skipped by the
// loading / signed-out early returns below.
function ReminderSync() {
  const { profile, user } = useAuth()
  useReminderSync(profile?.role === 'sales_exec', user?.id)
  return null
}

export default function TabsLayout() {
  const { session, profile, loading, user } = useAuth()
  const queryClient = useQueryClient()
  // Count on the Notifications tab's badge.
  const { items: notifications } = useNotificationFeed(profile?.role === 'sales_exec', user?.id)

  if (loading) return null
  if (!session) return <Redirect href="/login" />

  const role = profile?.role
  const canSeeQueue = role === 'telecaller' || role === 'admin' || role === 'manager'
  const canSeeVisits = role === 'sales_exec' || role === 'admin' || role === 'manager' || role === 'telecaller'
  const canSeeTodo = role === 'sales_exec' || role === 'telecaller' || role === 'admin' || role === 'manager'
  const canSeeNotifications = role === 'sales_exec'

  return (
    <>
    <ReminderSync />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: brand.navy,
        tabBarInactiveTintColor: brand.faint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarStyle: { backgroundColor: brand.white, borderTopColor: brand.borderLight },
      }}
      screenListeners={{
        tabPress: () => hapticSelect(),
        // Tab screens stay mounted, so they don't refetch on their own when
        // you switch back to them. Refresh the work lists whenever a tab comes
        // into view — a visit a telecaller just fixed shows up straight away.
        focus: () => {
          for (const key of ['leads', 'follow-ups', 'reminders', 'visit-board']) {
            queryClient.invalidateQueries({ queryKey: [key] })
          }
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home-outline', 'home') }} />
      <Tabs.Screen name="queue" options={{ title: 'Queue', href: canSeeQueue ? undefined : null, tabBarIcon: tabIcon('call-outline', 'call') }} />
      <Tabs.Screen name="visits" options={{ title: 'Visits', href: canSeeVisits ? undefined : null, tabBarIcon: tabIcon('car-outline', 'car') }} />
      <Tabs.Screen name="todo" options={{ title: 'To-Do', href: canSeeTodo ? undefined : null, tabBarIcon: tabIcon('checkbox-outline', 'checkbox') }} />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          href: canSeeNotifications ? undefined : null,
          tabBarBadge: notifications.length > 0 ? (notifications.length > 9 ? '9+' : notifications.length) : undefined,
          tabBarBadgeStyle: { backgroundColor: brand.danger, color: '#fff', fontSize: 10, fontWeight: '800' },
          tabBarIcon: tabIcon('notifications-outline', 'notifications'),
        }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon('person-outline', 'person') }} />
    </Tabs>
    </>
  )
}
