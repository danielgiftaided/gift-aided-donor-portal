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

type SetupPhase = 'waiting' | 'creating-profile' | 'mfa' | 'error'

export default function MfaSetup() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<SetupPhase>('waiting')
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Listen for the SIGNED_IN event which fires when the donor clicks
    // the email confirmation link and Supabase processes the token.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session) {
          await handleSessionReady(session.access_token)
        }
      }
    )

    // Also check if there's already a session (e.g. donor refreshed the page
    // after confirming their email on the same device).
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        await handleSessionReady(session.access_token)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSessionReady = async (token: string) => {
    setPhase('creating-profile')

    // Create the donor profile from the metadata stored during signup.
    // The register endpoint reads first_name, last_name etc from
    // user.user_metadata when no body fields are provided.
    try {
      const resp = await fetch('/api/donor/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      })
      const json = await resp.json()
      // 409 means profile already exists — that's fine, just proceed to MFA
      if (!resp.ok && resp.status !== 409) {
        throw new Error(json.error || 'Failed to create donor profile')
      }
    } catch (e: any) {
      setError(e.message)
      setPhase('error')
      return
    }

    // Profile created — now set up MFA
    await startMfaSetup()
  }

  const startMfaSetup = async () => {
    setPhase('mfa')
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Gift Aided Donor Portal',
      })
      if (error || !data) throw error || new Error('Could not start MFA setup')
      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
    } catch (e: any) {
      setError(e.message)
      setPhase('error')
    }
  }

  const handleVerify = async () => {
    if (!factorId || code.length !== 6) return
    setLoading(true); setError(null)
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId })
      if (chErr) throw chErr
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code,
      })
      if (vErr) throw vErr
      navigate('/dashboard')
    } catch {
      setError('Incorrect code — please check your authenticator app and try again.')
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

          {/* Waiting for email confirmation */}
          {phase === 'waiting' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-brand-accent/30 border-t-brand-accent rounded-full animate-spin mx-auto" />
              <h2 className="font-bold text-brand-primary">Confirming your email…</h2>
              <p className="text-sm text-gray-500">
                If you just clicked the link in your confirmation email, please wait a moment.
              </p>
            </div>
          )}

          {/* Creating profile */}
          {phase === 'creating-profile' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-brand-accent/30 border-t-brand-accent rounded-full animate-spin mx-auto" />
              <h2 className="font-bold text-brand-primary">Setting up your account…</h2>
              <p className="text-sm text-gray-500">Just a moment while we create your Gift Aid profile.</p>
            </div>
          )}

          {/* MFA setup */}
          {phase === 'mfa' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
              <div className="text-center">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-green-600 text-lg">✓</span>
                </div>
                <h2 className="font-bold text-brand-primary">Email confirmed!</h2>
                <p className="text-sm text-gray-500 mt-1">
                  One last step — set up two-factor authentication to keep your account secure.
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
              )}

              {qrCode ? (
                <>
                  <p className="text-xs text-gray-400 text-center">
                    Scan this QR code with an authenticator app such as Google Authenticator or Authy.
                  </p>
                  <div className="flex justify-center">
                    <img src={qrCode} alt="MFA QR code" className="w-40 h-40 border border-gray-100 rounded" />
                  </div>
                  {secret && (
                    <div className="text-center">
                      <p className="text-xs text-gray-400 mb-1">Or enter this code manually in your app:</p>
                      <code className="text-xs font-mono bg-gray-50 px-2 py-1 rounded border border-gray-200 select-all break-all">
                        {secret}
                      </code>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1 text-center">
                      Enter the 6-digit code from your app
                    </label>
                    <input
                      type="text" inputMode="numeric" maxLength={6}
                      value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={e => e.key === 'Enter' && handleVerify()}
                      className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
                    />
                  </div>
                  <button
                    onClick={handleVerify}
                    disabled={loading || code.length !== 6}
                    className="w-full bg-brand-accent text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40"
                  >
                    {loading ? 'Verifying…' : 'Complete setup and go to dashboard'}
                  </button>
                </>
              ) : (
                <p className="text-center text-gray-400 text-sm">Loading two-factor setup…</p>
              )}
            </div>
          )}

          {/* Error state */}
          {phase === 'error' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center space-y-4">
              <p className="text-red-600 font-semibold">Something went wrong</p>
              <p className="text-sm text-gray-500">{error}</p>
              <button
                onClick={() => navigate('/register')}
                className="text-sm text-brand-accent hover:underline"
              >
                Back to registration
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}