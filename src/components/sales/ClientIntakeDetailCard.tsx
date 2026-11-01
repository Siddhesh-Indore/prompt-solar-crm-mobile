// src/components/sales/ClientIntakeDetailCard.tsx
// Read-only, full-field view of one signed client intake form — the
// collapsed row is a quick scan; expanding shows every field the sales exec
// captured. Mirrors the web CRM's ClientIntakeDetailCard.tsx. Visible to
// every internal role since migration 079 opened client_intake_forms_select
// to all staff, not just admin/manager/the signing exec.
import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { getIntakePhotoUrl, type ClientIntakeFormWithRelations } from '@/hooks/useClientIntake'
import PhotoThumbnail from '@/components/sales/PhotoThumbnail'
import { shareText, mapsLinkFor } from '@/lib/share'
import {
  ROOF_TYPE_LABEL, PANEL_COMPANY_LABEL, INVERTER_LABEL, STRUCTURE_LABEL,
  CUSTOMER_TYPE_LABEL, ADVANCE_MODE_LABEL, DOC_FIELDS, SCOPE_FIELDS, NAME_CHANGE_DOC_FIELDS,
} from './intakeFields'

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatCurrency(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (value == null || value === '') return null
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  )
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>
}

function ChipRow({ items }: { items: { label: string; done: boolean }[] }) {
  return (
    <View style={styles.chipRow}>
      {items.map((i) => (
        <View key={i.label} style={[styles.chip, i.done && styles.chipDone]}>
          <Text style={[styles.chipText, i.done && styles.chipTextDone]}>{i.label}</Text>
        </View>
      ))}
    </View>
  )
}

