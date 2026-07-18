import { useNavigate, useLocation, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

function Logo() {
  return (
    <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, color: '#0c745d', fontSize: '1.4rem', lineHeight: 1 }}>
      gift aided <span style={{ fontWeight: 400 }}>Admin</span>
    </span>
  )
}

const navLinks = [
  { path: '/admin', label: 'Dashboard' },
  { path: '/admin/donors', label: 'Donors' },
  { path: '/admin/donations', label: 'Donations' },
  { path: '/admin/matching', label: 'Matching' },
  { path: '/admin/statements', label: 'Statements' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-brand-surface">
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="w-full px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Logo />
            <div className="flex items-center gap-1">
              {navLinks.map(link => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive(link.path)
                      ? 'bg-brand-accent/10 text-brand-accent'
                      : 'text-gray-500 hover:text-brand-primary hover:bg-gray-50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); navigate('/admin/login') }}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
