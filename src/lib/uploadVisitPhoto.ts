// src/lib/uploadVisitPhoto.ts
// Uploads a locally-captured visit photo to the visit-photos storage bucket
// (migration 027) and returns its storage path. Path is
// {execId}/{leadId}/{timestamp}.jpg — the leading folder segment is the
// uploader's own auth.uid(), which is exactly what the bucket's RLS checks
// against, so ownership falls out of the path with no extra column needed.
import { supabase } from '@/lib/supabase'

export async function uploadVisitPhoto(execId: string, leadId: string, localUri: string): Promise<string> {
  // RN/Hermes handles arrayBuffer more reliably than Blob for a local
  // file:// URI — this is the pattern Supabase's own Expo docs recommend.
  const arraybuffer = await fetch(localUri).then((res) => res.arrayBuffer())

  const path = `${execId}/${leadId}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from('visit-photos').upload(path, arraybuffer, {
    contentType: 'image/jpeg',
  })
  if (error) throw error

  return path
}
