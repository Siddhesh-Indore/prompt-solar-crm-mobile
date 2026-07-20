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

      // Best-effort WhatsApp notification (via the Whatsapp Messenger app) —
      // never blocks or fails the call log itself. Only the two customer-
      // facing call types notify; follow-up/callback logs don't.
      const event = variables.call_type === 'qualification' ? 'qualification_call'
        : variables.call_type === 'pre_visit' ? 'pre_visit_call'
        : null
      if (event) {
        supabase.functions.invoke('whatsapp-notify', { body: { leadId: variables.lead_id, event } }).catch(() => {})
      }
    },
  })
}
