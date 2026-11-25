// src/hooks/useNotificationFeed.ts
// The exec's lead notifications (see lib/notificationFeed), shared by the bell,
// the Notifications tab, its badge and the Profile screen so they all show the
// same count. Sales execs only; everyone else gets an empty list.
import { useMemo } from 'react'
import { useExecWorkload } from '@/hooks/useExecWorkload'
import { buildNotificationFeed, type FeedItem } from '@/lib/notificationFeed'

export function useNotificationFeed(enabled: boolean, userId: string | undefined): { items: FeedItem[]; loading: boolean } {
  const { activeLeads, infoMap, followUps, loading } = useExecWorkload(enabled, userId)
  const items = useMemo(
    () => (enabled && !loading ? buildNotificationFeed({ leads: activeLeads, infoMap, followUps }) : []),
    [enabled, loading, activeLeads, infoMap, followUps],
  )
  return { items, loading }
}
