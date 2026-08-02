// src/hooks/useAssignLead.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Lead } from '@/types/sales'

interface AssignInput {
  leadId: string
  role: 'telecaller' | 'sales_exec'
  /** null clears the assignment. */
  userId: string | null
  previousUserId?: string | null
}

export function useAssignLead() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async ({ leadId, role, userId, previousUserId }: AssignInput): Promise<{ assigneeName: string | null }> => {
      const column: keyof Lead = role === 'telecaller' ? 'assigned_caller_id' : 'assigned_exec_id'
      const { data, error } = await supabase.from('leads').update({ [column]: userId }).eq('id', leadId).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Not allowed to assign this lead')

      const actionType = role === 'telecaller'
        ? (userId ? (previousUserId ? 'caller_reassigned' : 'caller_assigned') : 'caller_unassigned')
        : (userId ? (previousUserId ? 'exec_reassigned' : 'exec_assigned') : 'exec_unassigned')

      const idsToName = [userId, previousUserId].filter((id): id is string => !!id)
      let nameById = new Map<string, string>()
      if (idsToName.length > 0) {
        const { data: namedProfiles } = await supabase.from('profiles').select('id, full_name').in('id', idsToName)
        nameById = new Map((namedProfiles ?? []).map((p) => [p.id, p.full_name]))
      }

      await supabase.from('lead_activities').insert({
        lead_id: leadId,
        actor_id: user?.id ?? null,
        action_type: actionType,
        old_value: previousUserId ? { [column]: previousUserId, assignee_name: nameById.get(previousUserId) ?? null } : null,
        new_value: userId ? { [column]: userId, role, assignee_name: nameById.get(userId) ?? null } : null,
      })

      return { assigneeName: userId ? (nameById.get(userId) ?? null) : null }
    },
    onSuccess: (data, variables) => {
      const column: keyof Lead = variables.role === 'telecaller' ? 'assigned_caller_id' : 'assigned_exec_id'
      const relationKey: keyof Lead = variables.role === 'telecaller' ? 'assigned_caller' : 'assigned_exec'

      // The mobile Queue/Visits/Todo screens all fetch every lead in one
      // unfiltered, unpaginated query (16,000+ rows on the real dataset) —
      // invalidateQueries alone means the picker sits showing the old
      // assignee for however long that full re-fetch takes, which reads as
      // "reassigning doesn't work" even though it already saved. Patch the
      // cached row directly so the UI reflects the change immediately;
      // invalidate too, as a background correctness net.
      queryClient.setQueriesData<Lead[]>({ queryKey: ['leads'] }, (old) =>
        old?.map((l) =>
          l.id === variables.leadId
            ? {
                ...l,
                [column]: variables.userId,
                [relationKey]: variables.userId && data.assigneeName
                  ? { id: variables.userId, full_name: data.assigneeName }
                  : undefined,
              }
            : l
        )
      )

      queryClient.invalidateQueries({ queryKey: ['leads'] })
      // Queue's server-paginated cache (useQueuePage) is a separate query
      // key, not covered by the ['leads'] patch/invalidate above.
      queryClient.invalidateQueries({ queryKey: ['queue-page'] })
      queryClient.invalidateQueries({ queryKey: ['lead', variables.leadId] })
      queryClient.invalidateQueries({ queryKey: ['lead-activities', variables.leadId] })
    },
  })
}
