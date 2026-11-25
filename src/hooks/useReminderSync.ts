// src/hooks/useReminderSync.ts
// Keeps the phone's scheduled reminders in step with the exec's workload:
// a 9am summary on each coming morning and a notification when each follow-up
// reminder falls due. Re-planned whenever the data changes or the app comes
// back to the foreground (a new day, a visit just logged). Tapping one opens To-Do.
import { useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { useExecWorkload } from '@/hooks/useExecWorkload'
import { buildReminderPlan } from '@/lib/reminderPlan'
import { configureNotifications, ensureNotificationPermission, replaceScheduledReminders } from '@/lib/notifications'

configureNotifications()

export function useReminderSync(enabled: boolean, userId: string | undefined) {
  const router = useRouter()
  const { activeLeads, infoMap, followUps, loading } = useExecWorkload(enabled, userId)
  // Bumped when the app returns to the foreground so the plan is rebuilt for
  // the new day even if no data changed.
  const [foregroundTick, setForegroundTick] = useState(0)
  const lastSignature = useRef('')

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundTick((n) => n + 1)
    })
    return () => sub.remove()
  }, [])

  useEffect(() => {
    if (!enabled || loading) return
    const plan = buildReminderPlan({ leads: activeLeads, infoMap, followUps })
    const signature = JSON.stringify(plan.map((n) => [n.id, n.at.getTime(), n.body]))
    if (signature === lastSignature.current) return
    lastSignature.current = signature
    let cancelled = false
    ensureNotificationPermission().then((granted) => {
      if (granted && !cancelled) return replaceScheduledReminders(plan)
    })
    return () => { cancelled = true }
  }, [enabled, loading, activeLeads, infoMap, followUps, foregroundTick])

  // Tapping a reminder (including the one that launched the app) opens To-Do.
  const response = Notifications.useLastNotificationResponse()
  const handled = useRef<string | null>(null)
  useEffect(() => {
    if (!enabled || !response) return
    const key = `${response.notification.request.identifier}:${response.notification.date}`
    if (handled.current === key) return
    handled.current = key
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return
    const screen = response.notification.request.content.data?.screen
    if (typeof screen === 'string') router.push(screen as never)
  }, [enabled, response, router])
}
