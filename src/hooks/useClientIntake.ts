// src/hooks/useClientIntake.ts
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { getSignedPhotoUrl } from '@/lib/photoUrl'
import type { ClientIntakeForm } from '@/types/sales'
import { remainingAfterAdvance } from '@/lib/subsidy'

export async function getIntakePhotoUrl(path: string): Promise<string | null> {
  return getSignedPhotoUrl('intake-photos', path)
}

export interface ClientIntakeFormWithRelations extends ClientIntakeForm {
  lead: { id: string; name: string; source: string; section: string | null } | null
  exec: { id: string; full_name: string } | null
}

export interface ClientIntakeFormsPageResult {
  forms: ClientIntakeFormWithRelations[]
  totalCount: number
}

// Every intake form ever signed, newest first — mirrors the web CRM's New
// Finalized Customers tab. client_intake_forms_select (migration 079) opens
// this to every internal role, not just admin/manager/the signing exec.
export function useAllClientIntakeForms(search: string | undefined, page: number, pageSize = 20) {
  return useQuery({
    queryKey: ['client-intake-forms-page', search ?? '', page, pageSize],
    queryFn: async (): Promise<ClientIntakeFormsPageResult> => {
      let query = supabase
        .from('client_intake_forms')
        .select('*, lead:lead_id(id, name, source, section), exec:exec_id(id, full_name)', { count: 'exact' })
        .order('created_at', { ascending: false })

      const term = search?.trim()
      if (term) query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,address.ilike.%${term}%`)

      const from = page * pageSize
      const { data, error, count } = await query.range(from, from + pageSize - 1)
      if (error) throw error
      return { forms: (data ?? []) as unknown as ClientIntakeFormWithRelations[], totalCount: count ?? 0 }
    },
    placeholderData: keepPreviousData,
  })
}

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

      // Filling the intake form is the sales exec's own signal that the
      // deal is won — the lead moves to 'converted' immediately, which is
      // what drops it off the exec's Todo/Visits lists. The customer still
      // gets the WhatsApp Approve/Disapprove notification below for their
      // own record, but it no longer gates the lead's stage the way it
      // used to (push-conversion, the Meta/Google ad platform signal,
      // still only fires from wa-approval-callback on a genuine Approve
      // tap — that timing is unchanged).
      await supabase.from('leads').update({ stage: 'converted' }).eq('id', input.lead_id)

      await supabase.from('lead_activities').insert({
        lead_id: input.lead_id,
        actor_id: user?.id ?? null,
        action_type: 'intake_form_filled',
        new_value: { payment_method: input.payment_method, total_cost: input.total_cost, stage: 'converted' },
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

export interface AdvanceReceivedInput {
  form: Pick<ClientIntakeForm, 'id' | 'lead_id' | 'total_cost' | 'subsidy_amount'>
  amount: number
  mode: 'cash' | 'online' | 'cheque'
}

// Records the advance for a customer who was finalized without paying one
// ("Customer has not paid advance") — this is what moves them out of the
// board's Advance Pending column. RLS refuses a disallowed UPDATE by matching
// zero rows rather than erroring, so it asks for the row back and treats an
// empty result as a permission failure.
export function useMarkAdvanceReceived() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ form, amount, mode }: AdvanceReceivedInput): Promise<void> => {
      const { data, error } = await supabase
        .from('client_intake_forms')
        .update({
          advance_mode: mode,
          cash_advance: amount,
          cash_remaining_after_install: remainingAfterAdvance(form.total_cost, amount, form.subsidy_amount ?? 0),
        })
        .eq('id', form.id)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error("You don't have permission to update this customer.")
    },
    onSuccess: (_data, { form }) => {
      queryClient.invalidateQueries({ queryKey: ['client-intake-form', form.lead_id] })
      queryClient.invalidateQueries({ queryKey: ['client-intake-forms-page'] })
      queryClient.invalidateQueries({ queryKey: ['visit-board'] })
    },
  })
}
