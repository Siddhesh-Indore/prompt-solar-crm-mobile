// src/app/reset-password.tsx
// Reached after forgot-password.tsx's verifyOtp() call succeeds, which
// leaves a valid (recovery) session active — same mechanism the web CRM's
// ResetPasswordPage relies on, just via a typed code instead of a link.
import { useState } from 'react'
import { router } from 'expo-router'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit() {
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match")
      return
    }
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    router.replace('/')
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Image
            source={require('@/assets/images/prompt-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Prompt Solar CRM</Text>
          <Text style={styles.subtitle}>Solar EPC Sales Platform</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Set a new password</Text>

            <Text style={styles.label}>New password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <Text style={styles.label}>Confirm new password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#9ca3af"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />

            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, submitting && styles.buttonDisabled]}
              onPress={onSubmit}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="#052e16" /> : <Text style={styles.buttonText}>Update password</Text>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 24 },
  logo: { width: 220, height: 45, alignSelf: 'center', marginBottom: 20 },
  title: { color: '#111827', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#6b7280', fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 32 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#e5e7eb' },
  cardTitle: { color: '#111827', fontSize: 16, fontWeight: '600', marginBottom: 20 },
  label: { color: '#374151', fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, color: '#111827', fontSize: 14, marginBottom: 16,
  },
  errorBox: { backgroundColor: '#fee2e2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 16 },
  errorText: { color: '#b91c1c', fontSize: 13 },
  button: { backgroundColor: '#4ade80', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#052e16', fontSize: 15, fontWeight: '700' },
})
