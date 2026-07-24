// src/hooks/useLeads.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAllRows'
import type { Lead, LeadFilters } from '@/types/sales'

// Marking a call No Answer or Call Back creates a pending follow_ups row
// (see QualificationForm) — once that's set, the lead has moved from
// "needs calling" to "follow up on this date," so the Telecaller Queue
// hides it. Goes through an RPC (matching the web CRM's useQueuePage)
// rather than a direct select on follow_ups because follow_ups_select only
// lets a telecaller see follow-ups assigned to themselves, but the queue's
// unassigned pool — and this exclusion — needs to apply regardless of who
// owns the follow-up.
export function usePendingFollowupLeadIds() {
  return useQuery({
    queryKey: ['pending-followup-lead-ids'],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc('get_pending_followup_lead_ids')
      if (error) throw error
      return ((data ?? []) as unknown as string[]).filter(Boolean)
    },
  })
}

// Same reasoning as above, for the queue's call-outcome filter —
// call_logs_select is scoped to the caller's own calls.
export function useLeadsByLastCallOutcome(outcome: string | undefined) {
  return useQuery({
    queryKey: ['leads-by-last-call-outcome', outcome],
    queryFn: async (): Promise<string[]> => {
      if (!outcome) return []
      const { data, error } = await supabase.rpc('get_leads_by_last_call_outcome', { p_outcome: outcome })
      if (error) throw error
      return ((data ?? []) as unknown as string[]).filter(Boolean)
    },
    enabled: !!outcome,
  })
}

export function leadsQueryKey(filters?: LeadFilters) {
  return ['leads', filters ?? {}] as const
}

export function useLeads(filters?: LeadFilters) {
  return useQuery({
    queryKey: leadsQueryKey(filters),
    queryFn: async (): Promise<Lead[]> => {
      // Rebuilt fresh on every page — a supabase-js query builder is
      // single-use once awaited, so .range() can't be called in a loop on
      // one shared instance.
      const buildQuery = () => {
        let query = supabase
          .from('leads')
          .select('*, assigned_caller:assigned_caller_id(id, full_name), assigned_exec:assigned_exec_id(id, full_name), locked_by_profile:locked_by(id, full_name)')
          .order('created_at', { ascending: false })

        if (filters?.source) query = query.eq('source', filters.source)
        if (filters?.stage) query = query.eq('stage', filters.stage)
        if (filters?.temperature) query = query.eq('temperature', filters.temperature)
        if (filters?.search) {
          const term = filters.search.trim()
          if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
        }

        return query
      }

      return (await fetchAllRows(buildQuery)) as unknown as Lead[]
    },
  })
}
