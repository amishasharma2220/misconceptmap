import { Link, Route, Routes } from 'react-router-dom'
import { ApiStatus } from './components/ApiStatus'

function Home() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">MisconceptMap</h1>
      <p className="max-w-prose text-stone-600">
        GATE CS practice that tells you <em>why</em> you got it wrong, tracks mastery per
        concept, and picks your next question to fix your weakest prerequisite first.
      </p>
      <ApiStatus />
    </section>
  )
}

function NotFound() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="text-blue-700 underline">
        Back home
      </Link>
    </section>
  )
}

export default function App() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}
