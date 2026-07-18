// src/hooks/useLeads.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAllRows'
import type { Lead, LeadFilters } from '@/types/sales'

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
