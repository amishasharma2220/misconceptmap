import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

/** Page body inside the app shell. */
export function Layout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return <div className={`mx-auto w-full ${wide ? 'max-w-[1600px]' : 'max-w-3xl'}`}>{children}</div>
}

function Loading() {
  return <p className="p-8 text-ink-soft">Loading…</p>
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  return <>{children}</>
}

export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Loading />
  if (user) return <Navigate to="/home" replace />
  return <>{children}</>
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Loading />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.role !== 'admin')
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Admins only</h1>
        <p className="text-ink-soft">
          This page is for adding and tagging questions. To make your account an admin, run{' '}
          <code className="rounded bg-sheet px-1">python -m app.auth.make_admin {user.email}</code> in{' '}
          <code className="rounded bg-sheet px-1">backend/</code>, then sign out and back in.
        </p>
      </div>
    )
  return <>{children}</>
}

export function Notice({ tone, children }: { tone: 'error' | 'ok' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-pen/40 bg-pen-tint text-pen',
    ok: 'border-ok/40 bg-ok/10 text-ok',
    info: 'border-omr/30 bg-omr-tint text-omr',
  }[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded border px-3 py-2 text-sm ${styles}`}>
      {children}
    </div>
  )
}
