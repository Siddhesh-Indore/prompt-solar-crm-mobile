// src/types/sales.ts
// Mirrors the web CRM's src/types/sales.ts — same Supabase schema, same shapes.
import type { Profile } from '@/context/AuthContext'

export type LeadStage =
  | 'new'
  | 'calling'
  | 'visit_fixed'
  | 'visited'
  | 'converted'
  | 'not_qualified'
  | 'lost'

export type LeadTemperature = 'hot' | 'warm' | 'cold'

export type LeadSource =
  | 'meta'
  | 'google'
  | 'website'
  | 'cold_call'
  | 'owner_ref'
  | 'employee_ref'
  | 'manual'

export const LEAD_SOURCES: { value: LeadSource; label: string }[] = [
  { value: 'meta', label: 'Meta Ads' },
  { value: 'google', label: 'Google Ads' },
  { value: 'website', label: 'Website' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'owner_ref', label: 'Owner Ref' },
  { value: 'employee_ref', label: 'Employee Ref' },
  { value: 'manual', label: 'Manual' },
]

export interface Lead {
  id: string
  name: string
  phone: string
  phone_normalized: string
  address: string | null
  approx_bill_amount: number | null
  quote_range_min: number | null
  quote_range_max: number | null
  roof_type: 'rcc' | 'metal_terrace' | null
  ownership: 'owned' | 'rented' | null
  property_type: 'residential' | 'commercial' | null
  competitor_contacted: boolean
  competitor_name: string | null
  stage: LeadStage
  temperature: LeadTemperature | null
  source: LeadSource
  source_ref_id: string | null
  assigned_caller_id: string | null
  assigned_exec_id: string | null
  visit_date: string | null
  visit_time: string | null
  notes: string | null
  locked_by: string | null
  locked_at: string | null
  lock_expires_at: string | null
  created_at: string
  updated_at: string
  assigned_caller?: Profile
  assigned_exec?: Profile
  locked_by_profile?: Profile
}

export interface CallLog {
  id: string
  lead_id: string
  caller_id: string | null
  call_type: 'qualification' | 'pre_visit' | 'follow_up' | 'callback'
  called_at: string
  duration_seconds: number | null
  outcome: 'answered' | 'no_answer' | 'busy' | 'callback_requested' | 'confirmed' | 'rescheduled' | null
  recording_url: string | null
  notes: string | null
  created_at: string
}

export interface VisitReport {
  id: string
  lead_id: string
  exec_id: string | null
  visit_number: number
  visited_at: string
  kw_interest: number | null
  quote_discussed: number | null
  outcome: 'finalized' | 'second_visit' | 'follow_up' | 'lost'
  next_step: string | null
  notes: string | null
  created_at: string
  // Mandatory for every visit — see migration 027
  latitude: number | null
  longitude: number | null
  location_accuracy: number | null
  photo_url: string | null
}

export interface FollowUp {
  id: string
  lead_id: string
  assigned_to: string | null
  due_at: string
  reason: string | null
  outcome_note: string | null
  status: 'pending' | 'completed' | 'rescheduled' | 'dismissed'
  notified_at: string | null
  completed_at: string | null
  created_at: string
}

export interface ClientIntakeForm {
  id: string
  lead_id: string
  exec_id: string | null
  signed_at: string
  full_name: string
  address: string
  phone: string
  email: string | null
  age: number | null
  kw: number
  roof_type: 'rcc' | 'roofing_metal_sheets' | null
  panel_company: 'adani' | 'waaree' | 'other' | null
  panel_company_other: string | null
  panel_size: string | null
  inverter: 'vsole' | 'waaree' | 'solaredge' | 'other' | null
  inverter_other: string | null
  structure: 'monorail' | 'gi' | 'hdg' | null
  structure_height: string | null
  payment_method: 'cash' | 'loan'
  total_cost: number
  cash_advance: number | null
  cash_remaining_after_install: number | null
  cash_subsidy_after_dispersal: number | null
  loan_bank_name: string | null
  loan_advance: number | null
  loan_after_dispersal: number | null
  loan_subsidy_consumer: number | null
  doc_aadhaar: boolean
  doc_pan: boolean
  doc_bank_passbook: boolean
  doc_email: boolean
  doc_house_8a: boolean
  doc_light_bill: boolean
  doc_cancelled_cheque: boolean
  cibil_checked: boolean
  scope_stamp_paper: boolean
  scope_concrete_block: boolean
  scope_earthing: boolean
  client_signature_url: string | null
  salesman_signature_url: string | null
  created_at: string
  updated_at: string
}

export interface LeadFilters {
  source?: LeadSource
  stage?: LeadStage
  temperature?: LeadTemperature
  search?: string
}
