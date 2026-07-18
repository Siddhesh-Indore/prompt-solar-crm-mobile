// src/hooks/useCallLogs.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { CallLog } from '@/types/sales'

export interface NewCallLogInput {
  lead_id: string
  call_type: CallLog['call_type']
  outcome?: CallLog['outcome']
  notes?: string
}

export function useLogCall() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: NewCallLogInput): Promise<CallLog> => {
      const { data, error } = await supabase
        .from('call_logs')
        .insert({ ...input, caller_id: user?.id ?? null })
        .select()
        .single()
      if (error) throw error
      return data as unknown as CallLog
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lead-activities', variables.lead_id] })
      queryClient.invalidateQueries({ queryKey: ['call-logs', variables.lead_id] })
    },
  })
}
