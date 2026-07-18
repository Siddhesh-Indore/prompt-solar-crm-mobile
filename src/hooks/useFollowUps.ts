// src/hooks/useFollowUps.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { FollowUp } from '@/types/sales'

export function useMyFollowUps() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['follow-ups', user?.id],
    queryFn: async (): Promise<(FollowUp & { lead?: { id: string; name: string; phone: string } })[]> => {
      if (!user) return []
      const { data, error } = await supabase
        .from('follow_ups')
        .select('*, lead:lead_id(id, name, phone)')
        .eq('assigned_to', user.id)
        .eq('status', 'pending')
        .order('due_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as (FollowUp & { lead?: { id: string; name: string; phone: string } })[]
    },
    enabled: !!user,
  })
}

export interface NewFollowUpInput {
  lead_id: string
  due_at: string
  reason?: string
}

/** Postgres unique_violation — surfaced when a lead already has a pending follow-up. */
const UNIQUE_VIOLATION = '23505'

export function useCreateFollowUp() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: NewFollowUpInput): Promise<FollowUp> => {
      const { data, error } = await supabase
        .from('follow_ups')
        .insert({ ...input, assigned_to: user?.id ?? null })
        .select()
        .single()
      if (error) {
        if (error.code === UNIQUE_VIOLATION) {
          throw new Error('This lead already has a pending follow-up.')
        }
        throw error
      }

      await supabase.from('lead_activities').insert({
        lead_id: input.lead_id,
        actor_id: user?.id ?? null,
        action_type: 'follow_up_set',
        new_value: { due_at: input.due_at, reason: input.reason ?? null },
      })

      return data as unknown as FollowUp
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] })
      queryClient.invalidateQueries({ queryKey: ['lead-activities', variables.lead_id] })
    },
  })
}

export function useCompleteFollowUp() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, outcomeNote, status }: { id: string; outcomeNote?: string; status: 'completed' | 'dismissed' }) => {
      const { error } = await supabase
        .from('follow_ups')
        .update({ status, outcome_note: outcomeNote ?? null, completed_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] })
    },
  })
}
