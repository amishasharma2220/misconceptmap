import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import { AuthProvider } from '../auth/AuthContext'

export function renderApp(ui: ReactElement, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  )
}

type Route = [method: string, path: string, status: number, body: unknown]

/** Stub fetch with a tiny routing table; unmatched calls fail the test loudly. */
export function mockApi(routes: Route[]) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase()
    const path = new URL(url).pathname + new URL(url).search
    const hit = routes.find(([m, p]) => m === method && (p === path || p === new URL(url).pathname))
    if (!hit) throw new Error(`Unmocked ${method} ${path}`)
    const [, , status, body] = hit
    return {
      ok: status < 400,
      status,
      statusText: String(status),
      json: async () => body,
    } as Response
  })
  vi.stubGlobal('fetch', fn)
  return fn
}
