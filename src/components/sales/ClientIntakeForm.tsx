// src/components/sales/ClientIntakeForm.tsx
// Digital replica of the paper client intake form — mirrors the web CRM's
// ClientIntakeForm.tsx. Only reachable when the latest visit report's
// outcome is 'finalized' (enforced by the caller, visits.tsx). Submitting
// converts the lead (stage -> converted).
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, ActivityIndicator, Alert } from 'react-native'
import { useCreateClientIntakeForm } from '@/hooks/useClientIntake'
import ChipSelect from '@/components/sales/ChipSelect'
import DateTimeField from '@/components/sales/DateTimeField'
import type { Lead } from '@/types/sales'

const ROOF_OPTIONS = [{ value: 'rcc', label: 'RCC' }, { value: 'roofing_metal_sheets', label: 'Roofing Metal Sheets' }] as const
const PANEL_OPTIONS = [{ value: 'adani', label: 'Adani' }, { value: 'waaree', label: 'Waaree' }, { value: 'other', label: 'Other' }] as const
const INVERTER_OPTIONS = [{ value: 'vsole', label: 'VSole' }, { value: 'waaree', label: 'Waaree' }, { value: 'solaredge', label: 'SolarEdge' }, { value: 'other', label: 'Other' }] as const
const STRUCTURE_OPTIONS = [{ value: 'monorail', label: 'Monorail' }, { value: 'gi', label: 'GI' }, { value: 'hdg', label: 'HDG' }] as const
const PAYMENT_OPTIONS = [{ value: 'cash', label: 'Cash' }, { value: 'loan', label: 'Loan' }] as const

const DOC_FIELDS = [
  ['doc_aadhaar', 'Aadhaar'],
  ['doc_pan', 'PAN'],
  ['doc_bank_passbook', 'Bank Passbook'],
  ['doc_email', 'Email'],
  ['doc_house_8a', 'House 8A'],
  ['doc_light_bill', 'Light Bill'],
  ['doc_cancelled_cheque', 'Cancelled Cheque'],
  ['cibil_checked', 'CIBIL Checked'],
] as const

const SCOPE_FIELDS = [
  ['scope_stamp_paper', 'Stamp Paper'],
  ['scope_concrete_block', 'Concrete Block'],
  ['scope_earthing', 'Earthing'],
] as const

interface ClientIntakeFormProps {
  lead: Lead
  onDone: () => void
  onCancel?: () => void
}

