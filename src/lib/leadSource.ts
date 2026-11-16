// src/lib/leadSource.ts
// Sources where someone vouched for the lead — the only ones that need a
// record of who (leads.referred_by, migration 090). Mirrors the web CRM.
export const REFERENCE_SOURCES = ['employee_ref', 'customer_ref'] as const

export function isReferenceSource(source: string | null | undefined): boolean {
  return REFERENCE_SOURCES.includes(source as (typeof REFERENCE_SOURCES)[number])
}
