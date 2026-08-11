// src/lib/subsidy.ts
// Mirrors the web CRM's src/lib/subsidy.ts — government subsidy rules, kept
// in one place because they decide real money on the intake form.
//
// PM Surya Ghar pays residential rooftop in fixed slabs rather than per kW, so
// those are three discrete amounts an exec picks from. Housing societies are
// paid per kW for common-area capacity instead. Commercial gets nothing.

export type CustomerType = 'residential' | 'commercial' | 'housing_society'

export const CUSTOMER_TYPES: { value: CustomerType; label: string; note: string }[] = [
  { value: 'residential', label: 'Residential', note: 'PM Surya Ghar subsidy applies' },
  { value: 'housing_society', label: 'Housing Society', note: '₹18,000 per kW subsidy' },
  { value: 'commercial', label: 'Commercial', note: 'No government subsidy' },
]

/** The three PM Surya Ghar residential slabs, as shown in the picker. */
export const RESIDENTIAL_SUBSIDY_SLABS: { amount: number; label: string }[] = [
  { amount: 30_000, label: '1 kW — ₹30,000' },
  { amount: 60_000, label: '2 kW — ₹60,000' },
  { amount: 78_000, label: '3 kW & above — ₹78,000' },
]

export const HOUSING_SOCIETY_RATE_PER_KW = 18_000

export function hasGovernmentSubsidy(customerType: CustomerType): boolean {
  return customerType !== 'commercial'
}

/**
 * Subsidy to pre-fill for a customer type and system size. Residential snaps to
 * whichever slab the size falls in; a housing society is a straight per-kW rate.
 * The exec can still override the residential value — the slab a customer
 * actually qualifies for can depend on sanctioned load, not just what we quote.
 */
export function suggestedSubsidy(customerType: CustomerType, kw: number): number {
  if (!hasGovernmentSubsidy(customerType)) return 0
  if (!kw || kw <= 0) return 0

  if (customerType === 'housing_society') {
    return Math.round(kw * HOUSING_SOCIETY_RATE_PER_KW)
  }

  if (kw < 2) return 30_000
  if (kw < 3) return 60_000
  return 78_000
}

/**
 * What the customer still owes after installation and before licensing:
 * total cost, less the advance already paid, less the subsidy they're
 * entitled to (subsidy is credited against the balance up front rather than
 * waited on — see cash_subsidy_after_dispersal for the separate figure that
 * tracks what reaches the customer's own account after disbursal).
 */
export function remainingAfterAdvance(totalCost: number, advance: number, subsidy = 0): number {
  const total = Number(totalCost) || 0
  const paid = Number(advance) || 0
  const sub = Number(subsidy) || 0
  return Math.max(0, Math.round(total - paid - sub))
}
