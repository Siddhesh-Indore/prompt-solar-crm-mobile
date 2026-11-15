// src/components/sales/IntakeLocationCapture.tsx
// Optional location on the client intake form — a live GPS fix (same
// mock-location-rejecting capture as visit reports), a pasted Google Maps
// link, or both. Unlike the visit report's location, neither is required:
// the intake form's address field already captures where the customer is,
// this is just a more precise supplement when it's easy to add.
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { useCaptureLocation } from '@/hooks/useCaptureLocation'
import { brand } from '@/constants/brand'

export interface IntakeLocationValue {
  latitude: number | null
  longitude: number | null
  accuracy: number | null
  mapsLink: string
}

interface IntakeLocationCaptureProps {
  value: IntakeLocationValue
  onChange: (value: IntakeLocationValue) => void
}

export default function IntakeLocationCapture({ value, onChange }: IntakeLocationCaptureProps) {
  const { captureLocation, locating } = useCaptureLocation()
  const hasGps = value.latitude != null && value.longitude != null

  async function handleCapture() {
    const location = await captureLocation()
    if (location) onChange({ ...value, latitude: location.latitude, longitude: location.longitude, accuracy: location.accuracy })
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Location <Text style={styles.optional}>(optional)</Text></Text>
      <Text style={styles.hint}>Capture a live GPS fix, paste a Google Maps link, or both.</Text>

      <TouchableOpacity style={[styles.button, hasGps && styles.buttonDone]} onPress={handleCapture} disabled={locating}>
        {locating ? (
          <ActivityIndicator size="small" color={brand.muted} />
        ) : (
          <Text style={[styles.buttonText, hasGps && styles.buttonTextDone]}>
            {hasGps ? `📍 Location captured (±${value.accuracy ? Math.round(value.accuracy) : '?'}m)` : '📍 Capture Location'}
          </Text>
        )}
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        value={value.mapsLink}
        onChangeText={(v) => onChange({ ...value, mapsLink: v })}
        placeholder="Or paste a Google Maps link…"
        placeholderTextColor={brand.faint}
        autoCapitalize="none"
        keyboardType="url"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: brand.text, marginBottom: 2 },
  optional: { color: brand.faint, fontWeight: '400' },
  hint: { fontSize: 11, color: brand.faint, marginBottom: 8 },
  button: {
    borderWidth: 1, borderColor: brand.border, borderRadius: 10, paddingVertical: 12,
    alignItems: 'center', backgroundColor: '#fff', marginBottom: 8,
  },
  buttonDone: { borderColor: brand.green, backgroundColor: brand.greenTint },
  buttonText: { fontSize: 13, fontWeight: '600', color: brand.text },
  buttonTextDone: { color: brand.greenDark },
  input: {
    borderWidth: 1, borderColor: brand.border, borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 11, fontSize: 13, color: brand.ink, backgroundColor: '#fff',
  },
})
