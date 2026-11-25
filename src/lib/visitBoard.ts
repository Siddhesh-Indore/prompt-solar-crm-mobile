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

/** Local 'YYYY-MM-DD'. toISOString() is UTC, which puts early-morning and
 * evening times on the wrong calendar day in India. */
export function localDateKey(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function dayNumber(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

/** Whole days from today (local) to a 'YYYY-MM-DD' visit date; negative = past. */
export function daysUntil(visitDate: string, now: Date = new Date()): number {
  const [y, m, d] = visitDate.slice(0, 10).split('-').map(Number)
  return dayNumber(y, m, d) - dayNumber(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

/** A visit date in a believable year. A mistyped year (0026 for 2026) would
 * otherwise read as ~100 years overdue — and JavaScript's Date.UTC quietly
 * turns years 0-99 into 1900-1999. */
export function isPlausibleVisitDate(visitDate: string | null): boolean {
  if (!visitDate) return false
  const year = Number(visitDate.slice(0, 4))
  return year >= 2020 && year <= 2100
}

export function dateSlot(visitDate: string | null, now: Date = new Date()): DateSlot {
  if (!visitDate || !isPlausibleVisitDate(visitDate)) return 'no_date'
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

const NEW_LEAD_WINDOW_MS = 24 * 60 * 60 * 1000

/** Added in the last 24 hours — what an exec just entered in the field (or
 * was just handed), as opposed to a visit planned days ago. */
export function isNewLead(lead: Lead, now: Date = new Date()): boolean {
  return now.getTime() - new Date(lead.created_at).getTime() < NEW_LEAD_WINDOW_MS
}

/** Newly added leads first, newest at the very top, then the usual
 * soonest-visit order. Used where a fresh lead should be seen before
 * anything already scheduled. */
export function compareNewFirstThenVisit(infoFor: (id: string) => LeadVisitInfo) {
  const byVisit = compareByVisit(infoFor)
  return (a: Lead, b: Lead): number => {
    const aNew = isNewLead(a)
    const bNew = isNewLead(b)
    if (aNew !== bNew) return aNew ? -1 : 1
    if (aNew && bNew) return b.created_at.localeCompare(a.created_at)
    return byVisit(a, b)
  }
}

/** Has a pre-visit call been logged for the visit about to happen? A visit
 * report closes out the previous visit, so only a pre-visit call made after
 * the last visit report counts (or any pre-visit call, when there's been no
 * visit yet). Anyone's call counts — a telecaller's confirmation call too. */
export function hasPreVisitCallSince(calls: { call_type: string; called_at: string }[], lastVisitAt: string | null): boolean {
  return calls.some((c) => c.call_type === 'pre_visit' && (!lastVisitAt || c.called_at > lastVisitAt))
}

/** Longest waiting first — an unsigned deal gets riskier the longer it sits. */
export function compareByLastVisitOldest(infoFor: (id: string) => LeadVisitInfo) {
  return (a: Lead, b: Lead): number =>
    (infoFor(a.id).lastVisitedAt ?? '').localeCompare(infoFor(b.id).lastVisitedAt ?? '')
}

/** Search box match for a lead: letters search the name, digits search the
 * phone number (so "98765" finds +91 98765 43210 whatever the spacing). */
export function matchesLeadQuery(lead: Pick<Lead, 'name' | 'phone'>, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (/[a-z]/.test(q)) return lead.name.toLowerCase().includes(q)
  const digits = q.replace(/\D/g, '')
  return digits.length > 0 && lead.phone.replace(/\D/g, '').includes(digits)
}

// ── Needs attention ─────────────────────────────────────────────────────────
// Past this many days without a visit, a waiting follow-up is flagged.
export const STALE_AFTER_DAYS = 7
// A finalized customer is waiting on the intake form — don't let it sit.
export const INTAKE_WAITING_AFTER_DAYS = 2

export type AttentionKind = 'visit_date_invalid' | 'visit_overdue' | 'follow_up_stale' | 'intake_waiting'

export interface Attention {
  kind: AttentionKind
  /** How long it has been waiting — what the list is sorted by. */
  days: number
  label: string
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** Why a lead in the visit pipeline needs the exec's attention now, or null
 * when it doesn't: a visit whose date has passed, a follow-up nobody has
 * visited for a week, or a finalized customer still waiting on the intake
 * form. Upcoming visits and recent follow-ups are fine as they are. */
export function attentionFor(lead: Lead, info: LeadVisitInfo, now: Date = new Date()): Attention | null {
  const stage = classifyActiveLead(lead, info)
  if (!stage) return null

  if (lead.stage === 'visit_fixed' && lead.visit_date) {
    // A mistyped year can't be "overdue by N days" — say the date is wrong, and
    // list it first so it gets fixed.
    if (!isPlausibleVisitDate(lead.visit_date)) {
      return { kind: 'visit_date_invalid', days: Number.MAX_SAFE_INTEGER, label: `Visit date looks wrong (${lead.visit_date.slice(0, 10)}) — set a new date` }
    }
    const late = -daysUntil(lead.visit_date, now)
    return late > 0 ? { kind: 'visit_overdue', days: late, label: `Visit was due ${plural(late, 'day')} ago` } : null
  }

  if (!info.lastVisitedAt) return null
  const waited = daysSince(info.lastVisitedAt, now)
  if (stage === 'follow_up' && lead.stage === 'visited' && waited >= STALE_AFTER_DAYS) {
    return { kind: 'follow_up_stale', days: waited, label: `Not visited for ${plural(waited, 'day')}` }
  }
  if (stage === 'intake_pending' && waited >= INTAKE_WAITING_AFTER_DAYS) {
    return { kind: 'intake_waiting', days: waited, label: `Finalized ${plural(waited, 'day')} ago — intake form pending` }
  }
  return null
}
