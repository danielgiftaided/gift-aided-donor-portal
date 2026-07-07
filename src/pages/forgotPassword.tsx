import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Logo() {
  return (
    <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, color: '#0c745d', fontSize: '1.6rem', lineHeight: 1 }}>
      gift aided <span style={{ fontWeight: 400 }}>Portal</span>
    </span>
  )
}

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!email.trim()) { setError('Please enter your email address.'); return }
    setLoading(true); setError(null)
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  return (
    <div className="min-h-screen bg-brand-surface flex flex-col">
      <nav className="bg-white border-b border-gray-100 px-8 py-4"><Logo /></nav>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h1 className="text-xl font-bold text-brand-primary">Reset your password</h1>
            {sent ? (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-2 rounded text-sm">
                  Reset link sent — check your inbox.
                </div>
                <Link to="/login" className="block text-center text-sm text-brand-accent hover:underline">Back to sign in</Link>
              </div>
            ) : (
              <>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
                <p className="text-sm text-gray-500">Enter your email address and we will send you a reset link.</p>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
                <button onClick={handleSubmit} disabled={loading}
                  className="w-full bg-brand-accent text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40">
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
                <Link to="/login" className="block text-center text-xs text-gray-400 hover:text-brand-accent">Back to sign in</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
