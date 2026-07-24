// src/hooks/useVisitReports.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { VisitReport } from '@/types/sales'

export function useVisitReports(leadId: string | undefined) {
  return useQuery({
    queryKey: ['visit-reports', leadId],
    queryFn: async (): Promise<VisitReport[]> => {
      if (!leadId) return []
      const { data, error } = await supabase
        .from('visit_reports')
        .select('*, exec:exec_id(id, full_name)')
        .eq('lead_id', leadId)
        .order('visited_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as VisitReport[]
    },
    enabled: !!leadId,
  })
}

/** Latest visit report's outcome — 'finalized' is what unlocks the intake form. */
export function useLatestVisitOutcome(leadId: string | undefined) {
  const { data: reports = [] } = useVisitReports(leadId)
  return reports[0]?.outcome ?? null
}

export interface NewVisitReportInput {
  lead_id: string
  kw_interest?: number
  quote_discussed?: number
  outcome: VisitReport['outcome']
  next_step?: string
  notes?: string
  // Mandatory — see migration 027. Not marked optional here on purpose:
  // callers (PostVisitForm) must have already captured these before this
  // mutation ever runs, and the DB itself rejects a row missing any of them.
  latitude: number
  longitude: number
  location_accuracy: number | null
  photo_url: string
}

export function useCreateVisitReport() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: NewVisitReportInput): Promise<VisitReport> => {
      const { count } = await supabase
        .from('visit_reports')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', input.lead_id)

      const { data, error } = await supabase
        .from('visit_reports')
        .insert({ ...input, exec_id: user?.id ?? null, visit_number: (count ?? 0) + 1, visited_at: new Date().toISOString() })
        .select()
        .single()
      if (error) throw error

      await supabase.from('lead_activities').insert({
        lead_id: input.lead_id,
        actor_id: user?.id ?? null,
        action_type: 'visit_report_added',
        new_value: { outcome: input.outcome },
      })

      return data as unknown as VisitReport
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['visit-reports', variables.lead_id] })
      queryClient.invalidateQueries({ queryKey: ['lead-activities', variables.lead_id] })
      queryClient.invalidateQueries({ queryKey: ['lead', variables.lead_id] })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}
