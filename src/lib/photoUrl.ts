// src/lib/photoUrl.ts
// visit-photos and intake-photos are both private buckets — a signed URL is
// required to actually view an image, and it expires rather than being a
// permanent public link. Mirrors the web CRM's src/lib/photoUrl.ts.
import { supabase } from '@/lib/supabase'

export async function getSignedPhotoUrl(bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600)
  if (error) return null
  return data.signedUrl
}
