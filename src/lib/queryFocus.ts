// src/lib/queryFocus.ts
// React Query decides when to refetch stale data from a "focus" signal, but
// that signal is a browser concept — on a phone nothing fires it, so an app
// left open in the background never picked up changes made elsewhere (e.g. a
// telecaller fixing a visit for this exec). Tie it to the app returning to the
// foreground instead. Imported once for its side effect, from the root layout.
import { AppState, Platform } from 'react-native'
import { focusManager } from '@tanstack/react-query'

if (Platform.OS !== 'web') {
  focusManager.setEventListener((handleFocus) => {
    const sub = AppState.addEventListener('change', (state) => handleFocus(state === 'active'))
    return () => sub.remove()
  })
}
