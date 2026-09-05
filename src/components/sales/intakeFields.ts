// src/components/sales/intakeFields.ts
// Option labels and checkbox groups for a client intake form — mirrors the
// web CRM's src/components/sales/intakeFields.ts so the two don't drift.
import type { ClientIntakeForm } from '@/types/sales'

export const ROOF_TYPE_LABEL: Record<string, string> = { rcc: 'RCC', roofing_metal_sheets: 'Roofing Metal Sheets' }
export const PANEL_COMPANY_LABEL: Record<string, string> = { adani: 'Adani', waaree: 'Waaree', other: 'Other' }
export const INVERTER_LABEL: Record<string, string> = { vsole: 'Vsole', waaree: 'Waaree', solaredge: 'SolarEdge', other: 'Other' }
export const STRUCTURE_LABEL: Record<string, string> = { monorail: 'Monorail', gi: 'GI', hdg: 'HDG' }
export const CUSTOMER_TYPE_LABEL: Record<string, string> = {
  residential: 'Residential', commercial: 'Commercial', housing_society: 'Housing Society',
}
export const ADVANCE_MODE_LABEL: Record<string, string> = {
  cash: 'Cash', online: 'Online (Prompt Solar account)', cheque: 'Cheque', none: 'None (Not Taken Advance)',
}

/** Boolean document checkboxes, in the order the paper form collects them. */
export const DOC_FIELDS: { key: keyof ClientIntakeForm; label: string }[] = [
  { key: 'doc_aadhaar', label: 'Aadhaar' },
  { key: 'doc_pan', label: 'PAN' },
  { key: 'doc_bank_passbook', label: 'Bank Passbook' },
  { key: 'doc_email', label: 'Email' },
  { key: 'doc_house_8a', label: 'House 8A' },
  { key: 'doc_light_bill', label: 'Light Bill' },
  { key: 'doc_cancelled_cheque', label: 'Cancelled Cheque' },
  { key: 'cibil_checked', label: 'CIBIL Checked' },
]

export const SCOPE_FIELDS: { key: keyof ClientIntakeForm; label: string }[] = [
  { key: 'scope_stamp_paper', label: 'Stamp Paper' },
  { key: 'scope_concrete_block', label: 'Concrete Block' },
  { key: 'scope_earthing', label: 'Earthing' },
]

export const NAME_CHANGE_DOC_FIELDS: { key: keyof ClientIntakeForm; label: string }[] = [
  { key: 'namechange_doc_aadhaar', label: 'Aadhaar Card' },
  { key: 'namechange_doc_house_8a', label: 'House 8A (Gharpatrak)' },
]
