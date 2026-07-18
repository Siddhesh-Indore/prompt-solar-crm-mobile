// src/components/sales/ExecAssignPicker.tsx
// Pure-RN modal picker (no native picker dependency, so it works unmodified
// inside Expo Go — @react-native-picker/picker isn't bundled there).
import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, ActivityIndicator } from 'react-native'
import { useSalesTeam } from '@/hooks/useSalesTeam'

interface Props {
  value: string | null
  onChange: (execId: string) => void
  required?: boolean
}

export default function ExecAssignPicker({ value, onChange, required }: Props) {
  const { data: execs = [], isLoading } = useSalesTeam('sales_exec')
  const [open, setOpen] = useState(false)
  const selected = execs.find((e) => e.id === value)

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={() => setOpen(true)} disabled={isLoading}>
        {isLoading ? (
          <ActivityIndicator size="small" color="#6b7280" />
        ) : (
          <Text style={selected ? styles.value : styles.placeholder}>
            {selected ? selected.full_name : required ? 'Select a sales executive…' : 'Unassigned'}
          </Text>
        )}
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Select Sales Executive</Text>
            <FlatList
              data={execs}
              keyExtractor={(e) => e.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => { onChange(item.id); setOpen(false) }}
                >
                  <Text style={styles.rowText}>{item.full_name}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.empty}>No sales executives found.</Text>}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  field: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
  value: { fontSize: 14, color: '#111827' },
  placeholder: { fontSize: 14, color: '#9ca3af' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: '60%' },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  rowText: { fontSize: 14, color: '#111827' },
  empty: { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingVertical: 20 },
})
