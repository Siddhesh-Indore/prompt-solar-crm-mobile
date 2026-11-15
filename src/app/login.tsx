import { useState } from 'react'
import { Redirect, router } from 'expo-router'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ScrollView,
  ActivityIndicator, KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native'
import { useAuth } from '@/context/AuthContext'
import { brand } from '@/constants/brand'

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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Image
            source={require('@/assets/images/prompt-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Prompt Solar CRM</Text>
          <Text style={styles.subtitle}>Solar EPC Sales Platform</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>

            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              placeholder="you@promptsolar.com"
              placeholderTextColor={brand.faint}
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
              placeholderTextColor={brand.faint}
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

            <TouchableOpacity style={styles.forgotLink} onPress={() => router.push('/forgot-password')}>
              <Text style={styles.forgotLinkText}>Forgot password?</Text>
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
  logo: {
    width: 220, height: 45,
    alignSelf: 'center', marginBottom: 20,
  },
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
  forgotLink: { marginTop: 16, alignItems: 'center' },
  forgotLinkText: { color: brand.greenDark, fontSize: 13, fontWeight: '600' },
})
