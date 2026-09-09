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

/** The source of truth for the client intake form's location + photo:
 * rather than asking the exec to capture a fresh GPS fix and photo again
 * at conversion time, reuse whatever they already recorded
 * on their first visit to this lead — location is mandatory on every visit
 * (027), so it's always present; the photo is only guaranteed on visit_number
 * 1 for the lead (061), so it may be null here if this exec's first visit
 * with this lead wasn't the lead's very first visit overall.
 *
 * Falls back to the lead's first visit report regardless of exec when the
 * person filling the form (e.g. an admin/manager completing it on the
 * exec's behalf) never logged a visit of their own. */
export function useFirstVisitReportForIntake(leadId: string | undefined, execId: string | undefined) {
  return useQuery({
    queryKey: ['first-visit-report-intake', leadId, execId],
    queryFn: async (): Promise<VisitReport | null> => {
      if (!leadId) return null
      if (execId) {
        const { data, error } = await supabase
          .from('visit_reports')
          .select('*')
          .eq('lead_id', leadId)
          .eq('exec_id', execId)
          .order('visited_at', { ascending: true })
          .limit(1)
          .maybeSingle()
        if (error) throw error
        if (data) return data as unknown as VisitReport
      }
      const { data, error } = await supabase
        .from('visit_reports')
        .select('*')
        .eq('lead_id', leadId)
        .order('visited_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as unknown as VisitReport | null
    },
    enabled: !!leadId,
  })
}

export interface VisitReportWithRelations extends VisitReport {
  lead: { id: string; name: string; phone: string; address: string | null } | null
}

/** One exec's visits on one calendar day, chronological — the data behind
 * Employee Timeline. `date` is a local Y-M-D string; bounded to a single day
 * so this never needs pagination regardless of how long the table grows.
 * Telecaller can read any exec's visits here (migration 084) — that's the
 * point of the feature, checking on a team member's day for coordination. */
export function useExecDayVisits(execId: string | undefined, date: string) {
  return useQuery({
    queryKey: ['visit-reports', 'exec-day', execId, date],
    queryFn: async (): Promise<VisitReportWithRelations[]> => {
      if (!execId) return []
      const dayStart = `${date}T00:00:00`
      const dayEnd = `${date}T23:59:59.999`
      const { data, error } = await supabase
        .from('visit_reports')
        .select('*, lead:lead_id(id, name, phone, address)')
        .eq('exec_id', execId)
        .gte('visited_at', dayStart)
        .lte('visited_at', dayEnd)
        .order('visited_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as VisitReportWithRelations[]
    },
    enabled: !!execId,
  })
}

export interface NewVisitReportInput {
  lead_id: string
  kw_interest?: number
  quote_discussed?: number
  outcome: VisitReport['outcome']
  next_step?: string
  notes?: string
  // latitude/longitude mandatory on every visit; photo_url only mandatory on
  // the first (migration 061) — callers (PostVisitForm) enforce exactly this
  // before the mutation ever runs, and the DB's CHECK constraint mirrors it.
  latitude: number
  longitude: number
  location_accuracy: number | null
  photo_url?: string
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
