// src/hooks/useExecWorkload.ts
// Everything a sales exec has in flight: leads still in the visit pipeline,
// what the visit reports say about each, and their pending follow-up
// reminders. One place so Home's Today card, the Needs attention list and the
// phone reminders all read the same data (React Query shares the requests).
import { useMemo } from 'react'
import { useLeads } from '@/hooks/useLeads'
import { useMyFollowUps } from '@/hooks/useFollowUps'
import { useLeadVisitInfo } from '@/hooks/useVisitBoard'
import type { Lead } from '@/types/sales'

const NO_LEADS: Lead[] = []

export function useExecWorkload(enabled: boolean, userId: string | undefined) {
  const { data: activeLeads = NO_LEADS, isLoading: leadsLoading } = useLeads(
    userId ? { stageIn: ['visit_fixed', 'visited'], assignedExecId: userId } : undefined,
    { enabled: enabled && !!userId },
  )
  const leadIds = useMemo(() => activeLeads.map((l) => l.id), [activeLeads])
  const { data: infoMap, isLoading: infoLoading } = useLeadVisitInfo(leadIds)
  const { data: followUps = [], isLoading: followUpsLoading } = useMyFollowUps()

  const waitingOnInfo = leadIds.length > 0 && infoLoading
  return { activeLeads, infoMap, followUps, loading: enabled && (leadsLoading || waitingOnInfo || followUpsLoading) }
}
