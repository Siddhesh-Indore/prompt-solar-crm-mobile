// src/components/sales/LocationPhotoCapture.tsx
// Mandatory GPS + site photo capture for a visit report — every visit needs
// both, regardless of outcome, so admin can verify how many sites an exec
// actually visited. Only captures a point-in-time location (no background
// tracking): one GPS fix taken when this button is pressed.
import { useState } from 'react'
import { View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import * as Location from 'expo-location'
import * as ImagePicker from 'expo-image-picker'

export interface LocationPhotoValue {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  photoUri: string | null
}

interface LocationPhotoCaptureProps {
  value: LocationPhotoValue
  onChange: (value: LocationPhotoValue) => void
}

export default function LocationPhotoCapture({ value, onChange }: LocationPhotoCaptureProps) {
  const [locating, setLocating] = useState(false)

  async function captureLocation() {
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert(
          'Location permission needed',
          'Turn on location access for this app in your phone settings to tag the visit.',
        )
        return
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      onChange({
        ...value,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      })
    } catch (err) {
      Alert.alert('Could not get location', err instanceof Error ? err.message : 'Try again.')
    } finally {
      setLocating(false)
    }
  }

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Photos permission needed', 'Turn on photo library access for this app in your phone settings.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 })
    if (!result.canceled && result.assets[0]) {
      onChange({ ...value, photoUri: result.assets[0].uri })
    }
  }

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

  function choosePhotoSource() {
    Alert.alert('Add Site Photo', undefined, [
      { text: 'Take Photo', onPress: takePhoto },
      { text: 'Choose from Library', onPress: pickFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  const hasLocation = value.latitude != null && value.longitude != null
  const hasPhoto = !!value.photoUri

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Site Location & Photo <Text style={styles.required}>*</Text></Text>
      <Text style={styles.hint}>Required for every visit, even if not finalized.</Text>

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

      <TouchableOpacity style={[styles.button, hasPhoto && styles.buttonDone]} onPress={choosePhotoSource}>
        <Text style={[styles.buttonText, hasPhoto && styles.buttonTextDone]}>
          {hasPhoto ? '📷 Photo added — tap to change' : '📷 Add Site Photo'}
        </Text>
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
  hint: { fontSize: 11, color: '#9ca3af', marginBottom: 8 },
  button: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', backgroundColor: '#fff', marginBottom: 8,
  },
  buttonDone: { borderColor: '#4ade80', backgroundColor: '#f0fdf4' },
  buttonText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  buttonTextDone: { color: '#047857' },
  preview: { width: '100%', height: 160, borderRadius: 10, marginTop: 4 },
})
