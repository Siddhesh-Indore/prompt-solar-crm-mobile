// src/lib/uploadVisitPhoto.ts
// Uploads a locally-captured visit photo to the visit-photos storage bucket
// (migration 027) and returns its storage path. Path is
// {execId}/{leadId}/{timestamp}.jpg — the leading folder segment is the
// uploader's own auth.uid(), which is exactly what the bucket's RLS checks
// against, so ownership falls out of the path with no extra column needed.
// Compress/upload core lives in uploadPhoto.ts, shared with uploadIntakePhoto.ts.
import { uploadPhoto } from '@/lib/uploadPhoto'

export async function uploadVisitPhoto(execId: string, leadId: string, localUri: string): Promise<string> {
  return uploadPhoto('visit-photos', execId, leadId, localUri)
}
