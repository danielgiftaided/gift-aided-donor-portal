import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export default function AdminMfaChallenge() {
  const navigate = useNavigate()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors()
      if (error || !data.totp.length) { navigate('/admin/login'); return }
      setFactorId(data.totp[0].id)
    })()
  }, [])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!factorId || code.length !== 6) return
    setLoading(true); setError(null)
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
      if (error) throw error
      navigate('/admin')
    } catch {
      setError('Incorrect code — please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h1 className="text-xl font-bold text-brand-primary mb-2">Two-factor verification</h1>
        <p className="text-sm text-gray-500 mb-4">Enter the 6-digit code from your authenticator app.</p>
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm mb-4">{error}</div>}
        <form onSubmit={handleVerify} className="space-y-4">
          <input type="text" inputMode="numeric" maxLength={6} placeholder="000000"
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
          <button type="submit" disabled={loading || code.length !== 6 || !factorId}
            className="w-full bg-brand-accent text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40">
            {loading ? 'Verifying…' : 'Verify'}
          </button>
        </form>
        <button onClick={async () => { await supabase.auth.signOut(); navigate('/admin/login') }}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4">
          Sign out
        </button>
      </div>
    </div>
  )
}
