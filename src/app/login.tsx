import { useState } from 'react'
import { Redirect } from 'expo-router'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native'
import { useAuth } from '@/context/AuthContext'

export default function LoginScreen() {
  const { session, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && session) return <Redirect href="/" />

  async function onSubmit() {
    setError(null)
    setSubmitting(true)
    const { error } = await signIn(email.trim(), password)
    setSubmitting(false)
    if (error) setError(error)
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}
      >
        <View style={styles.logo}>
          <Text style={styles.logoEmoji}>☀️</Text>
        </View>
        <Text style={styles.title}>Prompt-Solar CRM</Text>
        <Text style={styles.subtitle}>Solar EPC Sales Platform</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome back</Text>

          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            placeholder="you@promptsolar.com"
            placeholderTextColor="#6b7280"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#6b7280"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
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
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign in</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#111827' },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  logo: {
    width: 64, height: 64, borderRadius: 16, backgroundColor: '#4ade80',
    alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  logoEmoji: { fontSize: 28 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: '#9ca3af', fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 32 },
  card: { backgroundColor: '#1f2937', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#374151' },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 20 },
  label: { color: '#d1d5db', fontSize: 13, fontWeight: '500', marginBottom: 6 },
  input: {
    backgroundColor: '#111827', borderWidth: 1, borderColor: '#4b5563', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 14, marginBottom: 16,
  },
  errorBox: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 16 },
  errorText: { color: '#f87171', fontSize: 13 },
  button: { backgroundColor: '#4ade80', borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#052e16', fontSize: 15, fontWeight: '700' },
})
