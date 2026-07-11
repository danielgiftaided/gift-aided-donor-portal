import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isPasswordBreached, passwordStrengthMessage } from '../lib/hibp'

function Logo() {
  return (
    <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, color: '#0c745d', fontSize: '1.6rem', lineHeight: 1 }}>
      gift aided <span style={{ fontWeight: 400 }}>Portal</span>
    </span>
  )
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ['Your details', 'Important information', 'Authorisation', 'Verify email']
  return (
    <div className="flex items-center gap-0 mb-8">
      {labels.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={n} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                ${done ? 'bg-brand-accent text-white' : active ? 'bg-brand-primary text-white' : 'bg-gray-200 text-gray-400'}`}>
                {done ? '✓' : n}
              </div>
              <span className={`text-xs mt-1 hidden sm:block text-center leading-tight max-w-[80px]
                ${active ? 'text-brand-primary font-semibold' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div className={`flex-1 h-0.5 mx-1 -mt-4 ${done ? 'bg-brand-accent' : 'bg-gray-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Register() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Step 1 fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [address, setAddress] = useState('')
  const [postcode, setPostcode] = useState('')

  // Step 2 — explanation timestamp captured when page renders
  const explanationShownAt = useRef<string | null>(null)
  const [explanationConfirmed, setExplanationConfirmed] = useState(false)

  // Step 3 — three explicit consents
  const [consentIntermediary, setConsentIntermediary] = useState(false)
  const [consentTaxpayer, setConsentTaxpayer] = useState(false)
  const [consentLiability, setConsentLiability] = useState(false)

  useEffect(() => {
    if (step === 2 && !explanationShownAt.current) {
      explanationShownAt.current = new Date().toISOString()
    }
  }, [step])

  const handleStep1 = async () => {
    setError(null)
    if (!firstName.trim()) { setError('First name is required.'); return }
    if (!lastName.trim()) { setError('Last name is required.'); return }
    if (!email.trim()) { setError('Email address is required.'); return }
    if (!address.trim()) { setError('Home address is required.'); return }
    if (!postcode.trim()) { setError('Postcode is required.'); return }
    const strengthError = passwordStrengthMessage(password)
    if (strengthError) { setError(strengthError); return }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true)
    try {
      const breached = await isPasswordBreached(password)
      if (breached) {
        setError('This password has appeared in a known data breach. Please choose a different password.')
        return
      }
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  const handleStep2 = () => {
    if (!explanationConfirmed) {
      setError('Please confirm you have read and understood the information above.')
      return
    }
    setError(null)
    setStep(3)
  }

  const handleStep3 = async () => {
    setError(null)
    if (!consentIntermediary || !consentTaxpayer || !consentLiability) {
      setError('Please tick all three boxes to continue.')
      return
    }
    setLoading(true)
    try {
      const now = new Date()
      const taxYearFrom = getTaxYear(now)
      const taxYearTo = now.getMonth() >= 2
        ? getNextTaxYear(taxYearFrom)
        : taxYearFrom

      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            address: address.trim(),
            postcode: postcode.trim().toUpperCase(),
            explanation_shown_at: explanationShownAt.current,
            authorisation_date: now.toISOString(),
            tax_year_from: taxYearFrom,
            tax_year_to: taxYearTo,
          },
          emailRedirectTo: 'https://donors.giftaided.com/mfa-setup',
        },
      })

      if (signUpErr) {
        if (signUpErr.message.includes('already registered')) {
          setError('An account with this email address already exists. Please log in instead.')
        } else {
          throw signUpErr
        }
        return
      }

      // If email confirmation is disabled, Supabase returns an immediate
      // session — go straight to creating the profile and MFA setup.
      // If email confirmation is enabled, session will be null here and
      // we show the "check your email" screen instead.
      if (signUpData?.session) {
        const token = signUpData.session.access_token
        const resp = await fetch('/api/donor/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            address: address.trim(),
            postcode: postcode.trim().toUpperCase(),
            explanationShownAt: explanationShownAt.current,
            authorisationDate: now.toISOString(),
            taxYearFrom,
            taxYearTo,
          }),
        })
        const json = await resp.json()
        if (!resp.ok && resp.status !== 409) {
          throw new Error(json.error || 'Failed to create donor profile')
        }
        // Profile created — go to MFA setup inline (step 4 becomes MFA)
        setStep(4)
      } else {
        // Email confirmation required — show "check your email" screen
        setStep(4)
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Whether step 4 shows MFA setup or "check email" depends on whether
  // email confirmation is enabled — detected by whether a session exists
  const [hasSessions, setHasSessions] = useState(false)
  useEffect(() => {
    if (step === 4) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setHasSessions(!!session)
      })
    }
  }, [step])

  return (
    <div className="min-h-screen bg-brand-surface flex flex-col">
      <nav className="bg-white border-b border-gray-100 px-8 py-4">
        <Logo />
      </nav>

      <div className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-brand-primary">Register for Gift Aid</h1>
            <p className="text-gray-500 text-sm mt-1">
              Set up once and Gift Aid is handled automatically for every charity you give to.
            </p>
          </div>

          <StepIndicator current={step} total={4} />

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {/* ── STEP 1: Your details ── */}
          {step === 1 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
              <h2 className="font-semibold text-brand-primary">Your details</h2>
              <p className="text-xs text-gray-400">
                HMRC requires your full name and home address for every Gift Aid declaration. A work address or PO Box cannot be used.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">First name <span className="text-red-500">*</span></label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Last name <span className="text-red-500">*</span></label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Email address <span className="text-red-500">*</span></label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Home address <span className="text-red-500">*</span></label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. 14 Chapel Street, Birmingham"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Postcode <span className="text-red-500">*</span></label>
                <input type="text" value={postcode} onChange={e => setPostcode(e.target.value)}
                  placeholder="e.g. B1 1BB"
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Password <span className="text-red-500">*</span></label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
                <p className="text-xs text-gray-400 mt-1">At least 12 characters, including upper, lower, and a number.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Confirm password <span className="text-red-500">*</span></label>
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
                {password && confirmPassword && (
                  <p className={`text-xs mt-1 ${password === confirmPassword ? 'text-green-600' : 'text-red-500'}`}>
                    {password === confirmPassword ? 'Passwords match ✓' : 'Passwords do not match'}
                  </p>
                )}
              </div>
              <button onClick={handleStep1} disabled={loading}
                className="w-full bg-brand-accent text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40 mt-2">
                {loading ? 'Checking…' : 'Continue'}
              </button>
              <p className="text-center text-xs text-gray-400">
                Already registered? <Link to="/login" className="text-brand-accent hover:underline">Log in</Link>
              </p>
            </div>
          )}

          {/* ── STEP 2: Legal explanation ── */}
          {step === 2 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
              <h2 className="font-semibold text-brand-primary">Important information</h2>
              <p className="text-xs text-gray-400">Please read the following carefully before continuing.</p>
              <div className="bg-brand-surface border border-brand-accent/20 rounded-lg p-4 space-y-3 text-sm text-gray-700">
                <p className="font-semibold text-brand-primary">What is Gift Aid?</p>
                <p>Gift Aid lets UK charities claim an extra 25p from HMRC for every £1 you donate — at no cost to you. By registering once with Gift Aided, this happens automatically for every donation you make to charities on our platform.</p>

                <p className="font-semibold text-brand-primary mt-3">Your tax obligation</p>
                <p>You must pay enough UK Income Tax or Capital Gains Tax to cover the Gift Aid claimed on <strong>all</strong> your charitable donations. <strong>If you haven't paid enough tax, HMRC may ask you to pay the difference personally.</strong> If your tax situation changes, cancel your authorisation immediately from your dashboard.</p>

                <p className="font-semibold text-brand-primary mt-3">Your data</p>
                <p>We hold your name, address, and giving history solely to create Gift Aid declarations on your behalf. You'll receive one annual statement each May. We never sell your data. You can cancel at any time.</p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={explanationConfirmed} onChange={e => setExplanationConfirmed(e.target.checked)} className="mt-1" />
                <span className="text-sm text-gray-700">I have read and understood the information above, including my personal tax obligation.</span>
              </label>
              <button onClick={handleStep2}
                className="w-full bg-brand-accent text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90">
                I understand — continue
              </button>
            </div>
          )}

          {/* ── STEP 3: Authorisation ── */}
          {step === 3 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
              <h2 className="font-semibold text-brand-primary">Give authorisation</h2>
              <p className="text-sm text-gray-500">Please tick all three boxes to confirm your authorisation.</p>
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg cursor-pointer hover:bg-brand-surface/50">
                  <input type="checkbox" checked={consentIntermediary} onChange={e => setConsentIntermediary(e.target.checked)} className="mt-1 flex-shrink-0" />
                  <span className="text-sm text-gray-700">
                    I authorise <strong>Gift Aided Ltd</strong> to create Gift Aid declarations on my behalf for donations I make to charities working with Gift Aided.
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg cursor-pointer hover:bg-brand-surface/50">
                  <input type="checkbox" checked={consentTaxpayer} onChange={e => setConsentTaxpayer(e.target.checked)} className="mt-1 flex-shrink-0" />
                  <span className="text-sm text-gray-700">
                    I am a UK taxpayer and have paid (or will pay) enough Income Tax or Capital Gains Tax to cover the Gift Aid claimed on all my charitable donations.
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg cursor-pointer hover:bg-brand-surface/50">
                  <input type="checkbox" checked={consentLiability} onChange={e => setConsentLiability(e.target.checked)} className="mt-1 flex-shrink-0" />
                  <span className="text-sm text-gray-700">
                    I understand that if I don't pay enough tax, HMRC may require me to repay the difference, and I will cancel this authorisation if my tax circumstances change.
                  </span>
                </label>
              </div>
              <button onClick={handleStep3} disabled={loading}
                className="w-full bg-brand-accent text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40">
                {loading ? 'Creating account…' : 'Create my account and give authorisation'}
              </button>
            </div>
          )}

          {/* ── STEP 4: MFA setup or check email ── */}
          {step === 4 && (
            hasSessions ? (
              <MfaSetupInline onDone={() => navigate('/dashboard')} />
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center space-y-5">
                <div className="w-16 h-16 bg-brand-accent/10 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-3xl">✉️</span>
                </div>
                <div>
                  <h2 className="font-bold text-xl text-brand-primary">Check your email</h2>
                  <p className="text-gray-500 text-sm mt-2">
                    We've sent a confirmation link to <strong>{email}</strong>.
                    Click the link in that email to verify your address and continue setting up your account.
                  </p>
                </div>
                <div className="bg-brand-surface rounded-lg p-4 text-sm text-gray-600 text-left space-y-2">
                  <p className="font-semibold text-brand-primary">What happens next:</p>
                  <p>1. Check your inbox (and spam folder) for an email from Gift Aided</p>
                  <p>2. Click the confirmation link in the email</p>
                  <p>3. You'll be taken to set up two-factor authentication</p>
                  <p>4. Then your dashboard will be ready</p>
                </div>
                <p className="text-xs text-gray-400">
                  Didn't receive the email?{' '}
                  <button onClick={handleStep3} className="text-brand-accent hover:underline font-medium">
                    Resend confirmation email
                  </button>
                </p>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

function MfaSetupInline({ onDone }: { onDone: () => void }) {
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Gift Aided Donor Portal',
      })
      if (error || !data) { setError(error?.message || 'Could not start MFA setup.'); return }
      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
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
      onDone()
    } catch {
      setError('Incorrect code — please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      <div className="text-center">
        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <span className="text-green-600 text-lg">✓</span>
        </div>
        <h2 className="font-bold text-brand-primary">Account created!</h2>
        <p className="text-sm text-gray-500 mt-1">Set up two-factor authentication to secure your account.</p>
      </div>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
      {qrCode ? (
        <>
          <p className="text-xs text-gray-400 text-center">Scan with Google Authenticator or Authy.</p>
          <div className="flex justify-center">
            <img src={qrCode} alt="MFA QR code" className="w-40 h-40 border border-gray-100 rounded" />
          </div>
          {secret && (
            <p className="text-center text-xs font-mono bg-gray-50 border border-gray-200 rounded px-2 py-1 select-all break-all">
              {secret}
            </p>
          )}
          <input
            type="text" inputMode="numeric" maxLength={6} placeholder="6-digit code"
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            onKeyDown={e => e.key === 'Enter' && verify()}
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
          />
          <button onClick={verify} disabled={loading || code.length !== 6}
            className="w-full bg-brand-accent text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40">
            {loading ? 'Verifying…' : 'Complete registration'}
          </button>
        </>
      ) : (
        <p className="text-center text-gray-400 text-sm py-4">Setting up two-factor authentication…</p>
      )}
    </div>
  )
}

function getTaxYear(date: Date): string {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate()
  if (m > 4 || (m === 4 && d >= 6)) return `${y}/${String(y + 1).slice(2)}`
  return `${y - 1}/${String(y).slice(2)}`
}
function getNextTaxYear(ty: string): string {
  const startYear = parseInt(ty.split('/')[0], 10) + 1
  return `${startYear}/${String(startYear + 1).slice(2)}`
}
