// src/hooks/useFinalizedCustomers.ts
// Read-only on mobile — importing is an admin/manager-only web action.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { FinalizedCustomer } from '@/types/sales'

const PAGE_SIZE = 50

export function useFinalizedCustomers(search: string) {
  return useQuery({
    queryKey: ['finalized-customers', search],
    queryFn: async (): Promise<FinalizedCustomer[]> => {
      let query = supabase
        .from('finalized_customers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      const term = search.trim()
      if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,village.ilike.%${term}%`)

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as unknown as FinalizedCustomer[]
    },
  })
}
