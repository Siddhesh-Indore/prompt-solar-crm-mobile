// src/components/sales/TimeTrackingCard.tsx
// Sales-exec-only clock-in/clock-out card for the Home screen. One session
// per IST day (migration 071) — once clocked out, that's it until tomorrow.
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useTodayTimeLog, useClockIn, useClockOut } from '@/hooks/useTimeLogs'

function formatTimeIST(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })
}

function formatDuration(startIso: string, endIso: string): string {
  const minutes = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

export default function TimeTrackingCard() {
  const { data: log, isLoading } = useTodayTimeLog()
  const clockIn = useClockIn()
  const clockOut = useClockOut()

  const busy = clockIn.isPending || clockOut.isPending

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Time Tracking</Text>

      {isLoading ? (
        <ActivityIndicator size="small" color="#4ade80" style={{ marginTop: 8 }} />
      ) : !log ? (
        <>
          <Text style={styles.subtitle}>You haven't clocked in today.</Text>
          <TouchableOpacity
            style={[styles.button, styles.clockInButton, busy && styles.buttonDisabled]}
            onPress={() => clockIn.mutate()}
            disabled={busy}
          >
            {clockIn.isPending ? <ActivityIndicator size="small" color="#052e16" /> : <Text style={styles.clockInText}>Clock In</Text>}
          </TouchableOpacity>
        </>
      ) : !log.clock_out_at ? (
        <>
          <Text style={styles.subtitle}>Clocked in at {formatTimeIST(log.clock_in_at)}</Text>
          <TouchableOpacity
            style={[styles.button, styles.clockOutButton, busy && styles.buttonDisabled]}
            onPress={() => clockOut.mutate(log.id)}
            disabled={busy}
          >
            {clockOut.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.clockOutText}>Clock Out</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <Text style={styles.subtitle}>
          Today: {formatTimeIST(log.clock_in_at)} – {formatTimeIST(log.clock_out_at)} ({formatDuration(log.clock_in_at, log.clock_out_at)})
        </Text>
      )}

      {(clockIn.isError || clockOut.isError) && (
        <Text style={styles.error}>
          {(clockIn.error ?? clockOut.error) instanceof Error ? (clockIn.error ?? clockOut.error as Error).message : 'Something went wrong'}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 12 },
  title: { fontSize: 14, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  button: { marginTop: 12, borderRadius: 10, paddingVertical: 11, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.6 },
  clockInButton: { backgroundColor: '#4ade80' },
  clockInText: { fontSize: 13, fontWeight: '700', color: '#052e16' },
  clockOutButton: { backgroundColor: '#dc2626' },
  clockOutText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  error: { fontSize: 11, color: '#dc2626', marginTop: 8 },
})
