// src/lib/supabase.ts
// Same Supabase project as the web CRM (prompt-solar-crm) — same Auth, same
// RLS policies, same tables. AsyncStorage persists the session across app
// restarts; the URL polyfill is required because React Native's JS engine
// doesn't implement the URL API that supabase-js depends on.
import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — check .env')
}

// Expo Router's web build server-renders each route on first load, where
// `window`/AsyncStorage's browser backing don't exist — guard against that
// pass. Never hit on iOS/Android (no SSR step there), only web dev/build.
const isServer = typeof window === 'undefined'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isServer ? undefined : AsyncStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
})
