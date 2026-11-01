// src/lib/visitBoard.ts
// Pure logic behind the sales exec's Visits board: which stage a lead sits in
// and which date slot its next visit falls in. Everything is derived from
// data the app already records (lead stage, visit reports, intake form), so
// a card moves on its own the moment the exec logs a visit or submits the
// intake form — there is no manual drag, which would let the board drift
// from what actually happened.
import type { Lead, VisitReport } from '@/types/sales'

export type BoardStage = 'first_visit' | 'follow_up' | 'intake_pending' | 'advance_pending' | 'done' | 'lost'

export const BOARD_STAGES: { value: BoardStage; label: string; empty: string }[] = [
  { value: 'first_visit', label: 'First Visit', empty: 'No first visits waiting.' },
  { value: 'follow_up', label: 'Follow-up', empty: 'No customers to follow up with.' },
  { value: 'intake_pending', label: 'Intake Pending', empty: 'No finalized customers waiting on an intake form.' },
  { value: 'advance_pending', label: 'Advance Pending', empty: 'Every customer has paid their advance.' },
  { value: 'done', label: 'Done', empty: 'No completed customers yet.' },
  { value: 'lost', label: 'Lost', empty: 'No lost customers.' },
]

/** What the visit reports + intake form say about one lead. */
export interface LeadVisitInfo {
  visitCount: number
  lastVisitedAt: string | null
  lastOutcome: VisitReport['outcome'] | null
  hasIntake: boolean
}

export const EMPTY_VISIT_INFO: LeadVisitInfo = { visitCount: 0, lastVisitedAt: null, lastOutcome: null, hasIntake: false }

/** Stage for a lead still in the visit pipeline (visit_fixed / visited).
 * Returns null when it has already left it (intake form filled) — those
 * leads surface under Advance Pending / Done instead. */
export function classifyActiveLead(lead: Lead, info: LeadVisitInfo): BoardStage | null {
  if (info.hasIntake) return null
  if (lead.stage === 'visited' && info.lastOutcome === 'finalized') return 'intake_pending'
  if (lead.stage === 'visit_fixed' && info.visitCount === 0) return 'first_visit'
  if (lead.stage === 'visit_fixed' || lead.stage === 'visited') return 'follow_up'
  return null
}

export type DateSlot = 'overdue' | 'today' | 'tomorrow' | 'this_week' | 'later' | 'no_date'

export const DATE_SLOTS: { value: DateSlot; label: string }[] = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: 'this_week', label: 'Next 7 days' },
  { value: 'later', label: 'Later' },
  { value: 'no_date', label: 'No date set' },
]

function dayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

/** Whole days from today (local) to a 'YYYY-MM-DD' visit date; negative = past. */
export function daysUntil(visitDate: string, now: Date = new Date()): number {
  const [y, m, d] = visitDate.slice(0, 10).split('-').map(Number)
  return dayNumber(y, m, d) - dayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function dateSlot(visitDate: string | null, now: Date = new Date()): DateSlot {
  if (!visitDate) return 'no_date'
  const diff = daysUntil(visitDate, now)
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff <= 7) return 'this_week'
  return 'later'
}

/** Whole days since an ISO timestamp, never negative. */
export function daysSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000))
}

function visitSortKey(lead: Lead): string {
  // No date sorts last; time breaks ties within a day.
  return lead.visit_date ? `${lead.visit_date.slice(0, 10)} ${lead.visit_time ?? '00:00'}` : '9999-12-31'
}

/** Soonest scheduled visit first; leads with no visit date (follow-ups
 * waiting on a call) after them, longest-since-last-visit first. */
export function compareByVisit(infoFor: (id: string) => LeadVisitInfo) {
  return (a: Lead, b: Lead): number => {
    const byDate = visitSortKey(a).localeCompare(visitSortKey(b))
    if (byDate !== 0) return byDate
    return (infoFor(a.id).lastVisitedAt ?? '').localeCompare(infoFor(b.id).lastVisitedAt ?? '')
  }
}

/** Longest waiting first — an unsigned deal gets riskier the longer it sits. */
export function compareByLastVisitOldest(infoFor: (id: string) => LeadVisitInfo) {
  return (a: Lead, b: Lead): number =>
    (infoFor(a.id).lastVisitedAt ?? '').localeCompare(infoFor(b.id).lastVisitedAt ?? '')
}
