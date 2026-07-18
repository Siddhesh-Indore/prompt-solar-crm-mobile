// src/components/sales/LeadDetailModal.tsx
// Full-screen read-only lead detail sheet — everything qualification/visit
// gathered so far, so a sales exec can review before or during a visit
// without hunting through the web app.
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import LeadSourceBadge from '@/components/sales/badges/LeadSourceBadge'
import StageBadge from '@/components/sales/badges/StageBadge'
import TemperatureBadge from '@/components/sales/badges/TemperatureBadge'
import type { Lead } from '@/types/sales'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatMoney(n: number | null) {
  if (n === null || n === undefined) return '—'
  return `₹${n.toLocaleString('en-IN')}`
}

const ROOF_LABEL: Record<string, string> = { rcc: 'RCC', metal_terrace: 'Metal Terrace' }
const OWNERSHIP_LABEL: Record<string, string> = { owned: 'Owned', rented: 'Rented' }
const PROPERTY_LABEL: Record<string, string> = { residential: 'Residential', commercial: 'Commercial' }

interface LeadDetailModalProps {
  lead: Lead | null
  onClose: () => void
}

export default function LeadDetailModal({ lead, onClose }: LeadDetailModalProps) {
  if (!lead) return null

  return (
    <Modal visible={!!lead} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.closeBtnText}>‹ Close</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.name}>{lead.name}</Text>
          <TouchableOpacity onPress={() => Linking.openURL(`tel:${lead.phone}`)}>
            <Text style={styles.phone}>📞 {lead.phone}</Text>
          </TouchableOpacity>

          <View style={styles.badgeRow}>
            <LeadSourceBadge source={lead.source} />
            <StageBadge stage={lead.stage} />
            <TemperatureBadge temperature={lead.temperature} />
          </View>

          <Section title="Visit">
            <Row label="Address" value={lead.address ?? '—'} />
            <Row label="Visit Date" value={lead.visit_date ? `${formatDate(lead.visit_date)} ${lead.visit_time ?? ''}` : '—'} />
          </Section>

          <Section title="Property">
            <Row label="Roof Type" value={lead.roof_type ? ROOF_LABEL[lead.roof_type] : '—'} />
            <Row label="Ownership" value={lead.ownership ? OWNERSHIP_LABEL[lead.ownership] : '—'} />
            <Row label="Property Type" value={lead.property_type ? PROPERTY_LABEL[lead.property_type] : '—'} />
            <Row label="Monthly Bill" value={formatMoney(lead.approx_bill_amount)} />
          </Section>

          <Section title="Quote">
            <Row label="Quote Range" value={lead.quote_range_min || lead.quote_range_max ? `${formatMoney(lead.quote_range_min)} – ${formatMoney(lead.quote_range_max)}` : '—'} />
            <Row label="Competitor Contacted" value={lead.competitor_contacted ? (lead.competitor_name || 'Yes') : 'No'} />
          </Section>

          <Section title="Team">
            <Row label="Telecaller" value={lead.assigned_caller?.full_name ?? '—'} />
            <Row label="Sales Executive" value={lead.assigned_exec?.full_name ?? '—'} />
          </Section>

          {lead.notes ? (
            <Section title="Notes">
              <Text style={styles.notes}>{lead.notes}</Text>
            </Section>
          ) : null}

          <Section title="Lead Info">
            <Row label="Created" value={formatDate(lead.created_at)} />
          </Section>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9fafb' },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  closeBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#fff',
  },
  closeBtnText: { fontSize: 15, color: '#111827', fontWeight: '700' },
  content: { padding: 20, paddingTop: 8 },
  name: { fontSize: 22, fontWeight: '700', color: '#111827' },
  phone: { fontSize: 14, color: '#047857', fontWeight: '600', marginTop: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  sectionCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, gap: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  rowLabel: { fontSize: 13, color: '#6b7280', flexShrink: 0 },
  rowValue: { fontSize: 13, color: '#111827', fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  notes: { fontSize: 13, color: '#374151', lineHeight: 19 },
})
