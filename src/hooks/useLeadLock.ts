// src/hooks/useLeadLock.ts
// Wraps the acquire_lead_lock / release_lead_lock RPCs (same as the web CRM).
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface AcquireLockResult {
  acquired: boolean
  held_by?: string
  until?: string
}

interface ReleaseLockResult {
  released: boolean
  error?: string
}

export function useAcquireLeadLock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (leadId: string): Promise<AcquireLockResult> => {
      const { data, error } = await supabase.rpc('acquire_lead_lock', { p_lead_id: leadId })
      if (error) throw error
      return data as AcquireLockResult
    },
    onSuccess: (_data, leadId) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
    },
  })
}

export function useReleaseLeadLock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ leadId, reason }: { leadId: string; reason?: string }): Promise<ReleaseLockResult> => {
      const { data, error } = await supabase.rpc('release_lead_lock', { p_lead_id: leadId, p_reason: reason ?? null })
      if (error) throw error
      return data as ReleaseLockResult
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['lead', variables.leadId] })
    },
  })
}
