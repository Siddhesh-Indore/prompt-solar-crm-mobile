// src/lib/attendanceApi.ts
// Sends a sales exec's punch in / punch out to the company attendance system
// (POST https://app.promptco.in/attendance). It takes the same message the
// office's access-controller (face terminal) sends: an `event_log` that is a
// JSON *string* holding the time and the employee's number and name. The
// message carries no in/out flag — the attendance system tells them apart by
// order, as it does for the terminal — so a punch in and a punch out are sent
// identically, each with the moment it actually happened.
export const ATTENDANCE_API_URL = 'https://app.promptco.in/attendance'

const REQUEST_TIMEOUT_MS = 15_000

/** 'YYYY-MM-DD HH:mm:ss' in Indian time — the clock the office terminal uses. */
export function formatEventDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}

export interface AttendanceEvent {
  /** When the punch happened (ISO timestamp). */
  at: string
  employeeNo: string
  name: string
}

/** The request body exactly as the attendance system expects it. */
export function buildAttendanceBody(event: AttendanceEvent): { event_log: string } {
  return {
    event_log: JSON.stringify({
      dateTime: formatEventDateTime(event.at),
      AccessControllerEvent: { employeeNoString: event.employeeNo, name: event.name },
    }),
  }
}

/** True when the attendance system accepted the punch. Never throws — a
 * failure (no signal, server down) just returns false so the caller can retry later. */
export async function sendAttendanceEvent(event: AttendanceEvent): Promise<boolean> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(ATTENDANCE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildAttendanceBody(event)),
      signal: controller.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}
