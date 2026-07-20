// src/hooks/useClientIntake.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { ClientIntakeForm } from '@/types/sales'

export function useClientIntakeForm(leadId: string | undefined) {
  return useQuery({
    queryKey: ['client-intake-form', leadId],
    queryFn: async (): Promise<ClientIntakeForm | null> => {
      if (!leadId) return null
      const { data, error } = await supabase
        .from('client_intake_forms')
        .select('*')
        .eq('lead_id', leadId)
        .maybeSingle()
      if (error) throw error
      return data as unknown as ClientIntakeForm | null
    },
    enabled: !!leadId,
  })
}

export type NewIntakeInput = Omit<ClientIntakeForm, 'id' | 'exec_id' | 'created_at' | 'updated_at'>

export function useCreateClientIntakeForm() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: NewIntakeInput): Promise<ClientIntakeForm> => {
      const { data, error } = await supabase
        .from('client_intake_forms')
        .insert({ ...input, exec_id: user?.id ?? null })
        .select()
        .single()
      if (error) throw error

      // The lead is NOT marked converted here anymore — submitting the
      // intake form sends it to the customer on WhatsApp (filled PDF +
      // Approve/Disapprove) via whatsapp-notify, and only a genuine Approve
      // tap (relayed back through wa-approval-callback) sets stage=converted
      // and pushes the Meta/Google conversion signal.
      await supabase.from('lead_activities').insert({
        lead_id: input.lead_id,
        actor_id: user?.id ?? null,
        action_type: 'intake_form_filled',
        new_value: { payment_method: input.payment_method, total_cost: input.total_cost },
      })

      supabase.functions.invoke('whatsapp-notify', { body: { leadId: input.lead_id, event: 'finalized' } }).catch(() => {})

      return data as unknown as ClientIntakeForm
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['client-intake-form', variables.lead_id] })
      queryClient.invalidateQueries({ queryKey: ['lead-activities', variables.lead_id] })
      queryClient.invalidateQueries({ queryKey: ['lead', variables.lead_id] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}
