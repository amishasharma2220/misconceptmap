import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Bubble } from '../components/Bubble'
import { Notice } from '../components/Layout'
import { Logo } from '../components/Logo'

const input =
  'w-full rounded-md border border-rule bg-sheet px-3 py-2.5 text-base focus:border-omr focus:outline-none'

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/home'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const signup = mode === 'signup'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (signup)
        await register({ email, password, display_name: name || undefined, consent_research: consent })
      else await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-6 sm:px-12">
        <Link to="/" aria-label="MisconceptMap home">
          <Logo />
        </Link>
        <form onSubmit={onSubmit} className="m-auto w-full max-w-sm space-y-4 py-10" noValidate>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{signup ? 'Create your account' : 'Welcome back'}</h1>
            <p className="mt-1 text-ink-soft">
              {signup ? 'Start practising GATE CS with feedback on every mistake.' : 'Sign in to continue practising.'}
            </p>
          </div>
          {error && <Notice tone="error">{error}</Notice>}
          {signup && (
            <label className="block space-y-1">
              <span className="text-sm text-ink-soft">Name (optional)</span>
              <input className={input} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <label className="block space-y-1">
            <span className="text-sm text-ink-soft">Email</span>
            <input
              className={input}
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm text-ink-soft">Password{signup && ' (at least 8 characters)'}</span>
            <input
              className={input}
              type="password"
              autoComplete={signup ? 'new-password' : 'current-password'}
              required
              minLength={signup ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {signup && (
            <label className="flex gap-2 text-sm text-ink-soft">
              <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                Use my anonymised answers to evaluate MisconceptMap (optional).{' '}
                <Link to="/privacy" className="text-omr hover:underline">
                  What is stored
                </Link>
              </span>
            </label>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-omr px-4 py-2.5 font-bold text-white hover:bg-omr/90 disabled:opacity-60"
          >
            {busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'}
          </button>
          <p className="text-sm text-ink-soft">
            {signup ? 'Already have an account? ' : 'New here? '}
            <Link to={signup ? '/login' : '/signup'} className="text-omr underline">
              {signup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
        </form>
      </div>

      <aside className="hidden flex-col justify-center bg-navy px-12 text-white lg:flex">
        <div className="max-w-md">
          <p className="text-2xl font-bold leading-snug">
            “Wrong” is not feedback. The belief behind it is.
          </p>
          <div className="mt-8 rounded-xl bg-sheet p-5 text-ink">
            <p className="text-sm">
              What is the solution of <span className="font-bold">T(n) = 2T(n/2) + n</span>?
            </p>
            <div className="mt-3 flex items-center gap-3 rounded-md border border-pen/50 px-3 py-2 text-sm">
              <Bubble label="A" filled={false} wrong size="sm" /> Θ(n)
            </div>
            <p className="ml-10 mt-1.5 border-l-2 border-pen pl-2 text-sm font-bold text-pen">
              Drops the log factor in master theorem case 2
            </p>
            <div className="mt-2 flex items-center gap-3 rounded-md border border-ok/50 bg-ok-tint px-3 py-2 text-sm">
              <Bubble label="B" filled size="sm" /> Θ(n log n)
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
