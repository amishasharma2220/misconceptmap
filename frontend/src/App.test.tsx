import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import { mockApi, renderApp } from './test/render'

const student = {
  id: 1,
  email: 'amisha@example.com',
  display_name: 'Amisha Sharma',
  role: 'student',
  consent_research: true,
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => vi.unstubAllGlobals())

function signedIn(role: 'student' | 'admin' = 'student') {
  localStorage.setItem('mm.token', 'tok')
  mockApi([['GET', '/me', 200, { ...student, role }]])
}

test('landing page explains the product to signed-out visitors', () => {
  renderApp(<App />)
  expect(screen.getByRole('heading', { level: 1, name: 'Find out why you got it wrong.' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'A coach that knows your mistakes' })).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: /create account/i }).length).toBeGreaterThan(0)
})

test('visitors can answer the hero question and see the misconception', async () => {
  renderApp(<App />)
  const group = screen.getByRole('radiogroup', { name: 'Answer options' })
  await userEvent.click(within(group).getByRole('radio', { name: /heap sort/i }))
  expect(await screen.findByText('You may believe: heap sort is stable')).toBeInTheDocument()
  expect(screen.getByText(/35% → \d+%/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /try another/i }))
  expect(await screen.findByText('2 of 3', {}, { timeout: 2000 })).toBeInTheDocument()
  await waitFor(() => expect(screen.queryByText('You may believe: heap sort is stable')).not.toBeInTheDocument(), { timeout: 2000 })
})

test('signing in stores the token and lands on the dashboard', async () => {
  const fetch = mockApi([
    ['POST', '/auth/login', 200, { access_token: 'tok-123', token_type: 'bearer', user: student }],
  ])
  renderApp(<App />, '/login')
  await userEvent.type(screen.getByLabelText('Email'), 'amisha@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'password123')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

  expect(await screen.findByText(/, Amisha$/)).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Mastery heatmap' })).toBeInTheDocument()
  expect(localStorage.getItem('mm.token')).toBe('tok-123')
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({
    email: 'amisha@example.com',
    password: 'password123',
  })
})

test('a failed sign-in shows the server message', async () => {
  mockApi([['POST', '/auth/login', 401, { detail: 'Wrong email or password' }]])
  renderApp(<App />, '/login')
  await userEvent.type(screen.getByLabelText('Email'), 'a@example.com')
  await userEvent.type(screen.getByLabelText('Password'), 'nope')
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password')
})

test('app pages send signed-out visitors to sign in', async () => {
  renderApp(<App />, '/home')
  expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
})

test('signed-in visitors skip the landing page', async () => {
  signedIn()
  renderApp(<App />, '/')
  expect(await screen.findByRole('heading', { name: 'Mastery heatmap' })).toBeInTheDocument()
})

test('students see how to become an admin instead of the question bank', async () => {
  signedIn()
  renderApp(<App />, '/admin/questions')
  expect(await screen.findByRole('heading', { name: 'Admins only' })).toBeInTheDocument()
})

test('a wrong answer shows the misconception behind it and the mastery change', async () => {
  signedIn()
  renderApp(<App />, '/practice?q=101')
  const options = await screen.findByRole('radiogroup', { name: 'Options' })
  await userEvent.click(within(options).getByRole('radio', { name: /heap sort/i }))
  await userEvent.click(screen.getByRole('button', { name: 'Submit answer' }))

  expect(screen.getByText(/Not quite: the answer is C/)).toBeInTheDocument()
  expect(screen.getAllByText('Believes heap sort is stable').length).toBeGreaterThan(0)
  expect(screen.getAllByText(/mastery 35% → \d+%/).length).toBeGreaterThan(0)
  expect(screen.getByRole('button', { name: /see session summary/i })).toBeInTheDocument()
})

test('the coach recommends questions with a start button', async () => {
  signedIn()
  renderApp(<App />, '/home')
  await userEvent.click(await screen.findByRole('button', { name: /ask coach/i }))
  const panel = screen.getByRole('complementary', { name: 'AI coach' })
  await userEvent.click(within(panel).getByRole('button', { name: 'What should I practise today?' }))

  expect(await within(panel).findByText('Recommended for you', {}, { timeout: 2000 })).toBeInTheDocument()
  expect(within(panel).getAllByRole('button', { name: /start/i }).length).toBeGreaterThan(1)
})

test('the coach gives a hint, not the answer, before you submit', async () => {
  signedIn()
  renderApp(<App />, '/practice?q=102')
  await userEvent.click(await screen.findByRole('button', { name: /ask for a hint/i }))
  const panel = screen.getByRole('complementary', { name: 'AI coach' })
  await waitFor(() => expect(within(panel).getByText(/won't reveal the answer/)).toBeInTheDocument(), { timeout: 2000 })
  expect(within(panel).queryByText(/n \\log n/)).not.toBeInTheDocument()
})

test('unknown routes show not found', () => {
  renderApp(<App />, '/nope')
  expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
})
