// src/lib/reminderPlan.ts
// What a sales exec's day looks like, and the phone notifications that follow
// from it. Pure functions — no React, no expo-notifications — so the same
// numbers drive the Home "Today" card and the morning notification.
import { classifyActiveLead, EMPTY_VISIT_INFO, isPlausibleVisitDate, localDateKey, type LeadVisitInfo } from '@/lib/visitBoard'
import type { Lead } from '@/types/sales'

export interface PendingFollowUp {
  id: string
  lead_id: string
  due_at: string
  reason: string | null
  lead?: { id: string; name: string; phone: string }
}

export interface DaySummary {
  /** Scheduled for a visit on that day. */
  toVisit: number
  /** Visit date already passed and still not visited. */
  overdue: number
  /** Customers in Follow-up plus follow-up reminders due that day or earlier. */
  followUps: number
}

/** The day as the sales exec sees it, for the local date `dayKey`
 * ('YYYY-MM-DD'). Matches what the Visits board and Home show. */
export function daySummary(
  leads: Lead[],
  infoMap: Map<string, LeadVisitInfo> | undefined,
  followUps: PendingFollowUp[],
  dayKey: string,
): DaySummary {
  let toVisit = 0
  let overdue = 0
  const followUpLeadIds = new Set<string>()

  for (const lead of leads) {
    const date = lead.visit_date?.slice(0, 10)
    // A mistyped year (0026) isn't a real date to be overdue against.
    if (lead.stage === 'visit_fixed' && date && isPlausibleVisitDate(date)) {
      if (date === dayKey) toVisit++
      else if (date < dayKey) overdue++
    }
    // Visited, not finalized, no next visit booked.
    if (lead.stage === 'visited' && infoMap && classifyActiveLead(lead, infoMap.get(lead.id) ?? EMPTY_VISIT_INFO) === 'follow_up') {
      followUpLeadIds.add(lead.id)
    }
  }
  for (const f of followUps) {
    if (localDateKey(new Date(f.due_at)) <= dayKey) followUpLeadIds.add(f.lead_id)
  }
  return { toVisit, overdue, followUps: followUpLeadIds.size }
}

// ── Notifications ───────────────────────────────────────────────────────────
export const MORNING_HOUR = 9
/** How many mornings ahead are scheduled. The plan is rebuilt every time the
 * app is opened, so this only has to bridge the days it isn't. */
export const PLAN_DAYS = 7
/** Phones cap pending notifications (iOS: 64) — keep well under it. */
export const MAX_DUE_REMINDERS = 40

export interface PlannedNotification {
  id: string
  at: Date
  title: string
  body: string
  /** Where tapping it goes. */
  screen: '/todo'
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** Morning summaries for the coming days, plus one notification at the moment
 * each follow-up reminder falls due. A morning with nothing on it is skipped
 * rather than sending an empty nudge. */
export function buildReminderPlan(input: {
  leads: Lead[]
  infoMap: Map<string, LeadVisitInfo> | undefined
  followUps: PendingFollowUp[]
  now?: Date
}): PlannedNotification[] {
  const now = input.now ?? new Date()
  const plan: PlannedNotification[] = []

  for (let offset = 0; offset < PLAN_DAYS; offset++) {
    const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, MORNING_HOUR, 0, 0, 0)
    if (at.getTime() <= now.getTime()) continue
    const dayKey = localDateKey(at)
    const s = daySummary(input.leads, input.infoMap, input.followUps, dayKey)
    const parts = [
      s.toVisit > 0 ? `${plural(s.toVisit, 'visit')} today` : null,
      s.overdue > 0 ? `${s.overdue} overdue` : null,
      s.followUps > 0 ? plural(s.followUps, 'follow-up') : null,
    ].filter((p): p is string => !!p)
    if (parts.length === 0) continue
    plan.push({ id: `morning-${dayKey}`, at, title: 'Your day at a glance', body: parts.join(' · '), screen: '/todo' })
  }

  const due = input.followUps
    .filter((f) => f.lead && new Date(f.due_at).getTime() > now.getTime())
    .sort((a, b) => a.due_at.localeCompare(b.due_at))
    .slice(0, MAX_DUE_REMINDERS)
  for (const f of due) {
    plan.push({
      id: `follow-up-${f.id}`,
      at: new Date(f.due_at),
      title: `Follow-up due: ${f.lead!.name}`,
      body: [f.lead!.phone, f.reason].filter(Boolean).join(' · '),
      screen: '/todo',
    })
  }
  return plan
}
