import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useCoachScreen } from '../../coach/CoachContext'
import { btn, Panel } from '../../components/ui'

export function SettingsPage() {
  const { user, updateProfile, deleteAccount } = useAuth()
  const navigate = useNavigate()
  useCoachScreen({ label: 'Settings' })

  const [name, setName] = useState(user?.display_name ?? '')
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState('')

  const saveName = useMutation({ mutationFn: () => updateProfile({ display_name: name }) })
  const saveConsent = useMutation({
    mutationFn: (consent_research: boolean) => updateProfile({ consent_research }),
  })
  const remove = useMutation({
    mutationFn: () => deleteAccount(password),
    onSuccess: () => navigate('/', { replace: true }),
  })

  if (!user) return null
  const nameChanged = name.trim() !== (user.display_name ?? '')

  function onSaveName(e: FormEvent) {
    e.preventDefault()
    if (nameChanged) saveName.mutate()
  }
  function onDelete(e: FormEvent) {
    e.preventDefault()
    if (password) remove.mutate()
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel title="Profile">
        <form onSubmit={onSaveName} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="settings-name" className="block text-xs text-ink-soft">
              Name
            </label>
            <div className="mt-1 flex gap-2">
              <input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoComplete="name"
                className="min-w-0 flex-1 rounded-md border border-rule px-3 py-1.5"
              />
              <button className={btn.quiet} disabled={!nameChanged || saveName.isPending}>
                {saveName.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
            <p className="mt-1 min-h-5 text-xs" role="status">
              {saveName.isError && <span className="text-pen">{saveName.error.message}</span>}
              {saveName.isSuccess && !nameChanged && <span className="text-ok">Saved</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-soft">Email</p>
            <p className="mt-1 py-1.5">{user.email}</p>
          </div>
          <div>
            <p className="text-xs text-ink-soft">Role</p>
            <p className="capitalize">{user.role}</p>
          </div>
        </form>
      </Panel>

      <Panel title="Research use">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={user.consent_research}
            disabled={saveConsent.isPending}
            onChange={(e) => saveConsent.mutate(e.target.checked)}
          />
          <span>
            <span className="block">Use my anonymised answers to evaluate MisconceptMap</span>
            <span className="text-sm text-ink-soft">
              If this is on, your answers (never your name or email) may be used to measure how well the mastery
              model works. You can turn it off at any time; it does not change how the app works for you.
            </span>
          </span>
        </label>
        <p className="mt-2 min-h-5 text-xs" role="status">
          {saveConsent.isError && <span className="text-pen">{saveConsent.error.message}</span>}
          {saveConsent.isSuccess && <span className="text-ok">Saved</span>}
        </p>
      </Panel>

      <Panel title="Delete my data" className="border-pen/30">
        <p className="text-sm text-ink-soft">
          Permanently removes your account, every answer you have given, your mastery history, your review queue
          and your coach conversations. This cannot be undone.
        </p>
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="mt-3 rounded-md border border-pen/40 px-3 py-1.5 text-sm text-pen hover:bg-pen-tint"
          >
            Delete my data
          </button>
        ) : (
          <form onSubmit={onDelete} className="mt-4 space-y-3 rounded-md bg-pen-tint/50 p-4">
            <label className="block text-sm">
              <span>Enter your password to confirm</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                autoFocus
                className="mt-1 block w-full max-w-xs rounded-md border border-rule bg-sheet px-3 py-1.5"
              />
            </label>
            {remove.isError && (
              <p role="alert" className="text-sm text-pen">
                {remove.error.message}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                disabled={!password || remove.isPending}
                className="rounded-md bg-pen px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {remove.isPending ? 'Deleting…' : 'Delete everything permanently'}
              </button>
              <button
                type="button"
                className={btn.quiet}
                onClick={() => {
                  setConfirming(false)
                  setPassword('')
                  remove.reset()
                }}
              >
                Keep my account
              </button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  )
}
