// src/app/emi-calculator.tsx
// Solar loan EMI calculator — lets a telecaller/sales exec work out monthly
// payments on the spot while talking to a prospect about financing, instead
// of promising to "check and call back." Supports both methods lenders
// actually quote: reducing balance (interest recalculated on the shrinking
// principal each month — what banks mean by "EMI") and flat rate (interest
// charged on the full original principal for the whole tenure — common with
// NBFC/dealer financing, and always more expensive for the same quoted
// rate). Plus a year-by-year amortization breakdown for either method.
import { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'

const TENURE_PRESETS = [1, 2, 3, 5, 7, 10]
type InterestMethod = 'reducing' | 'flat'

function formatINR(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`
}

interface YearRow {
  year: number
  openingBalance: number
  principalPaid: number
  interestPaid: number
  closingBalance: number
}

function computeReducing(principal: number, annualRatePct: number, months: number) {
  const monthlyRate = annualRatePct / 12 / 100

  const emi = monthlyRate === 0
    ? principal / months
    : (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1)

  // Walk the schedule month by month, rolling up into yearly rows —
  // simplest way to get an exact reducing-balance breakdown without a
  // closed-form yearly formula.
  const yearRows: YearRow[] = []
  let balance = principal
  for (let y = 0; y < Math.ceil(months / 12); y++) {
    const openingBalance = balance
    let principalPaid = 0
    let interestPaid = 0
    for (let m = 0; m < 12 && (y * 12 + m) < months; m++) {
      const interest = balance * monthlyRate
      const principalComponent = emi - interest
      balance = Math.max(0, balance - principalComponent)
      interestPaid += interest
      principalPaid += principalComponent
    }
    yearRows.push({ year: y + 1, openingBalance, principalPaid, interestPaid, closingBalance: balance })
    if (balance <= 0) break
  }

  return { emi, yearRows }
}

function computeFlat(principal: number, annualRatePct: number, tenureYears: number, months: number) {
  // Interest is charged on the original principal for the full tenure,
  // regardless of how much has already been repaid — so both the interest
  // and principal components are the same every single month.
  const totalInterest = principal * (annualRatePct / 100) * tenureYears
  const emi = (principal + totalInterest) / months
  const monthlyPrincipal = principal / months
  const monthlyInterest = totalInterest / months

  const yearRows: YearRow[] = []
  let balance = principal
  for (let y = 0; y < Math.ceil(months / 12); y++) {
    const openingBalance = balance
    const monthsThisYear = Math.min(12, months - y * 12)
    const principalPaid = monthlyPrincipal * monthsThisYear
    const interestPaid = monthlyInterest * monthsThisYear
    balance = Math.max(0, balance - principalPaid)
    yearRows.push({ year: y + 1, openingBalance, principalPaid, interestPaid, closingBalance: balance })
    if (balance <= 0) break
  }

  return { emi, yearRows }
}

function computeEmi(principal: number, annualRatePct: number, tenureYears: number, method: InterestMethod) {
  const months = Math.round(tenureYears * 12)
  const { emi, yearRows } = method === 'flat'
    ? computeFlat(principal, annualRatePct, tenureYears, months)
    : computeReducing(principal, annualRatePct, months)

  const totalPayment = emi * months
  const totalInterest = totalPayment - principal

  return { emi, totalPayment, totalInterest, yearRows }
}

export default function EmiCalculatorScreen() {
  const router = useRouter()
  const [amountStr, setAmountStr] = useState('300000')
  const [rateStr, setRateStr] = useState('10.5')
  const [tenureYears, setTenureYears] = useState(5)
  const [method, setMethod] = useState<InterestMethod>('reducing')
  const [showSchedule, setShowSchedule] = useState(false)

  const amount = Number(amountStr) || 0
  const rate = Number(rateStr) || 0

  const result = useMemo(() => {
    if (amount <= 0 || tenureYears <= 0) return null
    return computeEmi(amount, rate, tenureYears, method)
  }, [amount, rate, tenureYears, method])

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backLink}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>EMI Calculator</Text>
        <Text style={styles.subtitle}>Work out monthly payments for a solar loan on the spot</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Loan Amount (₹)</Text>
          <TextInput
            style={styles.input}
            value={amountStr}
            onChangeText={setAmountStr}
            keyboardType="numeric"
            placeholder="e.g. 300000"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Interest Rate (% per year)</Text>
          <TextInput
            style={styles.input}
            value={rateStr}
            onChangeText={setRateStr}
            keyboardType="decimal-pad"
            placeholder="e.g. 10.5"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Interest Type</Text>
          <View style={styles.methodRow}>
            <TouchableOpacity
              onPress={() => setMethod('reducing')}
              style={[styles.methodChip, method === 'reducing' && styles.methodChipActive]}
            >
              <Text style={[styles.methodChipText, method === 'reducing' && styles.methodChipTextActive]}>Reducing Balance</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setMethod('flat')}
              style={[styles.methodChip, method === 'flat' && styles.methodChipActive]}
            >
              <Text style={[styles.methodChipText, method === 'flat' && styles.methodChipTextActive]}>Flat Rate</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.methodHint}>
            {method === 'reducing'
              ? 'Interest recalculated on the shrinking balance each month — what banks usually mean by EMI.'
              : 'Interest charged on the full loan amount for the whole tenure — common with dealer/NBFC financing. Costs more for the same quoted rate.'}
          </Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Tenure (years)</Text>
          <View style={styles.tenureRow}>
            {TENURE_PRESETS.map((y) => (
              <TouchableOpacity
                key={y}
                onPress={() => setTenureYears(y)}
                style={[styles.tenureChip, tenureYears === y && styles.tenureChipActive]}
              >
                <Text style={[styles.tenureChipText, tenureYears === y && styles.tenureChipTextActive]}>{y}y</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {result && (
          <>
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Monthly EMI</Text>
              <Text style={styles.resultEmi}>{formatINR(result.emi)}</Text>
              <View style={styles.resultRow}>
                <View style={styles.resultCol}>
                  <Text style={styles.resultSubLabel}>Total Interest</Text>
                  <Text style={styles.resultSubValue}>{formatINR(result.totalInterest)}</Text>
                </View>
                <View style={styles.resultCol}>
                  <Text style={styles.resultSubLabel}>Total Payment</Text>
                  <Text style={styles.resultSubValue}>{formatINR(result.totalPayment)}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.scheduleToggle} onPress={() => setShowSchedule((s) => !s)}>
              <Text style={styles.scheduleToggleText}>{showSchedule ? 'Hide' : 'Show'} year-by-year breakdown</Text>
            </TouchableOpacity>

            {showSchedule && (
              <View style={styles.scheduleTable}>
                <View style={[styles.scheduleRow, styles.scheduleHeaderRow]}>
                  <Text style={[styles.scheduleCell, styles.scheduleHeaderText, { flex: 0.6 }]}>Year</Text>
                  <Text style={[styles.scheduleCell, styles.scheduleHeaderText]}>Principal</Text>
                  <Text style={[styles.scheduleCell, styles.scheduleHeaderText]}>Interest</Text>
                  <Text style={[styles.scheduleCell, styles.scheduleHeaderText]}>Balance</Text>
                </View>
                {result.yearRows.map((row) => (
                  <View key={row.year} style={styles.scheduleRow}>
                    <Text style={[styles.scheduleCell, { flex: 0.6 }]}>{row.year}</Text>
                    <Text style={styles.scheduleCell}>{formatINR(row.principalPaid)}</Text>
                    <Text style={styles.scheduleCell}>{formatINR(row.interestPaid)}</Text>
                    <Text style={styles.scheduleCell}>{formatINR(row.closingBalance)}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20, paddingBottom: 40 },
  backLink: { fontSize: 14, color: '#047857', fontWeight: '600', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2, marginBottom: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#111827', backgroundColor: '#fff' },
  methodRow: { flexDirection: 'row', gap: 8 },
  methodChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff', alignItems: 'center' },
  methodChipActive: { backgroundColor: '#4ade80', borderColor: '#4ade80' },
  methodChipText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  methodChipTextActive: { color: '#052e16', fontWeight: '700' },
  methodHint: { fontSize: 11, color: '#9ca3af', marginTop: 6, lineHeight: 15 },
  tenureRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tenureChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  tenureChipActive: { backgroundColor: '#4ade80', borderColor: '#4ade80' },
  tenureChipText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  tenureChipTextActive: { color: '#052e16', fontWeight: '700' },
  resultCard: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 14, padding: 18, marginTop: 8, alignItems: 'center' },
  resultLabel: { fontSize: 13, color: '#047857', fontWeight: '600' },
  resultEmi: { fontSize: 32, color: '#052e16', fontWeight: '800', marginTop: 4 },
  resultRow: { flexDirection: 'row', gap: 24, marginTop: 16, width: '100%', justifyContent: 'center' },
  resultCol: { alignItems: 'center' },
  resultSubLabel: { fontSize: 11, color: '#6b7280' },
  resultSubValue: { fontSize: 15, color: '#111827', fontWeight: '700', marginTop: 2 },
  scheduleToggle: { marginTop: 16, alignItems: 'center', paddingVertical: 10 },
  scheduleToggleText: { fontSize: 13, color: '#047857', fontWeight: '600' },
  scheduleTable: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, overflow: 'hidden' },
  scheduleRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  scheduleHeaderRow: { backgroundColor: '#f9fafb' },
  scheduleCell: { flex: 1, fontSize: 12, color: '#374151' },
  scheduleHeaderText: { fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', fontSize: 10 },
})
