import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { passwordStrengthMessage, isPasswordBreached } from '../lib/hibp'

function Logo() {
  return (
    <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, color: '#0c745d', fontSize: '1.6rem', lineHeight: 1 }}>
      gift aided <span style={{ fontWeight: 400 }}>Portal</span>
    </span>
  )
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
          navigate('/mfa-challenge', { state: { returnTo: '/reset-password' } })
          return
        }
        setReady(true)
      }
    })
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
          navigate('/mfa-challenge', { state: { returnTo: '/reset-password' } })
          return
        }
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleReset = async () => {
    const msg = passwordStrengthMessage(password)
    if (msg) { setError(msg); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true); setError(null)
    const breached = await isPasswordBreached(password)
    if (breached) { setError('This password has appeared in a data breach. Please choose a different one.'); setLoading(false); return }
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => navigate('/dashboard'), 2000)
  }

  return (
    <div className="min-h-screen bg-brand-surface flex flex-col">
      <nav className="bg-white border-b border-gray-100 px-8 py-4"><Logo /></nav>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h1 className="text-xl font-bold text-brand-primary">Set a new password</h1>
          {!ready ? (
            <p className="text-sm text-gray-400">Verifying your reset link…</p>
          ) : done ? (
            <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">Password updated — taking you to your dashboard.</div>
          ) : (
            <>
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
              <input type="password" placeholder="New password" value={password} onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
              <input type="password" placeholder="Confirm new password" value={confirm} onChange={e => setConfirm(e.target.value)}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
              {password && confirm && (
                <p className={`text-xs ${password === confirm ? 'text-green-600' : 'text-red-500'}`}>
                  {password === confirm ? 'Passwords match ✓' : 'Passwords do not match'}
                </p>
              )}
              <button onClick={handleReset} disabled={loading}
                className="w-full bg-brand-accent text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40">
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
