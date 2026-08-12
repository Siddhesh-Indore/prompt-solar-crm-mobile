// src/hooks/useReminders.ts
// In-app reminders (visit/callback) for the Home screen's Reminders card —
// no push notification here, mirrors the web CRM's notification bell but
// only surfaces while the exec has the app open (see useScreenCaptureGuard
// for the other "no native rebuild yet" tradeoff already made this way).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Reminder } from '@/types/sales'

export interface ReminderWithLead extends Reminder {
  lead: { id: string; name: string } | null
}

export function useReminders() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['reminders', user?.id],
    queryFn: async (): Promise<ReminderWithLead[]> => {
      if (!user) return []
      const { data, error } = await supabase
        .from('reminders')
        .select('*, lead:lead_id(id, name)')
        .eq('assigned_to', user.id)
        .eq('is_dismissed', false)
        .order('due_at', { ascending: true })
        .limit(50)
      if (error) throw error
      return (data ?? []) as unknown as ReminderWithLead[]
    },
    enabled: !!user,
  })
}

export function useDismissReminder() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (reminderId: string) => {
      const { error } = await supabase.from('reminders').update({ is_dismissed: true }).eq('id', reminderId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
    },
  })
}
