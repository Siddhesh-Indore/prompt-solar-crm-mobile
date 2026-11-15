// src/components/sales/TimeTrackingCard.tsx
// Sales-exec-only punch in / punch out attendance card for the Home screen.
// One session per IST day (migration 071) — once punched out, that's it
// until tomorrow. Each punch needs a front-camera selfie (migration 087).
import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { Ionicons } from '@expo/vector-icons'
import { SkeletonBlock } from '@/components/ui/Skeleton'
import { useTodayTimeLog, useClockIn, useClockOut, todayInIST } from '@/hooks/useTimeLogs'
import { useAuth } from '@/context/AuthContext'
import { uploadPhoto } from '@/lib/uploadPhoto'
import { brand } from '@/constants/brand'
import { hapticSuccess, hapticWarning } from '@/lib/haptics'

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
      if (path) clockIn.mutate(path, { onSuccess: hapticSuccess, onError: hapticWarning })
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
      if (path) clockOut.mutate({ id: logId, selfiePath: path }, { onSuccess: hapticSuccess, onError: hapticWarning })
    } catch (err) {
      Alert.alert('Could not punch out', err instanceof Error ? err.message : 'Try again.')
    } finally {
      setCapturing(false)
    }
  }

  const punchedIn = !!log && !log.clock_out_at
  const done = !!log && !!log.clock_out_at

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.iconWrap, done && styles.iconWrapDone]}>
          <Ionicons name={done ? 'checkmark' : 'time-outline'} size={20} color={done ? brand.greenDark : brand.navy} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Attendance</Text>
          {isLoading ? (
            <SkeletonBlock width={120} height={11} style={{ marginTop: 6 }} />
          ) : !log ? (
            <Text style={styles.subtitle}>Not punched in · selfie required</Text>
          ) : punchedIn ? (
            <Text style={styles.subtitle}>In since {formatTimeIST(log.clock_in_at)}</Text>
          ) : (
            <Text style={styles.subtitle}>
              {formatTimeIST(log.clock_in_at)} – {formatTimeIST(log.clock_out_at!)} · {formatDuration(log.clock_in_at, log.clock_out_at!)}
            </Text>
          )}
        </View>

        {!isLoading && !log && (
          <TouchableOpacity style={[styles.button, styles.clockInButton, busy && styles.buttonDisabled]} onPress={punchIn} disabled={busy}>
            {busy ? <ActivityIndicator size="small" color={brand.onGreen} /> : <Text style={styles.clockInText}>Punch In</Text>}
          </TouchableOpacity>
        )}
        {!isLoading && punchedIn && (
          <TouchableOpacity style={[styles.button, styles.clockOutButton, busy && styles.buttonDisabled]} onPress={() => punchOut(log!.id)} disabled={busy}>
            {busy ? <ActivityIndicator size="small" color={brand.danger} /> : <Text style={styles.clockOutText}>Punch Out</Text>}
          </TouchableOpacity>
        )}
      </View>

      {(clockIn.isError || clockOut.isError) && (
        <Text style={styles.error}>
          {(clockIn.error ?? clockOut.error) instanceof Error ? (clockIn.error ?? clockOut.error as Error).message : 'Something went wrong'}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: brand.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: brand.borderLight },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: brand.navySoft, alignItems: 'center', justifyContent: 'center' },
  iconWrapDone: { backgroundColor: brand.greenSoft },
  title: { fontSize: 14, fontWeight: '700', color: brand.ink },
  subtitle: { fontSize: 12, color: brand.muted, marginTop: 2 },
  button: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, minWidth: 96, alignItems: 'center', justifyContent: 'center' },
  buttonDisabled: { opacity: 0.6 },
  clockInButton: { backgroundColor: brand.green },
  clockInText: { fontSize: 13, fontWeight: '700', color: brand.onGreen },
  clockOutButton: { backgroundColor: brand.dangerSoft },
  clockOutText: { fontSize: 13, fontWeight: '700', color: brand.danger },
  error: { fontSize: 11, color: brand.danger, marginTop: 8 },
})
