// src/components/sales/ClientIntakeForm.tsx
// Digital replica of the paper client intake form — mirrors the web CRM's
// ClientIntakeForm.tsx. Only reachable when the latest visit report's
// outcome is 'finalized' (enforced by the caller, visits.tsx). Submitting
// converts the lead (stage -> converted).
import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, ActivityIndicator, Alert, Image, Modal, Pressable } from 'react-native'
import { useCreateClientIntakeForm } from '@/hooks/useClientIntake'
import { useAuth } from '@/context/AuthContext'
import ChipSelect from '@/components/sales/ChipSelect'
import DateTimeField from '@/components/sales/DateTimeField'
import IntakePhotoCapture, { MIN_INTAKE_PHOTOS, type IntakePhoto } from '@/components/sales/IntakePhotoCapture'
import {
  CUSTOMER_TYPES, RESIDENTIAL_SUBSIDY_SLABS, HOUSING_SOCIETY_RATE_PER_KW,
  hasGovernmentSubsidy, suggestedSubsidy, remainingAfterAdvance, type CustomerType,
} from '@/lib/subsidy'
import type { Lead } from '@/types/sales'

const ROOF_OPTIONS = [{ value: 'rcc', label: 'RCC' }, { value: 'roofing_metal_sheets', label: 'Roofing Metal Sheets' }] as const
const PANEL_OPTIONS = [{ value: 'adani', label: 'Adani' }, { value: 'waaree', label: 'Waaree' }, { value: 'other', label: 'Other' }] as const
const INVERTER_OPTIONS = [{ value: 'vsole', label: 'VSole' }, { value: 'waaree', label: 'Waaree' }, { value: 'solaredge', label: 'SolarEdge' }, { value: 'other', label: 'Other' }] as const
const STRUCTURE_OPTIONS = [{ value: 'monorail', label: 'Monorail' }, { value: 'gi', label: 'GI' }, { value: 'hdg', label: 'HDG' }] as const
const PAYMENT_OPTIONS = [{ value: 'cash', label: 'Cash' }, { value: 'loan', label: 'Loan' }] as const
const ADVANCE_MODE_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'online', label: 'Online (Prompt Solar account)' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'none', label: 'None (Not Taken Advance)' },
] as const

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

// Required once name-change is switched on, regardless of the two
// sub-conditions below.
const NAME_CHANGE_DOC_FIELDS = [
  ['namechange_doc_aadhaar', 'Aadhaar Card'],
  ['namechange_doc_house_8a', 'House 8A (Gharpatrak)'],
] as const

interface ClientIntakeFormProps {
  lead: Lead
  onDone: () => void
  onCancel?: () => void
}

