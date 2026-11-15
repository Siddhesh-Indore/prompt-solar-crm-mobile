// src/lib/haptics.ts
// Thin wrapper over expo-haptics so call sites stay one-liners and a device
// (or web build) without a haptic engine never throws. Fire-and-forget.
import { Platform } from 'react-native'
import * as Haptics from 'expo-haptics'

const supported = Platform.OS === 'ios' || Platform.OS === 'android'

function run(fn: () => Promise<void>) {
  if (!supported) return
  fn().catch(() => {})
}

/** A tap on a tab / chip / toggle. */
export const hapticSelect = () => run(() => Haptics.selectionAsync())

/** Something worked: punched in/out, visit saved, lead created, advance recorded. */
export const hapticSuccess = () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))

/** Something needs attention: a failed save, a blocked action. */
export const hapticWarning = () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning))
