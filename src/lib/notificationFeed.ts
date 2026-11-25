// src/lib/notificationFeed.ts
// The list behind Home's bell: everything about the exec's leads that wants a
// look right now. Built from data the app already has (visit pipeline, visit
// reports, pending follow-up reminders) — nothing is stored, so it is always
// current and clears itself as the exec acts. Pure; no React.
import { attentionFor, EMPTY_VISIT_INFO, isNewLead, isPlausibleVisitDate, localDateKey, type LeadVisitInfo } from '@/lib/visitBoard'
import type { PendingFollowUp } from '@/lib/reminderPlan'
import type { Lead } from '@/types/sales'

export type FeedKind =
  | 'followup_due'
  | 'visit_date_invalid'
  | 'visit_overdue'
  | 'visit_today'
  | 'followup_today'
  | 'intake_waiting'
  | 'follow_up_stale'
  | 'new_lead'

/** Most urgent first. */
const PRIORITY: FeedKind[] = [
  'followup_due', 'visit_date_invalid', 'visit_overdue', 'visit_today', 'followup_today', 'intake_waiting', 'follow_up_stale', 'new_lead',
]

export interface FeedItem {
  /** Unique within the list. */
  key: string
  kind: FeedKind
  leadId: string
  name: string
  phone: string
  /** One line saying why it is here. */
  detail: string
  /** Present for leads from the visit pipeline — lets the app open the lead. */
  lead?: Lead
}

function timeOf(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function dayAndTime(d: Date): string {
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}, ${timeOf(d)}`
}

function visitTime(time: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return `, ${timeOf(d)}`
}

export function buildNotificationFeed(input: {
  leads: Lead[]
  infoMap: Map<string, LeadVisitInfo> | undefined
  followUps: PendingFollowUp[]
  now?: Date
}): FeedItem[] {
  const now = input.now ?? new Date()
  const today = localDateKey(now)
  const items: FeedItem[] = []

  for (const f of input.followUps) {
    if (!f.lead) continue
    const due = new Date(f.due_at)
    const base = { leadId: f.lead_id, name: f.lead.name, phone: f.lead.phone }
    if (due.getTime() <= now.getTime()) {
      items.push({ ...base, key: `fu-${f.id}`, kind: 'followup_due', detail: `Follow-up due since ${dayAndTime(due)}${f.reason ? ` · ${f.reason}` : ''}` })
    } else if (localDateKey(due) === today) {
      items.push({ ...base, key: `fu-${f.id}`, kind: 'followup_today', detail: `Follow-up today at ${timeOf(due)}${f.reason ? ` · ${f.reason}` : ''}` })
    }
  }

  // Needs the visit reports to tell a first visit from a follow-up.
  if (input.infoMap) {
    for (const lead of input.leads) {
      const base = { leadId: lead.id, name: lead.name, phone: lead.phone, lead }
      const attention = attentionFor(lead, input.infoMap.get(lead.id) ?? EMPTY_VISIT_INFO, now)
      if (attention) {
        items.push({ ...base, key: `lead-${lead.id}`, kind: attention.kind === 'visit_date_invalid' ? 'visit_date_invalid' : attention.kind === 'visit_overdue' ? 'visit_overdue' : attention.kind === 'intake_waiting' ? 'intake_waiting' : 'follow_up_stale', detail: attention.label })
      } else if (lead.stage === 'visit_fixed' && isPlausibleVisitDate(lead.visit_date) && lead.visit_date!.slice(0, 10) === today) {
        items.push({ ...base, key: `lead-${lead.id}`, kind: 'visit_today', detail: `Visit today${visitTime(lead.visit_time)}` })
      } else if (lead.stage === 'visit_fixed' && isNewLead(lead, now)) {
        items.push({ ...base, key: `lead-${lead.id}`, kind: 'new_lead', detail: 'New lead — added in the last 24 hours' })
      }
    }
  }

  // One entry per customer — the most urgent reason wins.
  items.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind))
  const seen = new Set<string>()
  return items.filter((i) => (seen.has(i.leadId) ? false : (seen.add(i.leadId), true)))
}
