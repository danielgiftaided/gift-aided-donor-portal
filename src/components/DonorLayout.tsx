/**
 * DonorLayout — shared authenticated layout for all donor-facing pages.
 *
 * Desktop (≥768px): horizontal top nav with all links
 * Mobile  (<768px): simplified header + sticky bottom tab bar
 *
 * Usage:
 *   <DonorLayout active="dashboard">
 *     <YourPageContent />
 *   </DonorLayout>
 */

import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type ActivePage = 'dashboard' | 'giving' | 'authorisation' | 'profile'

interface Props {
  children: React.ReactNode
  active: ActivePage
}

function Logo() {
  return (
    <Link to="/dashboard">
      <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, color: '#0c745d', fontSize: '1.4rem', lineHeight: 1 }}>
        gift aided
      </span>
    </Link>
  )
}

// Icons for bottom tab bar
function IconDashboard({ active }: { active: boolean }) {
  return (
    <svg className={`w-6 h-6 ${active ? 'text-brand-accent' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}
function IconGiving({ active }: { active: boolean }) {
  return (
    <svg className={`w-6 h-6 ${active ? 'text-brand-accent' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}
function IconAuth({ active }: { active: boolean }) {
  return (
    <svg className={`w-6 h-6 ${active ? 'text-brand-accent' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}
function IconProfile({ active }: { active: boolean }) {
  return (
    <svg className={`w-6 h-6 ${active ? 'text-brand-accent' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.5 : 2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  )
}

const tabs = [
  { id: 'dashboard' as const, label: 'Dashboard', path: '/dashboard' },
  { id: 'giving'    as const, label: 'My Giving',  path: '/giving-history' },
  { id: 'authorisation' as const, label: 'Gift Aid', path: '/authorisation' },
  { id: 'profile'   as const, label: 'Profile',    path: '/profile' },
]

export default function DonorLayout({ children, active }: Props) {
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-brand-surface flex flex-col">

      {/* ── Desktop top nav (hidden on mobile) ── */}
      <nav className="hidden md:flex bg-white border-b border-gray-100 px-8 py-4 items-center justify-between">
        <div className="flex items-center gap-6">
          <Logo />
          <div className="flex items-center gap-1">
            {tabs.map(t => (
              <Link key={t.id} to={t.path}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  active === t.id
                    ? 'bg-brand-accent/10 text-brand-accent'
                    : 'text-gray-500 hover:text-brand-primary hover:bg-gray-50'
                }`}>
                {t.label}
              </Link>
            ))}
          </div>
        </div>
        <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-gray-600">
          Sign out
        </button>
      </nav>

      {/* ── Mobile top bar (logo only, hidden on desktop) ── */}
      <div className="flex md:hidden bg-white border-b border-gray-100 px-4 py-3 items-center justify-between">
        <Logo />
        <button onClick={handleSignOut} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">
          Sign out
        </button>
      </div>

      {/* ── Page content — padded at bottom on mobile for the tab bar ── */}
      <main className="flex-1 pb-20 md:pb-0">
        {children}
      </main>

      {/* ── Mobile bottom tab bar (hidden on desktop) ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-20 safe-area-inset-bottom">
        <div className="flex items-stretch">
          {tabs.map(t => (
            <Link key={t.id} to={t.path}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition-colors min-h-[56px] ${
                active === t.id ? 'text-brand-accent' : 'text-gray-400'
              }`}>
              {t.id === 'dashboard'    && <IconDashboard    active={active === t.id} />}
              {t.id === 'giving'       && <IconGiving       active={active === t.id} />}
              {t.id === 'authorisation'&& <IconAuth         active={active === t.id} />}
              {t.id === 'profile'      && <IconProfile      active={active === t.id} />}
              <span className={`text-xs font-medium ${active === t.id ? 'text-brand-accent' : 'text-gray-400'}`}>
                {t.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>

    </div>
  )
}
