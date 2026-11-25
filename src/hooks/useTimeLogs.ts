// src/hooks/useTimeLogs.ts
// Punch in / punch out attendance for sales execs (migration 071, selfies added
// in 087) — one row per exec per IST calendar day, matching the DB's
// unique(user_id, log_date). Every punch carries a selfie path.
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { sendAttendanceEvent } from '@/lib/attendanceApi'
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

export type PunchKind = 'in' | 'out'

const sending = new Set<string>()

/** Posts one punch to the company attendance system and, once it is accepted,
 * records that on the time log. Quiet on failure (returns false): the punch
 * itself is already saved, and useAttendanceRetry sends it later. Safe to call
 * twice for the same punch — a send already in flight is skipped. */
export async function deliverPunch(log: TimeLog, kind: PunchKind, person: { employeeNo: string | null | undefined; name: string }): Promise<boolean> {
  const at = kind === 'in' ? log.clock_in_at : log.clock_out_at
  const key = `${log.id}:${kind}`
  if (!person.employeeNo || !at || sending.has(key)) return false
  sending.add(key)
  try {
    const ok = await sendAttendanceEvent({ at, employeeNo: person.employeeNo, name: person.name })
    if (!ok) return false
    const { error } = await supabase.rpc('mark_time_log_sent', { p_log_id: log.id, p_kind: kind })
    return !error
  } finally {
    sending.delete(key)
  }
}

export function useClockIn() {
  const queryClient = useQueryClient()
  const { user, profile } = useAuth()

  return useMutation({
    mutationFn: async (selfiePath: string): Promise<TimeLog> => {
      if (!user?.id) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('time_logs')
        .insert({ user_id: user.id, log_date: todayInIST(), clock_in_at: new Date().toISOString(), clock_in_selfie_path: selfiePath })
        .select()
        .single()
      if (error) throw error
      const log = data as unknown as TimeLog
      // Not awaited: the punch is saved, and a slow or unreachable attendance
      // system must not hold up (or fail) the button.
      void deliverPunch(log, 'in', { employeeNo: profile?.employee_no, name: profile?.full_name ?? '' }).then(() => queryClient.invalidateQueries({ queryKey: ['time-log'] }))
      return log
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-log', 'today'] })
    },
  })
}

export function useClockOut() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  return useMutation({
    mutationFn: async ({ id, selfiePath }: { id: string; selfiePath: string }): Promise<TimeLog> => {
      const { data, error } = await supabase
        .from('time_logs')
        .update({ clock_out_at: new Date().toISOString(), clock_out_selfie_path: selfiePath })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      const log = data as unknown as TimeLog
      void deliverPunch(log, 'out', { employeeNo: profile?.employee_no, name: profile?.full_name ?? '' }).then(() => queryClient.invalidateQueries({ queryKey: ['time-log'] }))
      return log
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-log', 'today'] })
    },
  })
}

/** Sends any punch from today or yesterday that did not reach the attendance
 * system (no signal at the time). Runs when the app opens or comes back to the
 * foreground. Does nothing until the exec has an employee number. */
export function useAttendanceRetry(enabled: boolean) {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  const employeeNo = profile?.employee_no
  const name = profile?.full_name ?? ''
  const userId = user?.id

  useEffect(() => {
    if (!enabled || !userId || !employeeNo) return
    let cancelled = false

    async function retry() {
      const since = new Date(Date.now() - 36 * 60 * 60 * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      const { data, error } = await supabase.from('time_logs').select('*').eq('user_id', userId!).gte('log_date', since)
      if (error || cancelled) return
      let changed = false
      for (const log of (data ?? []) as unknown as TimeLog[]) {
        if (!log.clock_in_sent_at && (await deliverPunch(log, 'in', { employeeNo, name }))) changed = true
        if (log.clock_out_at && !log.clock_out_sent_at && (await deliverPunch(log, 'out', { employeeNo, name }))) changed = true
      }
      if (changed && !cancelled) queryClient.invalidateQueries({ queryKey: ['time-log'] })
    }

    retry()
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') retry() })
    return () => { cancelled = true; sub.remove() }
  }, [enabled, userId, employeeNo, name, queryClient])
}
