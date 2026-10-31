// src/components/sales/TimeTrackingCard.tsx
// Sales-exec-only punch in / punch out attendance card for the Home screen.
// One session per IST day (migration 071) — once punched out, that's it
// until tomorrow. Each punch needs a front-camera selfie (migration 087).
import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useTodayTimeLog, useClockIn, useClockOut, todayInIST } from '@/hooks/useTimeLogs'
import { useAuth } from '@/context/AuthContext'
import { uploadPhoto } from '@/lib/uploadPhoto'

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
  const { user } = useAuth()
  const [capturing, setCapturing] = useState(false)

  const busy = capturing || clockIn.isPending || clockOut.isPending

  // Front camera only, no gallery: a selfie picked from old photos would
  // defeat the point of proving who is punching right now.
  async function takeSelfie(kind: 'in' | 'out'): Promise<string | null> {
    if (!user?.id) return null
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Camera permission needed', 'Turn on camera access for this app in your phone settings to punch in or out.')
      return null
    }
    const result = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, quality: 0.6 })
    if (result.canceled || !result.assets[0]) return null
    return uploadPhoto('attendance-selfies', user.id, todayInIST(), result.assets[0].uri, `-${kind}`)
  }

  async function punchIn() {
    setCapturing(true)
    try {
      const path = await takeSelfie('in')
      if (path) clockIn.mutate(path)
    } catch (err) {
      Alert.alert('Could not punch in', err instanceof Error ? err.message : 'Try again.')
    } finally {
      setCapturing(false)
    }
  }

  async function punchOut(logId: string) {
    setCapturing(true)
    try {
      const path = await takeSelfie('out')
      if (path) clockOut.mutate({ id: logId, selfiePath: path })
    } catch (err) {
      Alert.alert('Could not punch out', err instanceof Error ? err.message : 'Try again.')
    } finally {
      setCapturing(false)
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Attendance</Text>

      {isLoading ? (
        <ActivityIndicator size="small" color="#4ade80" style={{ marginTop: 8 }} />
      ) : !log ? (
        <>
          <Text style={styles.subtitle}>You haven't punched in today. A selfie is required.</Text>
          <TouchableOpacity
            style={[styles.button, styles.clockInButton, busy && styles.buttonDisabled]}
            onPress={punchIn}
            disabled={busy}
          >
            {busy ? <ActivityIndicator size="small" color="#052e16" /> : <Text style={styles.clockInText}>Punch In</Text>}
          </TouchableOpacity>
        </>
      ) : !log.clock_out_at ? (
        <>
          <Text style={styles.subtitle}>Punched in at {formatTimeIST(log.clock_in_at)}</Text>
          <TouchableOpacity
            style={[styles.button, styles.clockOutButton, busy && styles.buttonDisabled]}
            onPress={() => punchOut(log.id)}
            disabled={busy}
          >
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.clockOutText}>Punch Out</Text>}
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
