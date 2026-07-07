import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Logo() {
  return (
    <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, color: '#0c745d', fontSize: '1.6rem', lineHeight: 1 }}>
      gift aided <span style={{ fontWeight: 400 }}>Portal</span>
    </span>
  )
}

export default function MfaSetup() {
  const navigate = useNavigate()
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Gift Aided Donor Portal' })
      if (error || !data) { setError(error?.message || 'Could not start MFA setup.'); return }
      setFactorId(data.id); setQrCode(data.totp.qr_code); setSecret(data.totp.secret)
    })()
  }, [])

  const verify = async () => {
    if (!factorId || code.length !== 6) return
    setLoading(true); setError(null)
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId })
      if (chErr) throw chErr
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code })
      if (vErr) throw vErr
      navigate('/dashboard')
    } catch {
      setError('Incorrect code — please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-surface flex flex-col">
      <nav className="bg-white border-b border-gray-100 px-8 py-4"><Logo /></nav>
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
          <h1 className="text-xl font-bold text-brand-primary">Set up two-factor authentication</h1>
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          {qrCode && (
            <>
              <p className="text-xs text-gray-400">Scan with Google Authenticator or Authy.</p>
              <div className="flex justify-center">
                <img src={qrCode} alt="MFA QR code" className="w-40 h-40 border border-gray-100 rounded" />
              </div>
              {secret && <p className="text-center text-xs font-mono bg-gray-50 border border-gray-200 rounded px-2 py-1 select-all">{secret}</p>}
              <input type="text" inputMode="numeric" maxLength={6} placeholder="6-digit code"
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
              <button onClick={verify} disabled={loading || code.length !== 6}
                className="w-full bg-brand-accent text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40">
                {loading ? 'Verifying…' : 'Confirm and continue'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
