// src/hooks/useCaptureLocation.ts
// One-shot GPS fix with mock-location rejection — extracted out of
// LocationPhotoCapture so the same "prove this is a real location, not a
// spoofed one" standard applies wherever else the app captures location
// (e.g. the client intake form).
import { useState } from 'react'
import { Alert } from 'react-native'
import * as Location from 'expo-location'

export interface CapturedLocation {
  latitude: number
  longitude: number
  accuracy: number | null
}

export function useCaptureLocation() {
  const [locating, setLocating] = useState(false)

  async function captureLocation(): Promise<CapturedLocation | null> {
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Location permission needed', 'Turn on location access for this app in your phone settings.')
        return null
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      // Android surfaces Location.isFromMockProvider() here — set when a
      // fake-GPS app has been enabled as the device's mock location
      // provider (Developer Options). Refuse the fix outright rather than
      // silently recording it, so a spoofed location can't slip through.
      if (position.mocked) {
        Alert.alert(
          'Mock location detected',
          "This device has a fake GPS / mock location app turned on. Turn it off in Developer Options (or uninstall it) and try again.",
        )
        return null
      }
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }
    } catch (err) {
      Alert.alert('Could not get location', err instanceof Error ? err.message : 'Try again.')
      return null
    } finally {
      setLocating(false)
    }
  }

  return { captureLocation, locating }
}
