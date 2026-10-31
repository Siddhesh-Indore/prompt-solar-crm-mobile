// src/hooks/useTimeLogs.ts
// Punch in / punch out attendance for sales execs (migration 071, selfies added
// in 087) — one row per exec per IST calendar day, matching the DB's
// unique(user_id, log_date). Every punch carries a selfie path.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { TimeLog } from '@/types/sales'

/** en-CA gives YYYY-MM-DD directly, no manual string surgery needed. */
export function todayInIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

export function useTodayTimeLog() {
  const { user } = useAuth()
  const logDate = todayInIST()

  return useQuery({
    queryKey: ['time-log', 'today', user?.id, logDate],
    queryFn: async (): Promise<TimeLog | null> => {
      if (!user?.id) return null
      const { data, error } = await supabase
        .from('time_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('log_date', logDate)
        .maybeSingle()
      if (error) throw error
      return data as unknown as TimeLog | null
    },
    enabled: !!user?.id,
  })
}

export function useClockIn() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: async (selfiePath: string): Promise<TimeLog> => {
      if (!user?.id) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('time_logs')
        .insert({ user_id: user.id, log_date: todayInIST(), clock_in_at: new Date().toISOString(), clock_in_selfie_path: selfiePath })
        .select()
        .single()
      if (error) throw error
      return data as unknown as TimeLog
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-log', 'today'] })
    },
  })
}

export function useClockOut() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, selfiePath }: { id: string; selfiePath: string }): Promise<TimeLog> => {
      const { data, error } = await supabase
        .from('time_logs')
        .update({ clock_out_at: new Date().toISOString(), clock_out_selfie_path: selfiePath })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as unknown as TimeLog
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-log', 'today'] })
    },
  })
}
