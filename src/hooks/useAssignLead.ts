// src/hooks/useAssignLead.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Lead } from '@/types/sales'

interface AssignInput {
  leadId: string
  role: 'telecaller' | 'sales_exec'
  userId: string
  previousUserId?: string | null
}

export function useAssignLead() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ leadId, role, userId, previousUserId }: AssignInput) => {
      const column: keyof Lead = role === 'telecaller' ? 'assigned_caller_id' : 'assigned_exec_id'
      const { data, error } = await supabase.from('leads').update({ [column]: userId }).eq('id', leadId).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Not allowed to assign this lead')

      const actionType = role === 'telecaller'
        ? (previousUserId ? 'caller_reassigned' : 'caller_assigned')
        : (previousUserId ? 'exec_reassigned' : 'exec_assigned')

      const idsToName = [userId, ...(previousUserId ? [previousUserId] : [])]
      const { data: namedProfiles } = await supabase.from('profiles').select('id, full_name').in('id', idsToName)
      const nameById = new Map((namedProfiles ?? []).map((p) => [p.id, p.full_name]))

      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        actor_id: user?.id ?? null,
        action_type: actionType,
        old_value: previousUserId ? { [column]: previousUserId, assignee_name: nameById.get(previousUserId) ?? null } : null,
        new_value: { [column]: userId, role, assignee_name: nameById.get(userId) ?? null },
      })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['lead', variables.leadId] })
      queryClient.invalidateQueries({ queryKey: ['lead-activities', variables.leadId] })
    },
  })
}