export default function ClientIntakeForm({ lead, onDone, onCancel }: ClientIntakeFormProps) {
  const createIntake = useCreateClientIntakeForm()

  const [signedAt, setSignedAt] = useState(new Date().toISOString().slice(0, 10))
  const [fullName, setFullName] = useState(lead.name)
  const [address, setAddress] = useState(lead.address ?? '')
  const [phone, setPhone] = useState(lead.phone)
  const [email, setEmail] = useState('')
  const [age, setAge] = useState('')

  const [kw, setKw] = useState('')
  const [roofType, setRoofType] = useState<string | undefined>()
  const [panelCompany, setPanelCompany] = useState<string | undefined>()
  const [panelCompanyOther, setPanelCompanyOther] = useState('')
  const [panelSize, setPanelSize] = useState('')
  const [inverter, setInverter] = useState<string | undefined>()
  const [inverterOther, setInverterOther] = useState('')
  const [structure, setStructure] = useState<string | undefined>()
  const [structureHeight, setStructureHeight] = useState('')

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'loan'>('cash')
  const [totalCost, setTotalCost] = useState('')
  const [cashAdvance, setCashAdvance] = useState('')
  const [cashRemaining, setCashRemaining] = useState('')
  const [cashSubsidy, setCashSubsidy] = useState('')
  const [loanBankName, setLoanBankName] = useState('')
  const [loanAdvance, setLoanAdvance] = useState('')
  const [loanAfterDispersal, setLoanAfterDispersal] = useState('')
  const [loanSubsidyConsumer, setLoanSubsidyConsumer] = useState('')

  const [docs, setDocs] = useState<Record<string, boolean>>({})
  const [scope, setScope] = useState<Record<string, boolean>>({})

  const [clientSignatureUrl, setClientSignatureUrl] = useState('')
  const [salesmanSignatureUrl, setSalesmanSignatureUrl] = useState('')

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function toggle(setter: typeof setDocs, key: string) {
    setter((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  async function submit() {
    setError(null)
    if (!fullName.trim()) return setError('Full name is required.')
    if (!address.trim()) return setError('Address is required.')
    if (!/^\d{10}$/.test(phone)) return setError('Phone must be 10 digits.')
    if (!kw || Number(kw) <= 0) return setError('System size (kW) is required.')
    if (!totalCost || Number(totalCost) < 0) return setError('Total cost is required.')
    if (!signedAt) return setError('Signed date is required.')

    setSubmitting(true)
    try {
      await createIntake.mutateAsync({
        lead_id: lead.id,
        signed_at: signedAt,
        full_name: fullName.trim(),
        address: address.trim(),
        phone,
        email: email || null,
        age: age ? Number(age) : null,
        kw: Number(kw),
        roof_type: (roofType as any) || null,
        panel_company: (panelCompany as any) || null,
        panel_company_other: panelCompanyOther || null,
        panel_size: panelSize || null,
        inverter: (inverter as any) || null,
        inverter_other: inverterOther || null,
        structure: (structure as any) || null,
        structure_height: structureHeight || null,
        payment_method: paymentMethod,
        total_cost: Number(totalCost),
        cash_advance: cashAdvance ? Number(cashAdvance) : null,
        cash_remaining_after_install: cashRemaining ? Number(cashRemaining) : null,
        cash_subsidy_after_dispersal: cashSubsidy ? Number(cashSubsidy) : null,
        loan_bank_name: loanBankName || null,
        loan_advance: loanAdvance ? Number(loanAdvance) : null,
        loan_after_dispersal: loanAfterDispersal ? Number(loanAfterDispersal) : null,
        loan_subsidy_consumer: loanSubsidyConsumer ? Number(loanSubsidyConsumer) : null,
        doc_aadhaar: !!docs.doc_aadhaar,
        doc_pan: !!docs.doc_pan,
        doc_bank_passbook: !!docs.doc_bank_passbook,
        doc_email: !!docs.doc_email,
        doc_house_8a: !!docs.doc_house_8a,
        doc_light_bill: !!docs.doc_light_bill,
        doc_cancelled_cheque: !!docs.doc_cancelled_cheque,
        cibil_checked: !!docs.cibil_checked,
        scope_stamp_paper: !!scope.scope_stamp_paper,
        scope_concrete_block: !!scope.scope_concrete_block,
        scope_earthing: !!scope.scope_earthing,
        client_signature_url: clientSignatureUrl || null,
        salesman_signature_url: salesmanSignatureUrl || null,
      })
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save intake form')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancel() {
    const hasInput = fullName !== lead.name || address !== (lead.address ?? '') || phone !== lead.phone
      || email || age || kw || roofType || panelCompany || panelSize || inverter || structure
      || totalCost || cashAdvance || loanBankName || clientSignatureUrl || salesmanSignatureUrl
    if (!hasInput) {
      onCancel?.()
      return
    }
    Alert.alert('Discard this intake form?', 'What you entered will be lost.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onCancel },
    ])
  }

  return (
    <View style={styles.form}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Client Info</Text>
      <Field label="Full Name *">
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholderTextColor="#9ca3af" />
      </Field>
      <Field label="Phone *">
        <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="numeric" maxLength={10} placeholderTextColor="#9ca3af" />
      </Field>
      <Field label="Address *">
        <TextInput style={styles.input} value={address} onChangeText={setAddress} placeholderTextColor="#9ca3af" />
      </Field>
      <View style={styles.row2}>
        <View style={styles.col}>
          <Field label="Email">
            <TextInput style={styles.input} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor="#9ca3af" />
          </Field>
        </View>
        <View style={styles.col}>
          <Field label="Age">
            <TextInput style={styles.input} value={age} onChangeText={setAge} keyboardType="numeric" placeholderTextColor="#9ca3af" />
          </Field>
        </View>
      </View>
      <View style={styles.field}>
        <DateTimeField label="Signed Date *" value={signedAt} onChange={setSignedAt} mode="date" placeholder="Pick a date" />
      </View>

      <Text style={styles.sectionTitle}>System Info</Text>
      <Field label="System Size (kW) *">
        <TextInput style={styles.input} value={kw} onChangeText={setKw} keyboardType="numeric" placeholder="e.g. 5" placeholderTextColor="#9ca3af" />
      </Field>
      <Field label="Roof Type">
        <ChipSelect options={ROOF_OPTIONS as any} value={roofType as any} onChange={setRoofType} />
      </Field>
      <Field label="Panel Company">
        <ChipSelect options={PANEL_OPTIONS as any} value={panelCompany as any} onChange={setPanelCompany} />
      </Field>
      {panelCompany === 'other' && (
        <Field label="Panel Company (Other)">
          <TextInput style={styles.input} value={panelCompanyOther} onChangeText={setPanelCompanyOther} placeholderTextColor="#9ca3af" />
        </Field>
      )}
      <Field label="Panel Size">
        <TextInput style={styles.input} value={panelSize} onChangeText={setPanelSize} placeholderTextColor="#9ca3af" />
      </Field>
      <Field label="Inverter">
        <ChipSelect options={INVERTER_OPTIONS as any} value={inverter as any} onChange={setInverter} />
      </Field>
      {inverter === 'other' && (
        <Field label="Inverter (Other)">
          <TextInput style={styles.input} value={inverterOther} onChangeText={setInverterOther} placeholderTextColor="#9ca3af" />
        </Field>
      )}
      <Field label="Structure">
        <ChipSelect options={STRUCTURE_OPTIONS as any} value={structure as any} onChange={setStructure} />
      </Field>
      <Field label="Structure Height">
        <TextInput style={styles.input} value={structureHeight} onChangeText={setStructureHeight} placeholderTextColor="#9ca3af" />
      </Field>

      <Text style={styles.sectionTitle}>Payment</Text>
      <Field label="Payment Method *">
        <ChipSelect options={PAYMENT_OPTIONS as any} value={paymentMethod} onChange={(v) => setPaymentMethod(v as 'cash' | 'loan')} />
      </Field>
      <Field label="Total Cost (₹) *">
        <TextInput style={styles.input} value={totalCost} onChangeText={setTotalCost} keyboardType="numeric" placeholderTextColor="#9ca3af" />
      </Field>

      {paymentMethod === 'cash' ? (
        <>
          <View style={styles.row2}>
            <View style={styles.col}>
              <Field label="Advance (₹)">
                <TextInput style={styles.input} value={cashAdvance} onChangeText={setCashAdvance} keyboardType="numeric" placeholderTextColor="#9ca3af" />
              </Field>
            </View>
            <View style={styles.col}>
              <Field label="Remaining After Install (₹)">
                <TextInput style={styles.input} value={cashRemaining} onChangeText={setCashRemaining} keyboardType="numeric" placeholderTextColor="#9ca3af" />
              </Field>
            </View>
          </View>
          <Field label="Subsidy After Dispersal (₹)">
            <TextInput style={styles.input} value={cashSubsidy} onChangeText={setCashSubsidy} keyboardType="numeric" placeholderTextColor="#9ca3af" />
          </Field>
        </>
      ) : (
        <>
          <Field label="Bank Name">
            <TextInput style={styles.input} value={loanBankName} onChangeText={setLoanBankName} placeholderTextColor="#9ca3af" />
          </Field>
          <View style={styles.row2}>
            <View style={styles.col}>
              <Field label="Advance (₹)">
                <TextInput style={styles.input} value={loanAdvance} onChangeText={setLoanAdvance} keyboardType="numeric" placeholderTextColor="#9ca3af" />
              </Field>
            </View>
            <View style={styles.col}>
              <Field label="After Dispersal (₹)">
                <TextInput style={styles.input} value={loanAfterDispersal} onChangeText={setLoanAfterDispersal} keyboardType="numeric" placeholderTextColor="#9ca3af" />
              </Field>
            </View>
          </View>
          <Field label="Subsidy to Consumer (₹)">
            <TextInput style={styles.input} value={loanSubsidyConsumer} onChangeText={setLoanSubsidyConsumer} keyboardType="numeric" placeholderTextColor="#9ca3af" />
          </Field>
        </>
      )}

      <Text style={styles.sectionTitle}>Documents Collected</Text>
      <View style={styles.checkGrid}>
        {DOC_FIELDS.map(([key, label]) => (
          <View key={key} style={styles.checkRow}>
            <Switch value={!!docs[key]} onValueChange={() => toggle(setDocs, key)} />
            <Text style={styles.checkLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Customer Scope</Text>
      <View style={styles.checkGrid}>
        {SCOPE_FIELDS.map(([key, label]) => (
          <View key={key} style={styles.checkRow}>
            <Switch value={!!scope[key]} onValueChange={() => toggle(setScope, key)} />
            <Text style={styles.checkLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Signatures</Text>
      <Field label="Client Signature (URL)">
        <TextInput style={styles.input} value={clientSignatureUrl} onChangeText={setClientSignatureUrl} placeholder="Link to uploaded signature" placeholderTextColor="#9ca3af" />
      </Field>
      <Field label="Salesman Signature (URL)">
        <TextInput style={styles.input} value={salesmanSignatureUrl} onChangeText={setSalesmanSignatureUrl} placeholder="Link to uploaded signature" placeholderTextColor="#9ca3af" />
      </Field>

      <View style={styles.actions}>
        {onCancel && (
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleCancel} disabled={submitting}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.primaryBtn, submitting && styles.btnDisabled]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#052e16" /> : <Text style={styles.primaryBtnText}>Submit & Convert Lead</Text>}
        </TouchableOpacity>
      </View>
    </View>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  form: { gap: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#111827', marginTop: 10, marginBottom: 8 },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827', backgroundColor: '#fff' },
  row2: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  checkGrid: { marginBottom: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  checkLabel: { fontSize: 13, color: '#374151' },
  errorBox: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 10, marginBottom: 14 },
  errorText: { color: '#b91c1c', fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  secondaryBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  primaryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: '#4ade80', alignItems: 'center', justifyContent: 'center', minWidth: 180 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 13, color: '#052e16', fontWeight: '700' },
})
