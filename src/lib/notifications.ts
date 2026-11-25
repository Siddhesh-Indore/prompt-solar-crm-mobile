// src/lib/notifications.ts
// Thin wrapper over expo-notifications for the exec's reminders. Everything is
// scheduled on the phone itself (no push server): the app rebuilds the plan
// whenever it is open (see useReminderSync) and the phone fires them when due.
// Fire-and-forget safe — a device that can't schedule just gets no reminders.
import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import type { PlannedNotification } from '@/lib/reminderPlan'

const CHANNEL_ID = 'reminders'

const supported = Platform.OS === 'android' || Platform.OS === 'ios'

/** Show reminders as a banner even while the app is open. */
export function configureNotifications(): void {
  if (!supported) return
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  })
}

/** True when reminders may be shown. Asks once; if the user said no, stays quiet. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!supported) return false
  try {
    if (Platform.OS === 'android') {
      // The channel must exist before the Android 13+ permission prompt appears.
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Visits & follow-ups',
        importance: Notifications.AndroidImportance.HIGH,
      })
    }
    const current = await Notifications.getPermissionsAsync()
    if (current.granted) return true
    if (!current.canAskAgain) return false
    return (await Notifications.requestPermissionsAsync()).granted
  } catch {
    return false
  }
}

/** Replaces every scheduled reminder with `plan`. */
export async function replaceScheduledReminders(plan: PlannedNotification[]): Promise<void> {
  if (!supported) return
  try {
    await Notifications.cancelAllScheduledNotificationsAsync()
    for (const n of plan) {
      await Notifications.scheduleNotificationAsync({
        identifier: n.id,
        content: { title: n.title, body: n.body, data: { screen: n.screen } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at, channelId: CHANNEL_ID },
      })
    }
  } catch {
    // Reminders are a convenience — never break the app over them.
  }
}

/** Drops every scheduled reminder — on sign-out, so the next person on this
 * phone doesn't get the last one's reminders. */
export async function clearScheduledReminders(): Promise<void> {
  if (!supported) return
  try {
    await Notifications.cancelAllScheduledNotificationsAsync()
  } catch {
    // ignore
  }
}
