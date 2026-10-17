import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, test, vi } from 'vitest'
import App from './App'

function renderAt(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => vi.unstubAllGlobals())

test('home shows connected status when the API is healthy', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', db: 'ok' }) }),
  )
  renderAt('/')
  expect(screen.getByRole('heading', { name: 'MisconceptMap' })).toBeInTheDocument()
  expect(await screen.findByText('API and database connected')).toBeInTheDocument()
})

test('home shows an error when the API is down', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
  renderAt('/')
  expect(await screen.findByText(/API unreachable/)).toBeInTheDocument()
})

test('unknown routes show not found', () => {
  vi.stubGlobal('fetch', vi.fn())
  renderAt('/nope')
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
})
