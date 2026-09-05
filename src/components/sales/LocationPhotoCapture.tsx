// src/components/sales/LocationPhotoCapture.tsx
// Mandatory GPS + site photo capture for a visit report — every visit needs
// both, regardless of outcome, so admin can verify how many sites an exec
// actually visited. Only captures a point-in-time location (no background
// tracking): one GPS fix taken when this button is pressed.
import { View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useCaptureLocation } from '@/hooks/useCaptureLocation'

export interface LocationPhotoValue {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  photoUri: string | null
}

interface LocationPhotoCaptureProps {
  value: LocationPhotoValue
  onChange: (value: LocationPhotoValue) => void
  /** Defaults to true — pass false once the site's already been photographed
   * on an earlier visit for this lead (see PostVisitForm). */
  photoRequired?: boolean
}

export default function LocationPhotoCapture({ value, onChange, photoRequired = true }: LocationPhotoCaptureProps) {
  const { captureLocation: getLocation, locating } = useCaptureLocation()

  async function captureLocation() {
    const location = await getLocation()
    if (location) onChange({ ...value, ...location })
  }

  // Camera stays the primary action — choosing an old photo from the
  // gallery instead of one taken live at the site would undercut the proof
  // of visit this exists for. Gallery is offered as a secondary option
  // below for the genuine edge cases (e.g. a photo taken moments earlier
  // when the camera flow didn't save cleanly), not as the default path.
  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Camera permission needed', 'Turn on camera access for this app in your phone settings.')
      return
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6 })
    if (!result.canceled && result.assets[0]) {
      onChange({ ...value, photoUri: result.assets[0].uri })
    }
  }

  // Uses the OS-level photo picker (Android's system Photo Picker on API
  // 33+, the equivalent limited-access picker on iOS) — no broad media
  // permission needed on Android; requestMediaLibraryPermissionsAsync is a
  // no-op there and only actually required on iOS 10, per expo-image-picker's
  // own docs.
  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Photo library permission needed', 'Turn on photo access for this app in your phone settings.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 })
    if (!result.canceled && result.assets[0]) {
      onChange({ ...value, photoUri: result.assets[0].uri })
    }
  }

  const hasLocation = value.latitude != null && value.longitude != null
  const hasPhoto = !!value.photoUri

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        Site Location {photoRequired && '& Photo'} <Text style={styles.required}>*</Text>
        {!photoRequired && <Text style={styles.optionalNote}> (photo optional — already captured earlier)</Text>}
      </Text>
      <Text style={styles.hint}>
        {photoRequired ? 'Both required for every visit, even if not finalized.' : 'Location is still required; retake the photo only if you want to update it.'}
      </Text>

      <TouchableOpacity
        style={[styles.button, hasLocation && styles.buttonDone]}
        onPress={captureLocation}
        disabled={locating}
      >
        {locating ? (
          <ActivityIndicator size="small" color="#6b7280" />
        ) : (
          <Text style={[styles.buttonText, hasLocation && styles.buttonTextDone]}>
            {hasLocation
              ? `📍 Location captured (±${value.accuracy ? Math.round(value.accuracy) : '?'}m)`
              : '📍 Capture Location'}
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity style={[styles.button, hasPhoto && styles.buttonDone]} onPress={takePhoto}>
        <Text style={[styles.buttonText, hasPhoto && styles.buttonTextDone]}>
          {hasPhoto ? '📷 Photo added — tap to retake' : '📷 Take Site Photo'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.galleryLink} onPress={pickFromGallery}>
        <Text style={styles.galleryLinkText}>Choose from gallery instead</Text>
      </TouchableOpacity>

      {hasPhoto && (
        <Image source={{ uri: value.photoUri! }} style={styles.preview} resizeMode="cover" />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 2 },
  required: { color: '#dc2626' },
  optionalNote: { color: '#9ca3af', fontWeight: '400' },
  hint: { fontSize: 11, color: '#9ca3af', marginBottom: 8 },
  button: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', backgroundColor: '#fff', marginBottom: 8,
  },
  buttonDone: { borderColor: '#4ade80', backgroundColor: '#f0fdf4' },
  buttonText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  buttonTextDone: { color: '#047857' },
  galleryLink: { alignItems: 'center', paddingVertical: 6, marginBottom: 4 },
  galleryLinkText: { fontSize: 12, color: '#6b7280', textDecorationLine: 'underline' },
  preview: { width: '100%', height: 160, borderRadius: 10, marginTop: 4 },
})
