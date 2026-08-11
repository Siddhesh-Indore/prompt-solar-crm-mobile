// src/lib/uploadIntakePhoto.ts
// Uploads one of the 3+ site photos required to submit a client intake form,
// to the intake-photos storage bucket (migration 069). Path is
// {execId}/{leadId}/{timestamp}-{index}.jpg — the index suffix keeps photos
// captured in the same second from overwriting each other.
import { uploadPhoto } from '@/lib/uploadPhoto'

export async function uploadIntakePhoto(execId: string, leadId: string, localUri: string, index: number): Promise<string> {
  return uploadPhoto('intake-photos', execId, leadId, localUri, `-${index}`)
}
