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
import { brand } from '@/constants/brand'

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
              placeholderTextColor={brand.faint}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />

            <Text style={styles.label}>Confirm new password</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={brand.faint}
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
              {submitting ? <ActivityIndicator color={brand.onGreen} /> : <Text style={styles.buttonText}>Update password</Text>}
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
  title: { color: brand.ink, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: brand.muted, fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 32 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: brand.borderLight },
  cardTitle: { color: brand.ink, fontSize: 16, fontWeight: '600', marginBottom: 20 },
  label: { color: brand.text, fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: brand.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, color: brand.ink, fontSize: 14, marginBottom: 16,
  },
  errorBox: { backgroundColor: brand.dangerSoft, borderColor: brand.dangerBorder, borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 16 },
  errorText: { color: brand.danger, fontSize: 13 },
  button: { backgroundColor: brand.green, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: brand.onGreen, fontSize: 15, fontWeight: '700' },
})
