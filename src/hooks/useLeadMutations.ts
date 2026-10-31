// src/hooks/useLeadMutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Lead, LeadSource } from '@/types/sales'

export interface NewLeadInput {
  name: string
  phone: string
  address?: string
  source: LeadSource
  notes?: string
}

export interface DuplicateLead {
  id: string
  name: string
  phone: string
  stage: Lead['stage']
  source: LeadSource
  created_at: string
}

/** Existing leads sharing the same last-10-digit phone number, across every
 * lead — not just the ones this user can see — via find_leads_by_phone
 * (migration 086), since leads_select would otherwise hide a telecaller's
 * lead from a sales exec and let a duplicate through. */
export async function findDuplicateLeadsByPhone(phone: string): Promise<DuplicateLead[]> {
  const normalized = phone.replace(/\D/g, '').slice(-10)
  if (normalized.length < 10) return []
  const { data, error } = await supabase.rpc('find_leads_by_phone', { p_phone: normalized })
  if (error) throw error
  return (data ?? []) as unknown as DuplicateLead[]
}

export function useCreateLead() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: NewLeadInput): Promise<Lead> => {
      // A sales exec can only read leads assigned to them (leads_select), so
      // the lead has to be assigned to its creator or the insert's own
      // RETURNING would be rejected by RLS. It still lands in the
      // telecaller's unassigned pool (assigned_caller_id stays null) for
      // qualification, same as any other new lead.
      const { data, error } = await supabase
        .from('leads')
        .insert({ ...input, stage: 'new', assigned_exec_id: user?.id ?? null })
        .select()
        .single()
      if (error) throw error

      const lead = data as unknown as Lead

      await supabase.from('lead_activities').insert({
        lead_id: lead.id,
        actor_id: user?.id ?? null,
        action_type: 'lead_created',
        new_value: { source: input.source },
      })

      // Keep the customer directory complete — same bookkeeping the web
      // CRM does on every lead creation (SECURITY DEFINER RPC, so it works
      // for roles that can't touch the customers table directly).
      await supabase.rpc('upsert_customer_for_lead', {
        p_name: input.name,
        p_phone: input.phone,
        p_address: input.address ?? null,
        p_source: input.source,
        p_notes: input.notes ?? null,
        p_lead_id: lead.id,
      })

      return lead
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['leads-page'] })
      queryClient.invalidateQueries({ queryKey: ['queue-page'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Lead>; previousStage?: Lead['stage'] }): Promise<Lead> => {
      const { data, error } = await supabase
        .from('leads')
        .update(patch)
        .eq('id', id)
        // Same shape as useLeads' list query (including the joined
        // assignee/lock names) so the cache-patch below in onSuccess can
        // safely overwrite the cached row wholesale, without blanking out
        // the joined names a plain `.select()` wouldn't return.
        .select('*, assigned_caller:assigned_caller_id(id, full_name), assigned_exec:assigned_exec_id(id, full_name), locked_by_profile:locked_by(id, full_name)')
        .single()
      if (error) throw error
      return data as unknown as Lead
    },
    onSuccess: (data, variables) => {
      // Every screen that lists leads (Queue/Visits/Todo) fetches the whole
      // table in one unfiltered, unpaginated query (16,000+ rows on the
      // real dataset) — invalidateQueries alone leaves the list showing the
      // pre-update row for however long that full re-fetch takes, which
      // reads as "the status didn't save" even though it already did.
      // `data` is the full updated row (.select().single() above), so
      // patch the cached list directly; invalidate too, as a background
      // correctness net.
      queryClient.setQueriesData<Lead[]>({ queryKey: ['leads'] }, (old) =>
        old?.map((l) => (l.id === variables.id ? { ...l, ...data } : l))
      )
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      // Queue's server-paginated cache (useQueuePage) is a separate query
      // key, not covered by the ['leads'] patch/invalidate above.
      queryClient.invalidateQueries({ queryKey: ['queue-page'] })
      queryClient.invalidateQueries({ queryKey: ['lead', variables.id] })

      if (variables.previousStage !== 'visit_fixed' && data.stage === 'visit_fixed') {
        supabase.functions.invoke('push-conversion', { body: { leadId: variables.id, stage: 'qualified' } }).catch(() => {})
      }
    },
  })
}