export default function ClientIntakeForm({ lead, onDone, onCancel }: ClientIntakeFormProps) {
  const createIntake = useCreateClientIntakeForm()
  const { user } = useAuth()

  // Confirmed before the rest of the form renders — it decides whether any
  // subsidy applies at all, and getting it wrong means promising a customer
  // money they can't claim.
  const [customerType, setCustomerType] = useState<CustomerType | null>(null)

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

  // Once the exec picks a slab themselves, stop overwriting it — "auto-select,
  // still editable" means the suggestion yields as soon as they touch it, not
  // that their choice gets clobbered the next time kw changes.
  const [subsidyAmount, setSubsidyAmount] = useState(0)
  const [subsidyTouched, setSubsidyTouched] = useState(false)
  const subsidyApplies = customerType ? hasGovernmentSubsidy(customerType) : false

  useEffect(() => {
    if (!customerType) return
    if (!hasGovernmentSubsidy(customerType)) {
      setSubsidyAmount(0)
      return
    }
    if (subsidyTouched) return
    setSubsidyAmount(suggestedSubsidy(customerType, Number(kw) || 0))
  }, [customerType, kw, subsidyTouched])

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'loan'>('cash')
  const [totalCost, setTotalCost] = useState('')
  const [cashAdvance, setCashAdvance] = useState('')
  const [advanceMode, setAdvanceMode] = useState<'cash' | 'online' | 'none' | 'cheque' | undefined>()
  const [qrModalVisible, setQrModalVisible] = useState(false)
  const [loanBankName, setLoanBankName] = useState('')
  const [loanAdvance, setLoanAdvance] = useState('')
  const [loanAfterDispersal, setLoanAfterDispersal] = useState('')
  const [loanSubsidyConsumer, setLoanSubsidyConsumer] = useState('')

  // Derived rather than typed so the figures can't disagree — same rule the
  // web form follows for these two.
  const remainingAfterInstall = remainingAfterAdvance(Number(totalCost) || 0, Number(cashAdvance) || 0, Number(subsidyAmount) || 0)

  const [docs, setDocs] = useState<Record<string, boolean>>({})
  const [scope, setScope] = useState<Record<string, boolean>>({})
  const [photos, setPhotos] = useState<IntakePhoto[]>([])

  const [nameChangeRequired, setNameChangeRequired] = useState(false)
  const [namechangeDocs, setNamechangeDocs] = useState<Record<string, boolean>>({})
  const [billHolderDeceased, setBillHolderDeceased] = useState(false)
  const [meterOwnedByOther, setMeterOwnedByOther] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function toggle(setter: typeof setDocs, key: string) {
    setter((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // Clears the whole name-change sub-flow the instant it's switched off,
  // rather than just hiding it — so an exec who flips it by mistake, or
  // changes their mind, doesn't leave stale "yes" answers behind that submit
  // would otherwise have to guard against silently.
  function handleNameChangeToggle(value: boolean) {
    setNameChangeRequired(value)
    if (!value) {
      setNamechangeDocs({})
      setBillHolderDeceased(false)
      setMeterOwnedByOther(false)
    }
  }

  function handleBillHolderDeceasedToggle(value: boolean) {
    setBillHolderDeceased(value)
    if (!value) setNamechangeDocs((prev) => ({ ...prev, namechange_doc_death_certificate: false }))
  }

  function handleMeterOwnedByOtherToggle(value: boolean) {
    setMeterOwnedByOther(value)
    if (!value) setNamechangeDocs((prev) => ({ ...prev, namechange_doc_sammati_patra: false }))
  }

  async function submit() {
    setError(null)
    if (!fullName.trim()) return setError('Full name is required.')
    if (!address.trim()) return setError('Address is required.')
    if (!/^\d{10}$/.test(phone)) return setError('Phone must be 10 digits.')
    if (!kw || Number(kw) <= 0) return setError('System size (kW) is required.')
    if (!totalCost || Number(totalCost) < 0) return setError('Total cost is required.')
    if (!signedAt) return setError('Signed date is required.')
    if (!customerType) return setError('Customer type is required.')
    const uploadedPhotoPaths = photos.filter((p): p is IntakePhoto & { path: string } => !!p.path && !p.uploading).map((p) => p.path)
    if (uploadedPhotoPaths.length < MIN_INTAKE_PHOTOS) return setError(`At least ${MIN_INTAKE_PHOTOS} site photos are required.`)
    if (photos.some((p) => p.uploading)) return setError('Wait for all photos to finish uploading.')

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
        customer_type: customerType,
        subsidy_amount: subsidyApplies ? subsidyAmount : 0,
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
        cash_advance: paymentMethod === 'cash' && cashAdvance ? Number(cashAdvance) : null,
        advance_mode: paymentMethod === 'cash' ? (advanceMode ?? null) : null,
        cash_remaining_after_install: paymentMethod === 'cash' ? remainingAfterInstall : null,
        cash_subsidy_after_dispersal: paymentMethod === 'cash' ? subsidyAmount : null,
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
        photo_paths: uploadedPhotoPaths,
        // Guarded here, not just in the UI: a sub-field can only be true when
        // its parent condition is — so an exec who switches on "deceased",
        // then switches off "name change required" entirely, can't submit a
        // stray death-certificate flag for a name change that's no longer
        // happening.
        name_change_required: nameChangeRequired,
        namechange_doc_aadhaar: nameChangeRequired && !!namechangeDocs.namechange_doc_aadhaar,
        namechange_doc_house_8a: nameChangeRequired && !!namechangeDocs.namechange_doc_house_8a,
        namechange_bill_holder_deceased: nameChangeRequired && billHolderDeceased,
        namechange_doc_death_certificate: nameChangeRequired && billHolderDeceased && !!namechangeDocs.namechange_doc_death_certificate,
        namechange_meter_owned_by_other: nameChangeRequired && meterOwnedByOther,
        namechange_doc_sammati_patra: nameChangeRequired && meterOwnedByOther && !!namechangeDocs.namechange_doc_sammati_patra,
        // No longer collected on this form — kept as columns (old records
        // still reference them) but every new submission signs them off as
        // not captured here.
        client_signature_url: null,
        salesman_signature_url: null,
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
      || totalCost || cashAdvance || loanBankName || customerType || nameChangeRequired || photos.length > 0
    if (!hasInput) {
      onCancel?.()
      return
    }
    Alert.alert('Discard this intake form?', 'What you entered will be lost.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onCancel },
    ])
  }

  // Step 1 — confirm the customer type before anything else.
  if (!customerType) {
    return (
      <View style={styles.form}>
        <Text style={styles.sectionTitle}>What type of customer is this?</Text>
        <Text style={styles.gateSubtitle}>This decides the government subsidy, so confirm it before filling the form.</Text>
        <View style={{ gap: 10, marginTop: 4 }}>
          {CUSTOMER_TYPES.map((t) => (
            <TouchableOpacity
              key={t.value}
              style={styles.typeCard}
              onPress={() => {
                setCustomerType(t.value)
                setSubsidyTouched(false)
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.typeCardTitle}>{t.label}</Text>
                <Text style={styles.typeCardNote}>{t.note}</Text>
              </View>
              <View style={[styles.typeCardPill, hasGovernmentSubsidy(t.value) ? styles.typeCardPillYes : styles.typeCardPillNo]}>
                <Text style={[styles.typeCardPillText, hasGovernmentSubsidy(t.value) ? styles.typeCardPillTextYes : styles.typeCardPillTextNo]}>
                  {hasGovernmentSubsidy(t.value) ? 'Subsidy' : 'No subsidy'}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        {onCancel && (
          <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 16, alignSelf: 'flex-start' }]} onPress={handleCancel}>
            <Text style={styles.secondaryBtnText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    )
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

      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Government Subsidy</Text>
        <TouchableOpacity onPress={() => { setCustomerType(null); setSubsidyTouched(false) }}>
          <Text style={styles.changeTypeLink}>Change customer type</Text>
        </TouchableOpacity>
      </View>
      {!subsidyApplies ? (
        <View style={styles.noSubsidyNote}>
          <Text style={styles.noSubsidyNoteText}><Text style={{ fontWeight: '700' }}>Commercial</Text> — no government subsidy applies.</Text>
        </View>
      ) : customerType === 'housing_society' ? (
        <Field label="Subsidy (₹)">
          <View style={styles.readOnlyInput}>
            <Text style={styles.readOnlyInputText}>₹{subsidyAmount.toLocaleString('en-IN')}</Text>
          </View>
          <Text style={styles.caption}>Housing society — ₹{HOUSING_SOCIETY_RATE_PER_KW.toLocaleString('en-IN')}/kW × {Number(kw) || 0} kW</Text>
        </Field>
      ) : (
        <Field label="Subsidy Slab (₹)">
          <ChipSelect
            options={RESIDENTIAL_SUBSIDY_SLABS.map((s) => ({ value: String(s.amount), label: s.label }))}
            value={String(subsidyAmount)}
            onChange={(v) => { setSubsidyAmount(Number(v)); setSubsidyTouched(true) }}
          />
          <Text style={styles.caption}>Suggested from {Number(kw) || 0} kW — change it if the sanctioned load differs.</Text>
        </Field>
      )}

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
              <Field label="Advance Received In">
                <ChipSelect options={ADVANCE_MODE_OPTIONS as any} value={advanceMode} onChange={(v) => setAdvanceMode(v as 'cash' | 'online' | 'none' | 'cheque')} />
              </Field>
            </View>
          </View>

          {advanceMode === 'online' && (
            <View style={styles.qrCard}>
              <TouchableOpacity onPress={() => setQrModalVisible(true)} accessibilityLabel="Open the payment QR code full size">
                <Image source={require('@/assets/images/payment-qr-icici.jpg')} style={styles.qrThumb} resizeMode="contain" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.qrTitle}>Scan and Pay</Text>
                <Text style={styles.qrLine}>Prompt Solar Renewables Private Limited</Text>
                <Text style={[styles.qrLine, { marginTop: 6 }]}>UPI ID — <Text style={styles.qrMono}>eazypay.2000006862@icici</Text></Text>
                <Text style={styles.qrLine}>Collection A/C — <Text style={styles.qrMono}>xxxxxxxx0127</Text></Text>
                <Text style={styles.caption}>Tap the QR to enlarge it, then show the customer to scan and pay the advance.</Text>
              </View>
            </View>
          )}

          <Modal visible={qrModalVisible} transparent animationType="fade" onRequestClose={() => setQrModalVisible(false)}>
            <Pressable style={styles.qrModalBackdrop} onPress={() => setQrModalVisible(false)}>
              <View style={styles.qrModalCard}>
                <Text style={styles.qrModalTitle}>Scan and Pay — Prompt Solar Renewables</Text>
                <Image source={require('@/assets/images/payment-qr-icici.jpg')} style={styles.qrModalImage} resizeMode="contain" />
                <TouchableOpacity style={styles.qrModalCloseBtn} onPress={() => setQrModalVisible(false)}>
                  <Text style={styles.qrModalCloseBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>

          <View style={styles.row2}>
            <View style={styles.col}>
              <Field label="Remaining After Install (₹)">
                <View style={styles.readOnlyInput}>
                  <Text style={styles.readOnlyInputText}>₹{remainingAfterInstall.toLocaleString('en-IN')}</Text>
                </View>
              </Field>
            </View>
            <View style={styles.col}>
              <Field label="Subsidy After Dispersal (₹)">
                <View style={styles.readOnlyInput}>
                  <Text style={styles.readOnlyInputText}>₹{subsidyAmount.toLocaleString('en-IN')}</Text>
                </View>
                <Text style={styles.caption}>Same as the subsidy selected above</Text>
              </Field>
            </View>
          </View>
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

      <Text style={styles.sectionTitle}>Electricity Bill Name Change</Text>
      <View style={styles.checkRow}>
        <Switch value={nameChangeRequired} onValueChange={handleNameChangeToggle} />
        <Text style={styles.checkLabel}>Name change required on electricity bill?</Text>
      </View>

      {nameChangeRequired && (
        <View style={styles.nameChangeBlock}>
          <View style={styles.checkGrid}>
            {NAME_CHANGE_DOC_FIELDS.map(([key, label]) => (
              <View key={key} style={styles.checkRow}>
                <Switch value={!!namechangeDocs[key]} onValueChange={() => toggle(setNamechangeDocs, key)} />
                <Text style={styles.checkLabel}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.checkRow}>
            <Switch value={billHolderDeceased} onValueChange={handleBillHolderDeceasedToggle} />
            <Text style={styles.checkLabel}>Is the person on the electricity bill deceased?</Text>
          </View>
          {billHolderDeceased && (
            <View style={[styles.checkRow, { marginLeft: 24 }]}>
              <Switch value={!!namechangeDocs.namechange_doc_death_certificate} onValueChange={() => toggle(setNamechangeDocs, 'namechange_doc_death_certificate')} />
              <Text style={styles.checkLabel}>Death Certificate</Text>
            </View>
          )}

          <View style={styles.checkRow}>
            <Switch value={meterOwnedByOther} onValueChange={handleMeterOwnedByOtherToggle} />
            <Text style={styles.checkLabel}>Is the meter owned by someone other than the applicant?</Text>
          </View>
          {meterOwnedByOther && (
            <View style={[styles.checkRow, { marginLeft: 24 }]}>
              <Switch value={!!namechangeDocs.namechange_doc_sammati_patra} onValueChange={() => toggle(setNamechangeDocs, 'namechange_doc_sammati_patra')} />
              <Text style={styles.checkLabel}>Sammati Patra (Consent Letter) on Stamp Paper</Text>
            </View>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Site Photos</Text>
      {user?.id && (
        <IntakePhotoCapture execId={user.id} leadId={lead.id} photos={photos} onChange={setPhotos} />
      )}

      <Text style={styles.sectionTitle}>Customer Scope</Text>
      <View style={styles.checkGrid}>
        {SCOPE_FIELDS.map(([key, label]) => (
          <View key={key} style={styles.checkRow}>
            <Switch value={!!scope[key]} onValueChange={() => toggle(setScope, key)} />
            <Text style={styles.checkLabel}>{label}</Text>
          </View>
        ))}
      </View>

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
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 8 },
  changeTypeLink: { fontSize: 12, fontWeight: '600', color: '#6b7280', textDecorationLine: 'underline' },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 14, color: '#111827', backgroundColor: '#fff' },
  readOnlyInput: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: '#f9fafb' },
  readOnlyInputText: { fontSize: 14, color: '#374151', fontWeight: '600' },
  caption: { fontSize: 11, color: '#9ca3af', marginTop: 5 },
  row2: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
  checkGrid: { marginBottom: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  checkLabel: { fontSize: 13, color: '#374151', flexShrink: 1 },
  nameChangeBlock: { paddingLeft: 12, marginBottom: 8, borderLeftWidth: 2, borderLeftColor: '#f3f4f6' },
  errorBox: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, padding: 10, marginBottom: 14 },
  errorText: { color: '#b91c1c', fontSize: 12 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  secondaryBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#d1d5db', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { fontSize: 13, color: '#374151', fontWeight: '600' },
  primaryBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, backgroundColor: '#4ade80', alignItems: 'center', justifyContent: 'center', minWidth: 180 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 13, color: '#052e16', fontWeight: '700' },
  gateSubtitle: { fontSize: 12, color: '#6b7280', marginTop: -4, marginBottom: 4 },
  typeCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff' },
  typeCardTitle: { fontSize: 14, fontWeight: '600', color: '#1f2937' },
  typeCardNote: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  typeCardPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  typeCardPillYes: { backgroundColor: '#f0fdf4' },
  typeCardPillNo: { backgroundColor: '#f3f4f6' },
  typeCardPillText: { fontSize: 11, fontWeight: '700' },
  typeCardPillTextYes: { color: '#15803d' },
  typeCardPillTextNo: { color: '#6b7280' },
  noSubsidyNote: { backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14 },
  noSubsidyNoteText: { fontSize: 13, color: '#4b5563' },
  qrCard: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb', padding: 14, marginBottom: 14 },
  qrThumb: { width: 96, height: 96, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' },
  qrTitle: { fontSize: 13, fontWeight: '700', color: '#1f2937' },
  qrLine: { fontSize: 12, color: '#6b7280' },
  qrMono: { color: '#374151', fontWeight: '600' },
  qrModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  qrModalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, width: '100%', maxWidth: 360, alignItems: 'center' },
  qrModalTitle: { fontSize: 13, fontWeight: '700', color: '#1f2937', marginBottom: 12, textAlign: 'center' },
  qrModalImage: { width: '100%', height: 320, borderRadius: 10 },
  qrModalCloseBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f3f4f6' },
  qrModalCloseBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
})
