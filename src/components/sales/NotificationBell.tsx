// src/components/sales/NotificationBell.tsx
// Bell with a count badge — Home's header and the Profile screen use it to
// open the Notifications tab.
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { hapticSelect } from '@/lib/haptics'
import { brand } from '@/constants/brand'

interface Props {
  count: number
  onPress: () => void
}

export default function NotificationBell({ count, onPress }: Props) {
  return (
    <TouchableOpacity
      style={styles.bell}
      onPress={() => { hapticSelect(); onPress() }}
      accessibilityLabel={count > 0 ? `Notifications: ${count} lead${count === 1 ? '' : 's'} need attention` : 'Notifications'}
      hitSlop={8}
    >
      <Ionicons name={count > 0 ? 'notifications' : 'notifications-outline'} size={23} color={count > 0 ? brand.navy : brand.muted} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  bell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 3, right: 1, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: brand.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: brand.bg },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
})
