// src/app/forgot-password.tsx
// Two-step OTP recovery, mirroring the web CRM's ForgotPasswordPage: email
// in, Supabase Auth mails a 6-digit code (the "Reset Password" template
// must show {{ .Token }} — see Supabase Dashboard > Auth > Email Templates),
// code in, verifyOtp() signs the user into a recovery session, then
// reset-password.tsx sets the new password.
import { useState } from 'react'
import { router } from 'expo-router'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function sendCode() {
    setError(null)
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Enter your email address')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed)
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    setStep('code')
  }

  async function verifyCode() {
    setError(null)
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code from your email')
      return
    }
    setSubmitting(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'recovery',
    })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      return
    }
    router.replace('/reset-password')
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
            {step === 'email' ? (
              <>
                <Text style={styles.cardTitle}>Reset your password</Text>
                <Text style={styles.helperText}>
                  Enter your email and we'll send you a 6-digit code.
                </Text>

                <Text style={styles.label}>Email address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@promptsolar.com"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />

                {error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.button, submitting && styles.buttonDisabled]}
                  onPress={sendCode}
                  disabled={submitting}
                >
                  {submitting ? <ActivityIndicator color="#052e16" /> : <Text style={styles.buttonText}>Send code</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>Enter your code</Text>
                <Text style={styles.helperText}>
                  We sent a 6-digit code to {email.trim()}. It expires shortly.
                </Text>

                <Text style={styles.label}>6-digit code</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  placeholder="000000"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                />

                {error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.button, submitting && styles.buttonDisabled]}
                  onPress={verifyCode}
                  disabled={submitting}
                >
                  {submitting ? <ActivityIndicator color="#052e16" /> : <Text style={styles.buttonText}>Verify code</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.linkButton} onPress={sendCode} disabled={submitting}>
                  <Text style={styles.linkText}>Resend code</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.linkButton} onPress={() => { setStep('email'); setError(null) }}>
                  <Text style={styles.linkText}>Use a different email</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={styles.backLinkText}>← Back to sign in</Text>
          </TouchableOpacity>
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
  cardTitle: { color: '#111827', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  helperText: { color: '#6b7280', fontSize: 13, marginBottom: 20, lineHeight: 18 },
  label: { color: '#374151', fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, color: '#111827', fontSize: 14, marginBottom: 16,
  },
  codeInput: { fontSize: 20, letterSpacing: 8, textAlign: 'center', fontWeight: '600' },
  errorBox: { backgroundColor: '#fee2e2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 16 },
  errorText: { color: '#b91c1c', fontSize: 13 },
  button: { backgroundColor: '#4ade80', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#052e16', fontSize: 15, fontWeight: '700' },
  linkButton: { marginTop: 14, alignItems: 'center' },
  linkText: { color: '#047857', fontSize: 13, fontWeight: '600' },
  backLink: { marginTop: 24, alignItems: 'center' },
  backLinkText: { color: '#047857', fontSize: 13, fontWeight: '600' },
})
