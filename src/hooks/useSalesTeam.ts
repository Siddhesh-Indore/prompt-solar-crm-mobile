// src/hooks/useSalesTeam.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/context/AuthContext'

export function useSalesTeam(role: 'telecaller' | 'sales_exec') {
  return useQuery({
    queryKey: ['sales-team', role],
    queryFn: async (): Promise<Profile[]> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', role)
        // Ex-employees stay in the database (their history needs a name) but
        // shouldn't be offered as someone to hand a lead to.
        .eq('is_archived', false)
        .order('full_name')
      if (error) throw error
      return (data ?? []) as Profile[]
    },
  })
}