export default function ClientIntakeDetailCard({ f }: { f: ClientIntakeFormWithRelations }) {
  const [open, setOpen] = useState(false)
  const [sharingPhotos, setSharingPhotos] = useState(false)

  async function shareLocation() {
    // Prefer whatever's most precise: a pasted Maps link, then a live GPS
    // fix, falling back to the free-text address (see migration 081).
    const link = f.location_maps_link
      || (f.latitude != null && f.longitude != null ? mapsLinkFor(`${f.latitude},${f.longitude}`) : null)
      || (f.address ? mapsLinkFor(f.address) : null)
    if (!link) {
      Alert.alert('No location', 'No location on file for this customer.')
      return
    }
    await shareText({ title: `${f.full_name}'s location`, message: `${f.address ?? ''}\n${link}`.trim() })
  }

  async function sharePhotos() {
    if (!f.photo_paths?.length) {
      Alert.alert('No photos', 'No site photos for this customer.')
      return
    }
    setSharingPhotos(true)
    try {
      // Signed URLs expire after an hour (see getSignedPhotoUrl) — fine to
      // share right away, but a link sent today won't still work next week.
      const urls = (await Promise.all(f.photo_paths.map((p) => getIntakePhotoUrl(p)))).filter((u): u is string => !!u)
      if (urls.length === 0) {
        Alert.alert('Could not load photos', 'Try again in a moment.')
        return
      }
      await shareText({ title: `${f.full_name}'s site photos`, message: `Site photos for ${f.full_name}:\n${urls.join('\n')}` })
    } finally {
      setSharingPhotos(false)
    }
  }

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.header} onPress={() => setOpen((v) => !v)} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <View style={styles.headerRow}>
            <Text style={styles.name}>{f.full_name}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Finalized</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            {f.phone} · {f.kw}kW · {formatCurrency(f.total_cost)} · {f.payment_method === 'cash' ? 'Cash' : 'Loan'}
          </Text>
          <Text style={styles.metaSub}>
            {f.exec && `Signed by ${f.exec.full_name} · `}{formatDate(f.signed_at)}
          </Text>
        </View>
        <Text style={styles.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {open && (
        <View style={styles.body}>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={shareLocation}>
              <Text style={styles.actionBtnText}>📍 Share Location</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={sharePhotos} disabled={sharingPhotos}>
              {sharingPhotos ? <ActivityIndicator size="small" color="#374151" /> : <Text style={styles.actionBtnText}>📤 Share Photos</Text>}
            </TouchableOpacity>
          </View>

          <SectionTitle>Client Info</SectionTitle>
          <Field label="Full Name" value={f.full_name} />
          <Field label="Phone" value={f.phone} />
          <Field label="Address" value={f.address} />
          <Field label="Email" value={f.email} />
          <Field label="Age" value={f.age} />
          <Field label="Signed Date" value={formatDate(f.signed_at)} />

          {f.photo_paths?.length > 0 && (
            <>
              <SectionTitle>Site Photos</SectionTitle>
              <View style={styles.photoGrid}>
                {f.photo_paths.map((path) => (
                  <PhotoThumbnail key={path} bucket="intake-photos" path={path} />
                ))}
              </View>
            </>
          )}

          <SectionTitle>System Info</SectionTitle>
          <Field label="System Size" value={`${f.kw} kW`} />
          <Field label="Roof Type" value={f.roof_type && (ROOF_TYPE_LABEL[f.roof_type] ?? f.roof_type)} />
          <Field label="Panel Company" value={f.panel_company && (f.panel_company === 'other' ? f.panel_company_other : PANEL_COMPANY_LABEL[f.panel_company])} />
          <Field label="Panel Size" value={f.panel_size} />
          <Field label="Inverter" value={f.inverter && (f.inverter === 'other' ? f.inverter_other : INVERTER_LABEL[f.inverter])} />
          <Field label="Structure" value={f.structure && (STRUCTURE_LABEL[f.structure] ?? f.structure)} />
          <Field label="Structure Height" value={f.structure_height} />

          <SectionTitle>Payment</SectionTitle>
          <Field label="Customer Type" value={f.customer_type ? CUSTOMER_TYPE_LABEL[f.customer_type] : null} />
          <Field
            label="Government Subsidy"
            value={f.customer_type === 'commercial' ? 'Not applicable' : f.subsidy_amount != null ? formatCurrency(f.subsidy_amount) : null}
          />
          <Field label="Payment Method" value={f.payment_method === 'cash' ? 'Cash' : 'Loan'} />
          <Field label="Advance Received In" value={ADVANCE_MODE_LABEL[f.advance_mode ?? ''] ?? null} />
          {f.advance_mode === 'none' && <Field label="Advance Note" value={f.advance_note} />}
          <Field label="Total Cost" value={formatCurrency(f.total_cost)} />
          {f.payment_method === 'cash' ? (
            <>
              <Field label="Advance" value={f.cash_advance != null ? formatCurrency(f.cash_advance) : null} />
              <Field label="Remaining After Install" value={f.cash_remaining_after_install != null ? formatCurrency(f.cash_remaining_after_install) : null} />
              <Field label="Subsidy After Dispersal" value={f.cash_subsidy_after_dispersal != null ? formatCurrency(f.cash_subsidy_after_dispersal) : null} />
            </>
          ) : (
            <>
              <Field label="Bank Name" value={f.loan_bank_name} />
              <Field label="Advance" value={f.loan_advance != null ? formatCurrency(f.loan_advance) : null} />
              <Field label="After Dispersal" value={f.loan_after_dispersal != null ? formatCurrency(f.loan_after_dispersal) : null} />
              <Field label="Subsidy to Consumer" value={f.loan_subsidy_consumer != null ? formatCurrency(f.loan_subsidy_consumer) : null} />
            </>
          )}

          <SectionTitle>Documents Collected</SectionTitle>
          <ChipRow items={DOC_FIELDS.map((d) => ({ label: d.label, done: !!f[d.key] }))} />

          {f.name_change_required && (
            <>
              <SectionTitle>Electricity Bill Name Change</SectionTitle>
              <ChipRow
                items={[
                  ...NAME_CHANGE_DOC_FIELDS.map((d) => ({ label: d.label, done: !!f[d.key] })),
                  ...(f.namechange_bill_holder_deceased ? [{ label: 'Death Certificate', done: !!f.namechange_doc_death_certificate }] : []),
                  ...(f.namechange_meter_owned_by_other ? [{ label: 'Sammati Patra (Stamp Paper)', done: !!f.namechange_doc_sammati_patra }] : []),
                ]}
              />
            </>
          )}

          <SectionTitle>Customer Scope</SectionTitle>
          <ChipRow items={SCOPE_FIELDS.map((s) => ({ label: s.label, done: !!f[s.key] }))} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, marginBottom: 10, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 15, fontWeight: '600', color: '#111827' },
  badge: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#15803d' },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  metaSub: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  chevron: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  body: { borderTopWidth: 1, borderTopColor: '#f3f4f6', padding: 14, gap: 4 },
  actionsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  actionBtn: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingVertical: 9, alignItems: 'center', backgroundColor: '#f9fafb' },
  actionBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 6 },
  field: { marginBottom: 8 },
  fieldLabel: { fontSize: 11, color: '#9ca3af' },
  fieldValue: { fontSize: 13, color: '#1f2937', marginTop: 1 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#f9fafb' },
  chipDone: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  chipText: { fontSize: 10, fontWeight: '600', color: '#9ca3af' },
  chipTextDone: { color: '#15803d' },
})
