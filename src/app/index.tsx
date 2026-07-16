import { Redirect } from 'expo-router'
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, SafeAreaView } from 'react-native'
import { useAuth } from '@/context/AuthContext'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  manager: 'Manager',
  telecaller: 'Telecaller',
  sales_exec: 'Sales Executive',
  viewer: 'Viewer',
}

export default function HomeScreen() {
  const { session, profile, loading, signOut } = useAuth()

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#4ade80" />
      </SafeAreaView>
    )
  }

  if (!session) return <Redirect href="/login" />

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Prompt-Solar CRM</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.greeting}>Signed in as</Text>
        <Text style={styles.name}>{profile?.full_name ?? session.user.email}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{profile ? (ROLE_LABELS[profile.role] ?? profile.role) : '…'}</Text>
        </View>
      </View>

      <Text style={styles.placeholder}>
        Telecaller queue and sales-exec visit screens land here next.
      </Text>
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
  placeholder: { textAlign: 'center', color: '#9ca3af', fontSize: 13, marginTop: 24 },
})
