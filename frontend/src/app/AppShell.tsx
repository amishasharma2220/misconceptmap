import {
  BarChart3,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Network,
  PencilLine,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { CoachProvider, useCoach } from '../coach/CoachContext'
import { CoachPanel } from '../coach/CoachPanel'
import { Logo } from '../components/Logo'
import { btn } from '../components/ui'
import { daysUntil, useStudent } from '../data/student'

const TITLES: [RegExp, string][] = [
  [/^\/home/, 'Dashboard'],
  [/^\/practice\/summary/, 'Session summary'],
  [/^\/practice/, 'Practice'],
  [/^\/review/, 'Review'],
  [/^\/analytics/, 'Analytics'],
  [/^\/map/, 'Concept map'],
  [/^\/coach/, 'AI coach'],
  [/^\/settings/, 'Settings'],
  [/^\/admin\/questions\/./, 'Edit question'],
  [/^\/admin/, 'Question bank'],
]

function readCollapsed(): boolean {
  try {
    return localStorage.getItem('mm.sidebar') === 'collapsed'
  } catch {
    return false
  }
}

export function AppShell() {
  return (
    <CoachProvider>
      <Shell />
    </CoachProvider>
  )
}

function Shell() {
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawer, setDrawer] = useState(false)
  const { pathname } = useLocation()
  const title = TITLES.find(([re]) => re.test(pathname))?.[1] ?? 'MisconceptMap'

  useEffect(() => {
    try {
      localStorage.setItem('mm.sidebar', collapsed ? 'collapsed' : 'open')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  // Close the mobile drawer whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) {
    setLastPath(pathname)
    setDrawer(false)
  }

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-sheet focus:px-3 focus:py-2">
        Skip to content
      </a>
      {/* desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar collapsed={collapsed} onCollapse={() => setCollapsed((c) => !c)} />
      </div>
      {/* mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button aria-label="Close menu" className="absolute inset-0 bg-ink/40" onClick={() => setDrawer(false)} />
          <div className="relative h-full w-64">
            <Sidebar collapsed={false} onClose={() => setDrawer(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={title} onMenu={() => setDrawer(true)} />
        <main id="main" className="min-w-0 flex-1 px-4 py-5 lg:px-6">
          <Outlet />
        </main>
      </div>
      <CoachPanel />
    </div>
  )
}

function Sidebar({
  collapsed,
  onCollapse,
  onClose,
}: {
  collapsed: boolean
  onCollapse?: () => void
  onClose?: () => void
}) {
  const { user, logout } = useAuth()
  const { data } = useStudent()
  const navigate = useNavigate()
  const due = data.review.filter((r) => r.dueInHours <= 0).length
  const days = daysUntil(data.gateDate)

  const items: { to: string; label: string; icon: ReactNode; badge?: number }[] = [
    { to: '/home', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/practice', label: 'Practice', icon: <PencilLine size={18} /> },
    { to: '/review', label: 'Review', icon: <RotateCcw size={18} />, badge: due },
    { to: '/analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
    { to: '/map/DSA', label: 'Concept map', icon: <Network size={18} /> },
    { to: '/coach', label: 'AI coach', icon: <Sparkles size={18} /> },
    { to: '/settings', label: 'Settings', icon: <Settings size={18} /> },
  ]
  if (user?.role === 'admin')
    items.push({ to: '/admin/questions', label: 'Question bank', icon: <ClipboardList size={18} /> })

  const link = ({ isActive }: { isActive: boolean }) =>
    `group flex items-center gap-3 rounded-md px-2.5 py-2 text-sm ${
      isActive ? 'bg-white/10 font-bold text-white' : 'text-[#b8c2d6] hover:bg-white/5 hover:text-white'
    } ${collapsed ? 'justify-center' : ''}`

  return (
    <nav
      aria-label="Main"
      className={`sticky top-0 flex h-screen flex-col bg-navy text-white ${collapsed ? 'w-16' : 'w-60'}`}
    >
      <div className={`flex items-center px-4 py-4 ${collapsed ? 'justify-center px-0' : 'justify-between'}`}>
        <Link to="/home" aria-label="MisconceptMap home">
          <Logo compact={collapsed} inverted />
        </Link>
        {onClose && (
          <button onClick={onClose} aria-label="Close menu" className="rounded p-1 text-[#b8c2d6] hover:text-white">
            <X size={18} />
          </button>
        )}
      </div>

      <ul className="flex-1 space-y-0.5 overflow-y-auto px-2">
        {items.map((it) => (
          <li key={it.to}>
            <NavLink to={it.to} className={link} title={collapsed ? it.label : undefined}>
              <span className="relative shrink-0">
                {it.icon}
                {collapsed && !!it.badge && (
                  <span className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full bg-[#f07a93]" aria-hidden />
                )}
              </span>
              {!collapsed && <span className="flex-1">{it.label}</span>}
              {!collapsed && !!it.badge && (
                <span className="tnum rounded-full bg-pen px-1.5 text-xs font-bold text-white">{it.badge}</span>
              )}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="space-y-3 border-t border-white/10 px-3 py-3">
        {!collapsed && (
          <div className="rounded-md bg-white/5 px-3 py-2">
            <p className="text-xs text-[#b8c2d6]">GATE CS 2027</p>
            <p className="tnum text-lg font-bold leading-tight">{days} days left</p>
          </div>
        )}
        <div className={`flex items-center gap-2 ${collapsed ? 'flex-col' : ''}`}>
          <span
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-omr text-sm font-bold"
            aria-hidden
          >
            {(user?.display_name || user?.email || '?').slice(0, 1).toUpperCase()}
          </span>
          {!collapsed && (
            <span className="min-w-0 flex-1 truncate text-sm">{user?.display_name || user?.email}</span>
          )}
          <button
            onClick={() => {
              logout()
              navigate('/')
            }}
            className="rounded p-1.5 text-[#b8c2d6] hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="flex w-full items-center justify-center gap-2 rounded py-1 text-xs text-[#b8c2d6] hover:text-white"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> Collapse</>}
          </button>
        )}
      </div>
    </nav>
  )
}

function TopBar({ title, onMenu }: { title: string; onMenu: () => void }) {
  const { toggle, open } = useCoach()
  const navigate = useNavigate()
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-rule bg-sheet/95 px-4 py-2.5 backdrop-blur lg:px-6">
      <button onClick={onMenu} className="rounded p-1.5 text-ink-soft hover:bg-rule-soft md:hidden" aria-label="Open menu">
        <Menu size={20} />
      </button>
      <h1 className="truncate text-lg font-bold">{title}</h1>
      <div className="ml-auto flex items-center gap-2">
        <ConceptSearch />
        <button
          onClick={toggle}
          aria-pressed={open}
          className={`${btn.quiet} ${open ? 'border-omr text-omr' : ''}`}
          title="Ask coach (Ctrl/⌘ J)"
        >
          <Sparkles size={15} /> <span className="hidden sm:inline">Ask coach</span>
        </button>
        <button onClick={() => navigate('/practice')} className={`${btn.primary} hidden sm:inline-flex`}>
          Start practice
        </button>
      </div>
    </header>
  )
}

function ConceptSearch() {
  const { data } = useStudent()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState(false)
  const results = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    return data.concepts.filter((c) => c.name.toLowerCase().includes(t)).slice(0, 6)
  }, [q, data.concepts])

  return (
    <div className="relative hidden lg:block">
      <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => window.setTimeout(() => setFocus(false), 150)}
        placeholder="Search concepts"
        aria-label="Search concepts"
        className="w-64 rounded-md border border-rule bg-paper py-1.5 pl-8 pr-3 text-sm focus:border-omr focus:bg-sheet focus:outline-none"
      />
      {focus && results.length > 0 && (
        <ul className="absolute right-0 top-full z-40 mt-1 w-80 overflow-hidden rounded-md border border-rule bg-sheet shadow-sm">
          {results.map((c) => (
            <li key={c.slug}>
              <button
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-paper"
                onMouseDown={() => {
                  navigate(`/map/${c.subject}?focus=${c.slug}`)
                  setQ('')
                }}
              >
                <span>{c.name}</span>
                <span className="text-xs text-ink-faint">{c.subject}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
