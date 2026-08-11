// src/hooks/useScreenCaptureGuard.ts
// Blocks screenshots/screen recording for telecallers and sales execs —
// every screen in this app shows lead phone numbers, addresses, and quote
// figures, so this is applied once at the root layout rather than per-screen.
// Admin/manager are exempt: they use the same app and need to be able to
// screenshot for their own reporting/support use.
//
// preventScreenCaptureAsync blocks both platforms outright (Android via
// FLAG_SECURE; iOS 13+ blocks screenshots too, iOS 11+ blocks recordings).
// The screenshot listener below is a fallback for iOS versions older than 13
// where the block doesn't apply — logged to security_events (migration 070)
// so admin can see who screenshotted what, since Apple gives no way to stop
// it there. Not wired up on Android: FLAG_SECURE already blocks capture
// outright, so there's nothing to detect, and the Android listener needs an
// extra media-library permission this app has no other reason to request.
import { useEffect } from 'react'
import { Platform } from 'react-native'
import { usePathname } from 'expo-router'
import * as ScreenCapture from 'expo-screen-capture'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

const RESTRICTED_ROLES = ['telecaller', 'sales_exec']

export function useScreenCaptureGuard() {
  const { user, profile } = useAuth()
  const pathname = usePathname()
  const restricted = !!profile && RESTRICTED_ROLES.includes(profile.role)

  useEffect(() => {
    // No native screen-capture API on web — expo-web's own devtools/inspector
    // already make client-side content trivially visible regardless.
    if (!restricted || Platform.OS === 'web') return
    ScreenCapture.preventScreenCaptureAsync('lead-data-guard')
    return () => {
      ScreenCapture.allowScreenCaptureAsync('lead-data-guard')
    }
  }, [restricted])

  useEffect(() => {
    if (!restricted || Platform.OS !== 'ios') return
    const subscription = ScreenCapture.addScreenshotListener(() => {
      supabase.from('security_events').insert({
        user_id: user?.id ?? null,
        event_type: 'screenshot_detected',
        screen: pathname,
      }).then(() => {}, () => {})
    })
    return () => subscription.remove()
  }, [restricted, user?.id, pathname])
}
