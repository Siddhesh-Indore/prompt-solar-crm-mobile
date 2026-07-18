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
        .select()
        .single()
      if (error) throw error
      return data as unknown as Lead
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['lead', variables.id] })

      if (variables.previousStage !== 'visit_fixed' && data.stage === 'visit_fixed') {
        supabase.functions.invoke('push-conversion', { body: { leadId: variables.id, stage: 'qualified' } }).catch(() => {})
      }
    },
  })
}
