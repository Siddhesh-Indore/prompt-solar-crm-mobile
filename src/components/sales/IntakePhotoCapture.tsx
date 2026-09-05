// src/components/sales/IntakePhotoCapture.tsx
// Mandatory site photo for a converted/won lead — at least 1. Used to
// require 3 freshly-taken photos, but the exec's first visit to this lead
// already captured one (mandatory there — see visit_reports' photo_url) and
// ClientIntakeForm now auto-copies it in, so re-shooting 3 more here was
// pure duplicate effort. Camera stays the primary action for anything the
// exec adds beyond that (same reasoning as LocationPhotoCapture: an old
// photo from the gallery undercuts "proof this was actually installed");
// gallery is offered as a secondary option for genuine edge cases, not the
// default. Uploaded individually as they're taken rather than held until
// submit, so a slow connection doesn't stall the whole form at the end.
import { useState } from 'react'
import { View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet, Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { uploadIntakePhoto } from '@/lib/uploadIntakePhoto'

export const MIN_INTAKE_PHOTOS = 1

export interface IntakePhoto {
  localUri: string
  path: string | null
  uploading: boolean
}

interface IntakePhotoCaptureProps {
  execId: string
  leadId: string
  photos: IntakePhoto[]
  onChange: (photos: IntakePhoto[]) => void
}

export default function IntakePhotoCapture({ execId, leadId, photos, onChange }: IntakePhotoCaptureProps) {
  const [capturing, setCapturing] = useState(false)

  async function addPhoto(source: 'camera' | 'gallery') {
    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Camera permission needed', 'Turn on camera access for this app in your phone settings.')
        return
      }
    } else {
      // No broad media permission needed on Android (system Photo Picker) —
      // this request only actually does anything on iOS 10, per
      // expo-image-picker's own docs.
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Photo library permission needed', 'Turn on photo access for this app in your phone settings.')
        return
      }
    }
    setCapturing(true)
    try {
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 })
      if (result.canceled || !result.assets[0]) return

      const localUri = result.assets[0].uri
      const index = photos.length
      const next = [...photos, { localUri, path: null, uploading: true }]
      onChange(next)

      try {
        const path = await uploadIntakePhoto(execId, leadId, localUri, index)
        onChange(next.map((p, i) => (i === index ? { ...p, path, uploading: false } : p)))
      } catch (err) {
        onChange(next.filter((_, i) => i !== index))
        Alert.alert('Upload failed', err instanceof Error ? err.message : 'Could not upload the photo — try again.')
      }
    } finally {
      setCapturing(false)
    }
  }

  function removePhoto(index: number) {
    Alert.alert('Remove this photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onChange(photos.filter((_, i) => i !== index)) },
    ])
  }

  const uploadedCount = photos.filter((p) => p.path && !p.uploading).length
  const done = uploadedCount >= MIN_INTAKE_PHOTOS

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        Site Photos <Text style={styles.required}>*</Text>
      </Text>
      <Text style={styles.hint}>
        At least {MIN_INTAKE_PHOTOS} required to convert this lead ({uploadedCount}/{MIN_INTAKE_PHOTOS} uploaded).
      </Text>

      <View style={styles.grid}>
        {photos.map((p, i) => (
          <TouchableOpacity key={p.localUri + i} style={styles.thumbWrap} onPress={() => removePhoto(i)} disabled={p.uploading}>
            <Image source={{ uri: p.localUri }} style={styles.thumb} resizeMode="cover" />
            {p.uploading ? (
              <View style={styles.thumbOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            ) : (
              <View style={styles.removeBadge}>
                <Text style={styles.removeBadgeText}>✕</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.addTile} onPress={() => addPhoto('camera')} disabled={capturing}>
          {capturing ? <ActivityIndicator size="small" color="#6b7280" /> : <Text style={styles.addTileText}>📷{'\n'}Add Photo</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.addTile} onPress={() => addPhoto('gallery')} disabled={capturing}>
          <Text style={styles.addTileText}>🖼{'\n'}Gallery</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.statusPill, done && styles.statusPillDone]}>
        <Text style={[styles.statusPillText, done && styles.statusPillTextDone]}>
          {done ? `✓ ${uploadedCount} photos uploaded` : `${uploadedCount} of ${MIN_INTAKE_PHOTOS} photos uploaded`}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 2 },
  required: { color: '#dc2626' },
  hint: { fontSize: 11, color: '#9ca3af', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumbWrap: { width: 84, height: 84, borderRadius: 10, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  removeBadge: {
    position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center',
  },
  removeBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  addTile: {
    width: 84, height: 84, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#d1d5db',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb',
  },
  addTileText: { fontSize: 11, color: '#6b7280', textAlign: 'center', fontWeight: '600' },
  statusPill: { alignSelf: 'flex-start', marginTop: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#f3f4f6' },
  statusPillDone: { backgroundColor: '#f0fdf4' },
  statusPillText: { fontSize: 11, fontWeight: '600', color: '#6b7280' },
  statusPillTextDone: { color: '#15803d' },
})
