import { useSyncExternalStore } from 'react'
import { slowRequests } from '../api/client'

/** Explains a long wait: the free server sleeps when nobody is using it. */
export function WakingNotice() {
  const slow = useSyncExternalStore(slowRequests.subscribe, slowRequests.get)
  if (!slow) return null
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-4 z-50 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-lg border border-rule bg-navy px-4 py-3 text-sm text-white shadow-lg"
    >
      <span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-amber align-middle" aria-hidden />
      Waking the server up. It sleeps when idle, so the first load can take up to a minute.
    </div>
  )
}
