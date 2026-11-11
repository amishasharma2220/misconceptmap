import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { RedirectIfSignedIn, RequireAdmin, RequireAuth } from './components/Layout'
import { AuthPage } from './pages/AuthPage'
import { LandingPage } from './pages/LandingPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { QuestionEditorPage } from './pages/admin/QuestionEditorPage'
import { QuestionsPage } from './pages/admin/QuestionsPage'
import { AnalyticsPage } from './pages/student/AnalyticsPage'
import { CoachPage } from './pages/student/CoachPage'
import { ConceptMapPage } from './pages/student/ConceptMapPage'
import { DashboardPage } from './pages/student/DashboardPage'
import { PracticePage } from './pages/student/PracticePage'
import { ReviewPage } from './pages/student/ReviewPage'
import { SettingsPage } from './pages/student/SettingsPage'
import { SummaryPage } from './pages/student/SummaryPage'

function NotFound() {
  return (
    <section className="mx-auto max-w-md space-y-2 px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="text-ink-soft">That address doesn’t match any page.</p>
      <Link to="/" className="text-omr underline">
        Go to the start page
      </Link>
    </section>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RedirectIfSignedIn><LandingPage /></RedirectIfSignedIn>} />
      <Route path="/login" element={<RedirectIfSignedIn><AuthPage mode="login" /></RedirectIfSignedIn>} />
      <Route path="/signup" element={<RedirectIfSignedIn><AuthPage mode="signup" /></RedirectIfSignedIn>} />
      <Route path="/privacy" element={<PrivacyPage />} />

      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/home" element={<DashboardPage />} />
        <Route path="/dashboard" element={<Navigate to="/home" replace />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="/practice/summary" element={<SummaryPage />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/map" element={<Navigate to="/map/DSA" replace />} />
        <Route path="/map/:subject" element={<ConceptMapPage />} />
        <Route path="/coach" element={<CoachPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin/questions" element={<RequireAdmin><QuestionsPage /></RequireAdmin>} />
        <Route path="/admin/questions/:id" element={<RequireAdmin><QuestionEditorPage /></RequireAdmin>} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
