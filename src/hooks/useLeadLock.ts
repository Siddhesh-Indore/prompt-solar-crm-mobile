// src/hooks/useLeadLock.ts
// Wraps the acquire_lead_lock / release_lead_lock RPCs (same as the web CRM).
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Lead } from '@/types/sales'

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
      // Queue's server-paginated cache (useQueuePage) is a separate query
      // key from ['leads'] — a lock acquisition changes locked_by, which
      // the queue card renders.
      queryClient.invalidateQueries({ queryKey: ['queue-page'] })
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
    onSuccess: (data, variables) => {
      // Same full-table-refetch staleness as useAssignLead/useUpdateLead —
      // "released: true" unambiguously means these three fields are now
      // null server-side, so patch the cache directly rather than leaving
      // the card reading "Locked by ..." until the slow background
      // invalidateQueries refetch catches up.
      if (data.released) {
        queryClient.setQueriesData<Lead[]>({ queryKey: ['leads'] }, (old) =>
          old?.map((l) => (l.id === variables.leadId ? { ...l, locked_by: null, locked_at: null, lock_expires_at: null } : l))
        )
      }
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      // Queue's server-paginated cache (useQueuePage) is a separate query
      // key, not covered by the ['leads'] patch/invalidate above.
      queryClient.invalidateQueries({ queryKey: ['queue-page'] })
      queryClient.invalidateQueries({ queryKey: ['lead', variables.leadId] })
    },
  })
}
