// src/lib/share.ts
import { Share } from 'react-native'

export async function shareText(payload: { title: string; message: string }) {
  try {
    await Share.share({ message: payload.message, title: payload.title })
  } catch {
    // User dismissed the share sheet — not an error, nothing to do.
  }
}

/** Google Maps search link for a free-text address/village — no GPS
 * coordinates needed, works for anything with a location string. */
export function mapsLinkFor(location: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
}
