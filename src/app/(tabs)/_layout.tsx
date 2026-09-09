// src/app/(tabs)/_layout.tsx
// Bottom tab nav. Queue is shown to telecallers/admins/managers. Visits is
// shown to sales execs/admins/managers (full access — log/edit) and now also
// to telecallers (read-only there, see visits.tsx's canManage gate) —
// matching the web CRM's role gating (084_visit_reports_visible_to_telecaller.sql).
import { Redirect, Tabs } from 'expo-router'
import { Text } from 'react-native'
import { useAuth } from '@/context/AuthContext'

export default function TabsLayout() {
  const { session, profile, loading } = useAuth()

  if (loading) return null
  if (!session) return <Redirect href="/login" />

  const role = profile?.role
  const canSeeQueue = role === 'telecaller' || role === 'admin' || role === 'manager'
  const canSeeVisits = role === 'sales_exec' || role === 'admin' || role === 'manager' || role === 'telecaller'
  const canSeeTodo = role === 'sales_exec' || role === 'telecaller' || role === 'admin' || role === 'manager'

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#047857' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="queue"
        options={{
          title: 'Queue',
          href: canSeeQueue ? undefined : null,
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>📞</Text>,
        }}
      />
      <Tabs.Screen
        name="visits"
        options={{
          title: 'Visits',
          href: canSeeVisits ? undefined : null,
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>🚗</Text>,
        }}
      />
      <Tabs.Screen
        name="todo"
        options={{
          title: 'To-Do',
          href: canSeeTodo ? undefined : null,
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18 }}>✅</Text>,
        }}
      />
    </Tabs>
  )
}
