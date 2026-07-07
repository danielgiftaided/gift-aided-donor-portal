import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Logo() {
  return (
    <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, color: '#0c745d', fontSize: '1.6rem', lineHeight: 1 }}>
      gift aided <span style={{ fontWeight: 400 }}>Portal</span>
    </span>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    setError(null)
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true)
    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (signInErr) throw signInErr

      // Check AAL — if MFA enrolled, redirect to challenge
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
        navigate('/mfa-challenge')
        return
      }
      navigate('/dashboard')
    } catch (e: any) {
      setError('Incorrect email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-surface flex flex-col">
      <nav className="bg-white border-b border-gray-100 px-8 py-4">
        <Logo />
      </nav>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-brand-primary">Donor sign in</h1>
            <p className="text-gray-500 text-sm mt-1">Access your Gift Aid account</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
            </div>
            <button onClick={handleLogin} disabled={loading}
              className="w-full bg-brand-accent text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <div className="flex items-center justify-between text-xs text-gray-400">
              <Link to="/forgot-password" className="hover:text-brand-accent">Forgot password?</Link>
              <Link to="/register" className="hover:text-brand-accent">Create account</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
