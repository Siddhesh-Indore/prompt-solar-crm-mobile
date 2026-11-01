// src/hooks/useVisitBoard.ts
// Data for the sales exec's Visits board. All keys sit under 'visit-board' so
// one invalidation refreshes every column after a visit is logged, an intake
// form is submitted, or an advance is collected.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAllRows'
import { EMPTY_VISIT_INFO, type LeadVisitInfo } from '@/lib/visitBoard'
import type { Lead, VisitReport } from '@/types/sales'

// Keeps each .in() filter's URL comfortably under request-length limits.
const ID_CHUNK = 100
// Done / Lost are history, not work — newest few is enough and keeps the
// board light as the exec's closed deals pile up.
const HISTORY_LIMIT = 50

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Visit count, latest outcome and intake status for each lead id. */
export function useLeadVisitInfo(leadIds: string[]) {
  return useQuery({
    queryKey: ['visit-board', 'info', leadIds],
    enabled: leadIds.length > 0,
    queryFn: async (): Promise<Map<string, LeadVisitInfo>> => {
      const info = new Map<string, LeadVisitInfo>(leadIds.map((id) => [id, { ...EMPTY_VISIT_INFO }]))

      for (const ids of chunk(leadIds, ID_CHUNK)) {
        const [reports, intakes] = await Promise.all([
          supabase.from('visit_reports').select('lead_id, visited_at, outcome').in('lead_id', ids),
          supabase.from('client_intake_forms').select('lead_id').in('lead_id', ids),
        ])
        if (reports.error) throw reports.error
        if (intakes.error) throw intakes.error

        for (const r of (reports.data ?? []) as Pick<VisitReport, 'lead_id' | 'visited_at' | 'outcome'>[]) {
          const cur = info.get(r.lead_id)
          if (!cur) continue
          cur.visitCount += 1
          if (!cur.lastVisitedAt || r.visited_at > cur.lastVisitedAt) {
            cur.lastVisitedAt = r.visited_at
            cur.lastOutcome = r.outcome
          }
        }
        for (const i of (intakes.data ?? []) as { lead_id: string }[]) {
          const cur = info.get(i.lead_id)
          if (cur) cur.hasIntake = true
        }
      }
      return info
    },
  })
}

interface IntakeWithLead {
  lead: Lead | null
}

/** Customers whose intake form is in but who haven't paid the advance yet
 * (advance_mode = 'none'), longest waiting first. `execId` null = everyone's. */
export function useAdvancePendingLeads(execId: string | null) {
  return useQuery({
    queryKey: ['visit-board', 'advance-pending', execId],
    queryFn: async (): Promise<Lead[]> => {
      const rows = (await fetchAllRows(() => {
        let q = supabase
          .from('client_intake_forms')
          .select('created_at, lead:lead_id(*)')
          .eq('advance_mode', 'none')
          .order('created_at', { ascending: true })
        if (execId) q = q.eq('exec_id', execId)
        return q
      })) as unknown as IntakeWithLead[]
      return rows.map((r) => r.lead).filter((l): l is Lead => !!l)
    },
  })
}

/** Closed-out customers: intake form in and advance not outstanding. Only
 * fetched once the Done column is opened. */
export function useDoneLeads(execId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['visit-board', 'done', execId],
    enabled,
    queryFn: async (): Promise<Lead[]> => {
      let q = supabase
        .from('client_intake_forms')
        .select('created_at, lead:lead_id(*)')
        .or('advance_mode.is.null,advance_mode.neq.none')
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT)
      if (execId) q = q.eq('exec_id', execId)
      const { data, error } = await q
      if (error) throw error
      return ((data ?? []) as unknown as IntakeWithLead[]).map((r) => r.lead).filter((l): l is Lead => !!l)
    },
  })
}

/** Leads the exec lost after a visit. Only fetched once the Lost column is opened. */
export function useLostLeads(execId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['visit-board', 'lost', execId],
    enabled,
    queryFn: async (): Promise<Lead[]> => {
      let q = supabase.from('leads').select('*').eq('stage', 'lost').order('updated_at', { ascending: false }).limit(HISTORY_LIMIT)
      if (execId) q = q.eq('assigned_exec_id', execId)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as unknown as Lead[]
    },
  })
}
