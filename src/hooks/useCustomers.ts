// src/hooks/useCustomers.ts
// Mirrors the web CRM's src/hooks/useCustomers.ts — telecaller-facing subset:
// view + add only (customers_update/delete stay admin-only, migration 083).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Customer, LeadSource } from '@/types/sales'

const CUSTOMER_COLUMNS = 'id, name, phone, address, source, notes, lead_id, created_by, created_at'
const PAGE_SIZE = 30

export interface CustomersPage {
  customers: Customer[]
  totalCount: number
}

export function useCustomersPage(search: string) {
  return useQuery({
    queryKey: ['customers', search],
    queryFn: async (): Promise<CustomersPage> => {
      let query = supabase
        .from('customers')
        .select(CUSTOMER_COLUMNS, { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)

      const term = search.trim()
      if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`)

      const { data, error, count } = await query
      if (error) throw error
      return { customers: (data ?? []) as unknown as Customer[], totalCount: count ?? 0 }
    },
  })
}

export interface NewCustomerInput {
  name: string
  phone: string
  address?: string
  source: LeadSource
  notes?: string
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (input: NewCustomerInput): Promise<Customer> => {
      const { data, error } = await supabase
        .from('customers')
        .insert({ ...input, created_by: user?.id ?? null })
        .select()
        .single()
      if (error) throw error
      return data as unknown as Customer
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    },
  })
}
