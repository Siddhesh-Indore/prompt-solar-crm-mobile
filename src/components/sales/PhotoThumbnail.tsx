// src/components/sales/PhotoThumbnail.tsx
// visit-photos and intake-photos are both private buckets, so the stored
// path alone isn't a viewable URL — each thumbnail fetches its own signed
// URL on mount. Mirrors the web CRM's PhotoThumbnail.tsx.
import { useEffect, useState } from 'react'
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { getSignedPhotoUrl } from '@/lib/photoUrl'
import { brand } from '@/constants/brand'

interface PhotoThumbnailProps {
  bucket: string
  path: string
  onPress?: (url: string) => void
}

export default function PhotoThumbnail({ bucket, path, onPress }: PhotoThumbnailProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSignedPhotoUrl(bucket, path).then((signedUrl) => {
      if (!cancelled) setUrl(signedUrl)
    })
    return () => { cancelled = true }
  }, [bucket, path])

  if (broken) {
    return (
      <View style={[styles.thumb, styles.broken]}>
        <Text style={styles.brokenText}>No photo</Text>
      </View>
    )
  }

  if (!url) {
    return <View style={[styles.thumb, styles.loading]} />
  }

  return (
    <TouchableOpacity onPress={() => onPress?.(url)} disabled={!onPress} activeOpacity={onPress ? 0.7 : 1}>
      <Image source={{ uri: url }} style={styles.thumb} resizeMode="cover" onError={() => setBroken(true)} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  thumb: { width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderColor: brand.borderLight, backgroundColor: '#fff' },
  loading: { backgroundColor: brand.surfaceAlt },
  broken: { alignItems: 'center', justifyContent: 'center', backgroundColor: brand.bg, borderStyle: 'dashed' },
  brokenText: { fontSize: 9, color: brand.faint, textAlign: 'center', paddingHorizontal: 4 },
})
