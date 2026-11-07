import { useAuth } from '../../auth/AuthContext'
import { useCoachScreen } from '../../coach/CoachContext'
import { Panel } from '../../components/ui'

export function SettingsPage() {
  const { user } = useAuth()
  useCoachScreen({ label: 'Settings' })
  if (!user) return null
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Panel title="Profile">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-ink-soft">Name</dt>
            <dd>{user.display_name || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">Role</dt>
            <dd className="capitalize">{user.role}</dd>
          </div>
        </dl>
      </Panel>
      <Panel title="Research use">
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1" checked={user.consent_research} disabled />
          <span>
            <span className="block">Use my anonymised answers to evaluate MisconceptMap</span>
            <span className="text-sm text-ink-soft">
              You chose this when you signed up. Changing it here will be possible once account settings can be
              saved.
            </span>
          </span>
        </label>
      </Panel>
      <Panel title="Delete my data" className="border-pen/30">
        <p className="text-sm text-ink-soft">
          Removes your account, answers and mastery history permanently. This option is being added; until then,
          ask an admin to delete your account.
        </p>
        <button disabled className="mt-3 rounded-md border border-pen/40 px-3 py-1.5 text-sm text-pen opacity-60">
          Delete my data
        </button>
      </Panel>
    </div>
  )
}
