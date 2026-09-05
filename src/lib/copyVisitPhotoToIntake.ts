// src/lib/copyVisitPhotoToIntake.ts
// Copies a photo already captured on a visit report (visit-photos bucket)
// into the intake-photos bucket, so the client intake form's photo can be
// auto-sourced from the exec's first visit instead of asking them to
// retake it. A server-side storage copy — no download/re-upload needed —
// which supabase-js supports cross-bucket via `destinationBucket`.
import { supabase } from '@/lib/supabase'

export async function copyVisitPhotoToIntake(execId: string, leadId: string, sourcePath: string, index: number): Promise<string> {
  const toPath = `${execId}/${leadId}/${Date.now()}-${index}.jpg`
  const { data, error } = await supabase.storage
    .from('visit-photos')
    .copy(sourcePath, toPath, { destinationBucket: 'intake-photos' })
  if (error) throw error

  return data.path
}
