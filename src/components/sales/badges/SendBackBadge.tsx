// src/components/sales/badges/SendBackBadge.tsx
// Flags a lead a sales exec sent back to the queue (ReassignToTelecallerForm)
// that no telecaller has reworked yet — see leads.sent_back_to_telecaller
// (migration 075). Renders nothing once it's false, so callers can drop it
// in unconditionally next to the other lead badges.
import { View, Text, StyleSheet } from 'react-native'

export default function SendBackBadge({ sentBack }: { sentBack: boolean }) {
  if (!sentBack) return null
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>↩ Send Back</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, backgroundColor: '#ffedd5', borderColor: '#fed7aa' },
  text: { fontSize: 11, fontWeight: '600', color: '#c2410c' },
})
