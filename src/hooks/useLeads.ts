// src/hooks/useLeads.ts
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAllRows'
import type { Lead, LeadFilters } from '@/types/sales'

// Only the columns the Queue card actually renders — matches the web CRM's
// LIST_COLUMNS so useQueuePage transfers less than a full select('*') per page.
const LIST_COLUMNS = `
  id, name, phone, source, stage, temperature, address, approx_bill_amount, section,
  assigned_caller_id, assigned_exec_id, visit_date, visit_time, created_at,
  locked_by, locked_at, lock_expires_at,
  assigned_caller:assigned_caller_id(id, full_name),
  assigned_exec:assigned_exec_id(id, full_name),
  locked_by_profile:locked_by(id, full_name)
`

const QUEUE_STAGES = ['new', 'calling'] as const
const QUEUE_PAGE_SIZE = 50

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

export interface QueuePage {
  leads: Lead[]
  totalCount: number
}

// Server-side paginated telecaller queue — filters, sorts (hot -> warm ->
// cold via the temp_rank generated column, migration 031) and pages in
// Postgres, mirroring the web CRM's useQueuePage. Replaces the old
// useLeads() + client-side useMemo filter/sort, which downloaded and
// re-sorted every new/calling lead (thousands of rows) on every mount and
// every cache invalidation. Uses useInfiniteQuery (rather than web's
// page-based useQuery) since the Queue screen is a FlatList with
// onEndReached infinite scroll, not Prev/Next buttons.
//
// Unlike web, the pending-followup and call-outcome id lists are passed in
// as filter params (fetched by the caller via usePendingFollowupLeadIds /
// useLeadsByLastCallOutcome) rather than re-fetched inside queryFn on every
// page — those RPCs don't depend on the page being fetched, so there's no
// reason to repeat them per page.
export function useQueuePage(filters: {
  section?: string | null
  village?: string
  search?: string
  temperature?: LeadFilters['temperature'] | null
  assignedCallerId?: string | null
  callOutcome?: string | null
  /** Lead ids to exclude (pending follow-ups). */
  excludeLeadIds?: string[]
  /** When callOutcome is set, the matching lead ids — null means "no filter", [] means "nothing matches". */
  callOutcomeLeadIds?: string[] | null
}) {
  return useInfiniteQuery({
    queryKey: ['queue-page', filters],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<QueuePage> => {
      if (filters.callOutcomeLeadIds !== undefined && filters.callOutcomeLeadIds !== null && filters.callOutcomeLeadIds.length === 0) {
        return { leads: [], totalCount: 0 }
      }

      let query = supabase
        .from('leads')
        .select(LIST_COLUMNS, { count: 'exact' })
        .in('stage', QUEUE_STAGES)
        .order('temp_rank', { ascending: true })
        .order('created_at', { ascending: false })

      if (filters.section) query = query.eq('section', filters.section)
      if (filters.temperature) query = query.eq('temperature', filters.temperature)
      if (filters.assignedCallerId) query = query.eq('assigned_caller_id', filters.assignedCallerId)
      if (filters.village) {
        const term = filters.village.trim()
        if (term) query = query.ilike('address', `%${term}%`)
      }
      if (filters.search) {
        const term = filters.search.trim()
        if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
      }
      if (filters.excludeLeadIds && filters.excludeLeadIds.length > 0) {
        query = query.not('id', 'in', `(${filters.excludeLeadIds.join(',')})`)
      }
      if (filters.callOutcomeLeadIds) {
        query = query.in('id', filters.callOutcomeLeadIds)
      }

      const from = pageParam * QUEUE_PAGE_SIZE
      const { data, error, count } = await query.range(from, from + QUEUE_PAGE_SIZE - 1)
      if (error) throw error

      return { leads: (data ?? []) as unknown as Lead[], totalCount: count ?? 0 }
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.leads.length, 0)
      return loaded < lastPage.totalCount ? allPages.length : undefined
    },
  })
}

export function leadsQueryKey(filters?: LeadFilters) {
  return ['leads', filters ?? {}] as const
}

export function useLeads(filters?: LeadFilters, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: leadsQueryKey(filters),
    enabled: options?.enabled ?? true,
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
        if (filters?.stageIn) query = query.in('stage', filters.stageIn)
        if (filters?.temperature) query = query.eq('temperature', filters.temperature)
        if (filters?.assignedCallerId) query = query.eq('assigned_caller_id', filters.assignedCallerId)
        if (filters?.assignedExecId) query = query.eq('assigned_exec_id', filters.assignedExecId)
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
