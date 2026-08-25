// src/components/sales/badges/SendBackBadge.tsx
// Flags a lead a sales exec sent back to the queue (ReassignToTelecallerForm)
// that no telecaller has reworked yet — see leads.sent_back_to_telecaller
// (migration 075). Renders nothing once it's false, so callers can drop it
// in unconditionally next to the other lead badges.
//
// Colored to match StageBadge's "Visited" (violet) rather than a color of
// its own — the original orange was identical to LeadSourceBadge's
// "Employee Ref", so on that source the two badges were indistinguishable
// at a glance. Violet doesn't collide with any source or stage color.
import { View, Text, StyleSheet } from 'react-native'

export default function SendBackBadge({ sentBack }: { sentBack: boolean }) {
  if (!sentBack) return null
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>↩ Back to Telecaller</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, backgroundColor: '#ede9fe', borderColor: '#ddd6fe' },
  text: { fontSize: 11, fontWeight: '600', color: '#6d28d9' },
})
