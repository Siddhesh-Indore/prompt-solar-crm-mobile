// src/lib/uploadVisitPhoto.ts
// Uploads a locally-captured visit photo to the visit-photos storage bucket
// (migration 027) and returns its storage path. Path is
// {execId}/{leadId}/{timestamp}.jpg — the leading folder segment is the
// uploader's own auth.uid(), which is exactly what the bucket's RLS checks
// against, so ownership falls out of the path with no extra column needed.
//
// Every photo captured through this path used to end up as a corrupt
// ~14-byte object in storage: `fetch(localUri).then(res => res.arrayBuffer())`
// on a local file:// URI is unreliable on this Expo/Hermes setup — the fetch
// resolves without throwing but the resulting buffer doesn't actually
// contain the image data, so uploads "succeeded" while photos were
// unrecoverable ("File not found" from Storage, verified directly against
// the live bucket). expo-image-manipulator's saveAsync({ base64: true }) is
// a completely different native code path (no fetch involved) and doubles
// as the resize/compress step, so it fixes both problems at once.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { decode } from 'base64-arraybuffer'
import { supabase } from '@/lib/supabase'

const MAX_DIMENSION = 1600
const JPEG_QUALITY = 0.6

async function compressPhoto(localUri: string): Promise<string> {
  const original = await ImageManipulator.manipulate(localUri).renderAsync()
  const needsResize = original.width > MAX_DIMENSION || original.height > MAX_DIMENSION
  const rendered = needsResize
    ? await ImageManipulator.manipulate(localUri).resize({ width: MAX_DIMENSION }).renderAsync()
    : original
  const result = await rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG, base64: true })
  if (!result.base64) throw new Error('Failed to process photo')
  return result.base64
}

export async function uploadVisitPhoto(execId: string, leadId: string, localUri: string): Promise<string> {
  const base64 = await compressPhoto(localUri)

  const path = `${execId}/${leadId}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from('visit-photos').upload(path, decode(base64), {
    contentType: 'image/jpeg',
  })
  if (error) throw error

  return path
}
