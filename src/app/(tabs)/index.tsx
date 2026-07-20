import { useRouter } from 'expo-router'
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '@/context/AuthContext'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  telecaller: 'Telecaller',
  sales_exec: 'Sales Executive',
  viewer: 'Viewer',
}

export default function HomeScreen() {
  const { profile, session, loading, signOut } = useAuth()
  const router = useRouter()

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#4ade80" />
      </SafeAreaView>
    )
  }

  const role = profile?.role
  const canSeeQueue = role === 'telecaller' || role === 'admin' || role === 'manager'
  const canSeeVisits = role === 'sales_exec' || role === 'admin' || role === 'manager'
  const canSeeFieldTools = role === 'telecaller' || role === 'sales_exec' || role === 'admin' || role === 'manager'

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Prompt-Solar CRM</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.greeting}>Signed in as</Text>
        <Text style={styles.name}>{profile?.full_name ?? session?.user.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{profile ? (ROLE_LABELS[profile.role] ?? profile.role) : '…'}</Text>
        </View>
      </View>

      <View style={styles.quickLinks}>
        {canSeeQueue && (
          <TouchableOpacity style={styles.linkCard} onPress={() => router.push('/queue')}>
            <Text style={styles.linkEmoji}>📞</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>Telecaller Queue</Text>
              <Text style={styles.linkSubtitle}>Call new leads, qualify, fix visits</Text>
            </View>
          </TouchableOpacity>
        )}
        {canSeeVisits && (
          <TouchableOpacity style={styles.linkCard} onPress={() => router.push('/visits')}>
            <Text style={styles.linkEmoji}>🚗</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>Visits</Text>
              <Text style={styles.linkSubtitle}>Your assigned site visits</Text>
            </View>
          </TouchableOpacity>
        )}
        {canSeeFieldTools && (
          <TouchableOpacity style={styles.linkCard} onPress={() => router.push('/village-reference')}>
            <Text style={styles.linkEmoji}>✅</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>Finalized Customers</Text>
              <Text style={styles.linkSubtitle}>Search completed sites by village or name</Text>
            </View>
          </TouchableOpacity>
        )}
        {canSeeFieldTools && (
          <TouchableOpacity style={styles.linkCard} onPress={() => router.push('/emi-calculator')}>
            <Text style={styles.linkEmoji}>🧮</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.linkTitle}>EMI Calculator</Text>
              <Text style={styles.linkSubtitle}>Work out monthly loan payments</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f9fafb', padding: 20 },
  center: { flex: 1, backgroundColor: '#f9fafb', alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  signOut: { color: '#dc2626', fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 20, borderWidth: 1, borderColor: '#e5e7eb' },
  greeting: { color: '#6b7280', fontSize: 13 },
  name: { color: '#111827', fontSize: 18, fontWeight: '700', marginTop: 2, marginBottom: 10 },
  roleBadge: { alignSelf: 'flex-start', backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  roleBadgeText: { color: '#166534', fontSize: 12, fontWeight: '600' },
  quickLinks: { marginTop: 20, gap: 12 },
  linkCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  linkEmoji: { fontSize: 26 },
  linkTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  linkSubtitle: { fontSize: 12, color: '#6b7280', marginTop: 2 },
})
