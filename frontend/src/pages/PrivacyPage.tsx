import { Link } from 'react-router-dom'
import { Logo } from '../components/Logo'

const CONTACT = import.meta.env.VITE_CONTACT_EMAIL as string | undefined

const sections: [string, string[]][] = [
  [
    'What is stored',
    [
      'Your email address and, if you give one, your name.',
      'Your password, as a one-way hash. Nobody, including the person running the site, can read it.',
      'Every answer you submit: the question, the option you chose, whether it was right, how long you took, and when.',
      'What is worked out from those answers: your mastery of each concept and your review queue.',
      'Your conversations with the coach.',
    ],
  ],
  [
    'What it is used for',
    [
      'Running the app for you: choosing questions, tracking mastery, scheduling reviews and answering you in the coach.',
      'Research, only if you ticked "Use my anonymised answers". Then your answers and timings, without your name or email, may be used to measure how well the mastery model works. You can change this in Settings at any time.',
      'Nothing else. There are no ads, no analytics trackers, and your data is not sold or shared for marketing.',
    ],
  ],
  [
    'Who else handles it',
    [
      'The companies that host the website, the server and the database store the data on our behalf.',
      "When the AI coach is switched on, your message, the question on your screen and your practice statistics (mastery levels, misconceptions hit, review counts) are sent to Google's Gemini service to write the reply. Your name, email and password are never sent.",
    ],
  ],
  [
    'In your browser',
    [
      'A sign-in token is kept in your browser so you stay signed in. Signing out removes it. No tracking cookies are used.',
    ],
  ],
  [
    'Deleting your data',
    [
      'Settings → Delete my data permanently removes your account, answers, mastery history, review queue and coach conversations straight away.',
      'There is no password reset by email yet. If you lose your password, get in touch and the account can be removed so you can sign up again.',
    ],
  ],
]

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-rule bg-sheet">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/" aria-label="MisconceptMap home">
            <Logo />
          </Link>
          <Link to="/signup" className="text-sm text-omr hover:underline">
            Create account
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <div>
          <h1 className="text-3xl font-bold">Privacy</h1>
          <p className="mt-2 text-ink-soft">
            MisconceptMap is a student project for GATE CS practice. This page says plainly what it keeps about
            you and why.
          </p>
        </div>
        {sections.map(([title, items]) => (
          <section key={title}>
            <h2 className="text-lg font-bold">{title}</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink-soft">
              {items.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        ))}
        {CONTACT && (
          <section>
            <h2 className="text-lg font-bold">Contact</h2>
            <p className="mt-2 text-ink-soft">
              Questions or requests about your data:{' '}
              <a className="text-omr hover:underline" href={`mailto:${CONTACT}`}>
                {CONTACT}
              </a>
            </p>
          </section>
        )}
      </main>
    </div>
  )
}
