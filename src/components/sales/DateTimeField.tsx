// src/components/sales/DateTimeField.tsx
// Native calendar/clock picker, replacing the old "type YYYY-MM-DD" text
// fields — those were error-prone to type on a phone keyboard and easy to
// get wrong (wrong format, wrong separators). Stores/returns an ISO date
// string ("YYYY-MM-DD") for mode="date", "HH:MM" for mode="time", or a full
// ISO datetime for mode="datetime".
import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'

interface DateTimeFieldProps {
  label: string
  value: string // '' when unset
  onChange: (value: string) => void
  mode: 'date' | 'time' | 'datetime'
  placeholder?: string
  minimumDate?: Date
}

function parseValue(value: string, mode: DateTimeFieldProps['mode']): Date {
  if (!value) return new Date()
  if (mode === 'time') {
    const [h, m] = value.split(':').map(Number)
    const d = new Date()
    d.setHours(h || 0, m || 0, 0, 0)
    return d
  }
  const d = new Date(value)
  return isNaN(d.getTime()) ? new Date() : d
}

function formatValue(date: Date, mode: DateTimeFieldProps['mode']): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const timeStr = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (mode === 'date') return dateStr
  if (mode === 'time') return timeStr
  return `${dateStr}T${timeStr}:00`
}

function displayValue(value: string, mode: DateTimeFieldProps['mode']): string {
  if (!value) return ''
  const d = parseValue(value, mode)
  if (mode === 'date') return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  if (mode === 'time') return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function DateTimeField({ label, value, onChange, mode, placeholder, minimumDate }: DateTimeFieldProps) {
  const [showDate, setShowDate] = useState(false)
  const [showTime, setShowTime] = useState(false)
  // datetime mode needs a picked date to carry forward while picking the time
  const [pendingDate, setPendingDate] = useState<Date | null>(null)

  function openPicker() {
    if (mode === 'time') setShowTime(true)
    else setShowDate(true)
  }

  // Using the deprecated onChange rather than onValueChange/onDismiss: on
  // this installed version (9.1.0), onValueChange never actually fired on
  // Android when confirming a date (tested live in Expo Go) — the dialog
  // closed but nothing was reported back. onChange is proven to work.
  function onDateChange(event: DateTimePickerEvent, selected?: Date) {
    setShowDate(false)
    if (event.type === 'dismissed' || !selected) return
    if (mode === 'date') {
      onChange(formatValue(selected, 'date'))
    } else {
      // datetime: date picked, now ask for time
      setPendingDate(selected)
      setShowTime(true)
    }
  }

  function onTimeChange(event: DateTimePickerEvent, selected?: Date) {
    setShowTime(false)
    if (event.type === 'dismissed' || !selected) return
    if (mode === 'time') {
      onChange(formatValue(selected, 'time'))
    } else {
      const base = pendingDate ?? parseValue(value, 'datetime')
      const combined = new Date(base)
      combined.setHours(selected.getHours(), selected.getMinutes(), 0, 0)
      onChange(formatValue(combined, 'datetime'))
      setPendingDate(null)
    }
  }

  const display = displayValue(value, mode)

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity style={styles.field} onPress={openPicker}>
        <Text style={display ? styles.value : styles.placeholder}>
          {display || placeholder || 'Tap to select…'}
        </Text>
      </TouchableOpacity>

      {showDate && (
        <DateTimePicker
          value={parseValue(value, mode)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minimumDate}
          onChange={onDateChange}
        />
      )}
      {showTime && (
        <DateTimePicker
          value={parseValue(value, mode)}
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onTimeChange}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  field: {
    borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, backgroundColor: '#fff', minHeight: 44, justifyContent: 'center',
  },
  value: { fontSize: 14, color: '#111827' },
  placeholder: { fontSize: 14, color: '#9ca3af' },
})
