// src/components/ui/Skeleton.tsx
// Grey placeholder shapes shown while a list loads — keeps the screen's shape
// steady instead of a lone spinner, so content doesn't jump in. One shared
// pulse animation, native-driven.
import { useEffect, useRef } from 'react'
import { Animated, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import { brand } from '@/constants/brand'

function Pulse({ children, style }: { children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0.55)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])

  return <Animated.View style={[{ opacity }, style]}>{children}</Animated.View>
}

export function SkeletonBlock({ width = '100%', height = 12, radius = 6, style }: { width?: ViewStyle['width']; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  return <Pulse style={[{ width, height, borderRadius: radius, backgroundColor: brand.borderLight }, style]} />
}

/** A card-shaped placeholder: title line, two detail lines, and a button row. */
export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <SkeletonBlock width="55%" height={16} />
      <SkeletonBlock width="80%" style={{ marginTop: 10 }} />
      <SkeletonBlock width="65%" style={{ marginTop: 8 }} />
      <View style={styles.row}>
        <SkeletonBlock width={96} height={34} radius={10} />
        <SkeletonBlock width={110} height={34} radius={10} />
      </View>
    </View>
  )
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }, (_, i) => <SkeletonCard key={i} />)}
    </View>
  )
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  card: { backgroundColor: brand.white, borderWidth: 1, borderColor: brand.borderLight, borderRadius: 14, padding: 14, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8, marginTop: 14 },
})
