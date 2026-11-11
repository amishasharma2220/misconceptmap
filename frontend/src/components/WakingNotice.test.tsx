import { act, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { apiGet } from '../api/client'
import { WakingNotice } from './WakingNotice'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('a request slower than 4 seconds shows the waking message until it finishes', async () => {
  vi.useFakeTimers()
  let respond!: (r: Response) => void
  vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => (respond = r))))
  render(<WakingNotice />)

  const pending = apiGet('/health')
  await act(() => vi.advanceTimersByTimeAsync(3900))
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  await act(() => vi.advanceTimersByTimeAsync(200))
  expect(screen.getByRole('status')).toHaveTextContent('Waking the server up')

  await act(async () => {
    respond({ ok: true, status: 200, json: async () => ({ status: 'ok' }) } as Response)
    await pending
  })
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})

test('fast requests never show it', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }) as Response))
  render(<WakingNotice />)
  await act(async () => {
    await apiGet('/health')
  })
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
})
