import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import App from './App'
import type { AnswerResult, Label, PracticeSessionOut } from './api/types'
import { sample, sampleQuestions } from './data/sample'
import type { StudentSnapshot } from './data/types'
import { bktUpdate } from './pages/student/practiceLogic'
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

type Route = Parameters<typeof mockApi>[0][number]

function signedIn(role: 'student' | 'admin' = 'student', extra: Route[] = [], snapshot: StudentSnapshot = sample) {
  localStorage.setItem('mm.token', 'tok')
  return mockApi([['GET', '/me', 200, { ...student, role }], ['GET', '/me/snapshot', 200, snapshot], ...extra])
}

/** A one-question session built from the sample question with this id. */
function sessionWith(qid: number, result: AnswerResult | null = null): PracticeSessionOut {
  const q = sampleQuestions.find((x) => x.id === qid)!
  return {
    id: 7,
    mode: 'questions',
    title: 'Single question',
    size: 1,
    started_at: '2026-11-09T10:00:00Z',
    ended_at: null,
    done: !!result,
    items: [
      {
        position: 1,
        reason: 'You chose this question',
        result,
        question: {
          id: q.id,
          qtype: 'MCQ',
          subject: q.subject,
          concept: q.concept,
          also_tests: q.alsoTests,
          source: q.source,
          difficulty: q.difficulty,
          stem_md: q.stem,
          preview: q.stem,
          options: q.options.map((o) => ({ label: o.label, text_md: o.text })),
        },
      },
    ],
  }
}

function resultFor(qid: number, label: Label): AnswerResult {
  const q = sampleQuestions.find((x) => x.id === qid)!
  const opt = q.options.find((o) => o.label === label)!
  const mis = opt.misconception ? sample.misconceptions.find((m) => m.id === opt.misconception)! : undefined
  const before = sample.concepts.find((c) => c.slug === q.concept)!.mastery!
  return {
    question_id: qid,
    correct: opt.correct,
    chosen: [label],
    nat_value: null,
    correct_labels: q.options.filter((o) => o.correct).map((o) => o.label),
    nat_answer_min: null,
    nat_answer_max: null,
    explanation_md: q.explanation,
    misconceptions: mis ? [{ label, id: mis.id, slug: mis.slug, title: mis.title, explanation: mis.explanation, example: mis.example ?? null }] : [],
    mastery: [{ concept: q.concept, before, after: bktUpdate(before, opt.correct) }],
    review_due_at: opt.correct ? null : '2026-11-10T10:00:00Z',
    time_taken_ms: 30000,
  }
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
    ['GET', '/me/snapshot', 200, sample],
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

test('a new student sees empty states that point to the first session', async () => {
  const empty: StudentSnapshot = {
    ...sample,
    concepts: sample.concepts.map((c) => ({ ...c, mastery: null, attempts: 0, accuracy: null, lastPractisedDays: null, trend: [] })),
    misconceptions: sample.misconceptions.map((m) => ({ ...m, hits: 0, lastSeenDays: null })),
    sessions: [],
    review: [],
    daily: sample.daily.map((d) => ({ ...d, questions: 0, accuracy: null })),
    totals: { answered: 0, answeredThisWeek: 0, streakDays: 0, avgSecondsPerQuestion: null },
  }
  signedIn('student', [], empty)
  renderApp(<App />, '/home')
  expect(await screen.findByText(/Answer your first questions/)).toBeInTheDocument()
  expect(screen.getAllByRole('link', { name: 'Start your first session' }).length).toBeGreaterThan(0)
  expect(screen.getByText(/Your review queue|Questions you get wrong come back here/)).toBeInTheDocument()
})

test('the dashboard shows a load error with a retry', async () => {
  localStorage.setItem('mm.token', 'tok')
  mockApi([
    ['GET', '/me', 200, student],
    ['GET', '/me/snapshot', 500, { detail: 'Database is down' }],
  ])
  renderApp(<App />, '/home')
  expect(await screen.findByRole('alert')).toHaveTextContent('Database is down')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

test('a wrong answer shows the misconception behind it and the mastery change', async () => {
  const fetch = signedIn('student', [
    ['POST', '/sessions', 201, sessionWith(101)],
    ['GET', '/sessions/7', 200, sessionWith(101)],
    ['POST', '/sessions/7/answer', 200, resultFor(101, 'A')],
  ])
  renderApp(<App />, '/practice?q=101')
  const options = await screen.findByRole('radiogroup', { name: 'Options' })
  await userEvent.click(within(options).getByRole('radio', { name: /heap sort/i }))
  await userEvent.click(screen.getByRole('button', { name: 'Submit answer' }))

  expect(await screen.findByText(/Not quite: the answer is C/)).toBeInTheDocument()
  expect(screen.getAllByText('Believes heap sort is stable').length).toBeGreaterThan(0)
  expect(screen.getAllByText(/mastery 35% → \d+%/).length).toBeGreaterThan(0)
  expect(screen.getByText(/Added to your review queue: tomorrow|Added to your review queue/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /see session summary/i })).toBeInTheDocument()

  const create = fetch.mock.calls.find(([url, init]) => String(url).endsWith('/sessions') && init?.method === 'POST')!
  expect(JSON.parse(create[1]!.body as string)).toEqual({ mode: 'questions', questions: [101] })
  const answer = fetch.mock.calls.find(([url]) => String(url).endsWith('/sessions/7/answer'))!
  expect(JSON.parse(answer[1]!.body as string)).toMatchObject({ question_id: 101, chosen: ['A'] })
})

test('the summary page loads a finished session', async () => {
  const done = { ...sessionWith(101, resultFor(101, 'A')), ended_at: '2026-11-09T10:05:00Z' }
  signedIn('student', [['GET', '/sessions/7', 200, done]])
  renderApp(<App />, '/practice/summary?session=7')
  expect(await screen.findByText('0/1')).toBeInTheDocument()
  expect(screen.getByText('Picked A')).toBeInTheDocument()
  expect(screen.getAllByText('Believes heap sort is stable').length).toBeGreaterThan(0)
})

test('an empty review queue explains what to do instead of failing', async () => {
  signedIn('student', [['POST', '/sessions', 409, { detail: 'Nothing is due for review right now' }]])
  renderApp(<App />, '/practice?mode=review')
  expect(await screen.findByText('Nothing is due for review right now')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Start an adaptive session' })).toBeInTheDocument()
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
  signedIn('student', [
    ['POST', '/sessions', 201, sessionWith(102)],
    ['GET', '/sessions/7', 200, sessionWith(102)],
  ])
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
