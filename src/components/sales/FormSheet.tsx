// src/components/sales/FormSheet.tsx
// Full-screen modal sheet for forms opened from inside a FlatList item.
// Forms rendered inline in a list card have no way to scroll the focused
// input above the keyboard — this gives them their own KeyboardAvoidingView
// + ScrollView, same pattern as the working queue.tsx qualification flow.
//
// Deliberately has no header close button: every form passed in here already
// has its own Cancel button that confirms before discarding unsaved input
// (see PreVisitCallForm/PostVisitForm/ClientIntakeForm's handleCancel). A
// second, unconfirmed close affordance here would let people bypass that and
// lose what they typed.
import { Modal, View, Text, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

interface FormSheetProps {
  visible: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
}

export default function FormSheet({ visible, title, onClose, children }: FormSheetProps) {
  if (!visible) return null

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  title: { fontSize: 15, fontWeight: '700', color: '#111827' },
  content: { padding: 16 },
})
