// src/hooks/useLeadMutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Lead } from '@/types/sales'

export function useUpdateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Lead>; previousStage?: Lead['stage'] }): Promise<Lead> => {
      const { data, error } = await supabase
        .from('leads')
        .update(patch)
        .eq('id', id)
        // Same shape as useLeads' list query (including the joined
        // assignee/lock names) so the cache-patch below in onSuccess can
        // safely overwrite the cached row wholesale, without blanking out
        // the joined names a plain `.select()` wouldn't return.
        .select('*, assigned_caller:assigned_caller_id(id, full_name), assigned_exec:assigned_exec_id(id, full_name), locked_by_profile:locked_by(id, full_name)')
        .single()
      if (error) throw error
      return data as unknown as Lead
    },
    onSuccess: (data, variables) => {
      // Every screen that lists leads (Queue/Visits/Todo) fetches the whole
      // table in one unfiltered, unpaginated query (16,000+ rows on the
      // real dataset) — invalidateQueries alone leaves the list showing the
      // pre-update row for however long that full re-fetch takes, which
      // reads as "the status didn't save" even though it already did.
      // `data` is the full updated row (.select().single() above), so
      // patch the cached list directly; invalidate too, as a background
      // correctness net.
      queryClient.setQueriesData<Lead[]>({ queryKey: ['leads'] }, (old) =>
        old?.map((l) => (l.id === variables.id ? { ...l, ...data } : l))
      )
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      // Queue's server-paginated cache (useQueuePage) is a separate query
      // key, not covered by the ['leads'] patch/invalidate above.
      queryClient.invalidateQueries({ queryKey: ['queue-page'] })
      queryClient.invalidateQueries({ queryKey: ['lead', variables.id] })

      if (variables.previousStage !== 'visit_fixed' && data.stage === 'visit_fixed') {
        supabase.functions.invoke('push-conversion', { body: { leadId: variables.id, stage: 'qualified' } }).catch(() => {})
      }
    },
  })
}
