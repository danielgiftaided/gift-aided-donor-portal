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

// Step indicator shown at the top of the wizard
function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ['Your details', 'Important information', 'Authorisation', 'Two-factor setup']
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

  // Step 2 — the legal explanation timestamp is captured when
  // the step renders, not when the user clicks "I understand".
  // Storing it in a ref (not state) so it isn't affected by re-renders.
  const explanationShownAt = useRef<string | null>(null)
  const [explanationConfirmed, setExplanationConfirmed] = useState(false)

  // Step 3 — three separate consents for absolute clarity
  const [consentIntermediary, setConsentIntermediary] = useState(false)
  const [consentTaxpayer, setConsentTaxpayer] = useState(false)
  const [consentLiability, setConsentLiability] = useState(false)

  useEffect(() => {
    if (step === 2 && !explanationShownAt.current) {
      explanationShownAt.current = new Date().toISOString()
    }
  }, [step])

  // ── Step 1 validation and Supabase signup ──────────────────
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

  // ── Step 2 — legal explanation confirmed ──────────────────
  const handleStep2 = () => {
    if (!explanationConfirmed) {
      setError('Please confirm you have read and understood the information above.')
      return
    }
    setError(null)
    setStep(3)
  }

  // ── Step 3 — authorisation granted, create account ────────
  const handleStep3 = async () => {
    setError(null)
    if (!consentIntermediary || !consentTaxpayer || !consentLiability) {
      setError('Please tick all three boxes to continue.')
      return
    }
    setLoading(true)
    try {
      // Create the Supabase auth user
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })
      if (authErr) throw authErr
      if (!authData.user) throw new Error('Account creation failed — please try again.')

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Could not get session after signup.')

      // Create the donor profile and authorisation records
      const now = new Date()
      const taxYearFrom = getTaxYear(now)
      const taxYearTo = now.getMonth() >= 2 // March = index 2
        ? getNextTaxYear(taxYearFrom)
        : taxYearFrom

      const resp = await fetch('/api/donor/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
      if (!resp.ok || !json.ok) throw new Error(json.error || 'Failed to create donor profile.')

      setStep(4)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // ── Step 4 — MFA setup complete ───────────────────────────
  const handleMfaDone = () => { navigate('/dashboard') }

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
                <p className="font-semibold text-brand-primary">What Gift Aid is</p>
                <p>Gift Aid allows UK charities to reclaim the basic rate of Income Tax on your donations. For every £1 you give, the charity receives an extra 25p from HMRC — at no cost to you.</p>

                <p className="font-semibold text-brand-primary mt-3">What you are authorising</p>
                <p>By registering with Gift Aided, you are authorising <strong>Gift Aided Ltd</strong> to create Gift Aid declarations on your behalf for donations you make to charities that work with Gift Aided. This means Gift Aid will be applied automatically — you do not need to tick a box or fill in a form each time you donate.</p>

                <p className="font-semibold text-brand-primary mt-3">Your tax obligation — please read this carefully</p>
                <p>To use Gift Aid, you must have paid enough UK Income Tax or Capital Gains Tax in the current tax year to cover the amount of Gift Aid claimed across <strong>all</strong> your charitable donations — not just those through Gift Aided.</p>
                <p className="font-semibold">If you have not paid enough tax to cover the Gift Aid amount, HMRC may ask you to personally pay the difference. This is your responsibility, not the charity's.</p>
                <p>If your tax situation changes at any time — for example, if you stop paying UK tax — you must cancel your Gift Aid authorisation immediately. You can do this at any time from your account dashboard.</p>

                <p className="font-semibold text-brand-primary mt-3">Your data</p>
                <p>Gift Aided will hold your name, address, and giving history to create declarations on your behalf. We will send you one annual statement each May summarising what was claimed. We will never sell your data or use it for any purpose other than Gift Aid administration.</p>

                <p className="font-semibold text-brand-primary mt-3">Cancelling at any time</p>
                <p>You can cancel your Gift Aid authorisation at any time from your dashboard. Cancellation stops any new declarations being created from that date — it does not affect declarations already made for past donations.</p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={explanationConfirmed} onChange={e => setExplanationConfirmed(e.target.checked)} className="mt-1" />
                <span className="text-sm text-gray-700">I have read and understood the information above, including my personal tax obligation regarding Gift Aid.</span>
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
              <p className="text-sm text-gray-500">
                Please tick all three boxes to confirm your authorisation. This is the legal basis on which Gift Aided creates Gift Aid declarations on your behalf.
              </p>

              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg cursor-pointer hover:bg-brand-surface/50">
                  <input type="checkbox" checked={consentIntermediary} onChange={e => setConsentIntermediary(e.target.checked)} className="mt-1 flex-shrink-0" />
                  <span className="text-sm text-gray-700">
                    I authorise <strong>Gift Aided Ltd</strong> to create Gift Aid declarations on my behalf for donations I make to charities that work with Gift Aided.
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg cursor-pointer hover:bg-brand-surface/50">
                  <input type="checkbox" checked={consentTaxpayer} onChange={e => setConsentTaxpayer(e.target.checked)} className="mt-1 flex-shrink-0" />
                  <span className="text-sm text-gray-700">
                    I confirm that I am a UK taxpayer and have paid (or will pay) enough UK Income Tax or Capital Gains Tax to cover the Gift Aid claimed on all my charitable donations.
                  </span>
                </label>

                <label className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg cursor-pointer hover:bg-brand-surface/50">
                  <input type="checkbox" checked={consentLiability} onChange={e => setConsentLiability(e.target.checked)} className="mt-1 flex-shrink-0" />
                  <span className="text-sm text-gray-700">
                    I understand that if I do not pay enough tax, HMRC may require me to personally repay the difference, and that I must cancel my Gift Aid authorisation if my tax circumstances change.
                  </span>
                </label>
              </div>

              <button onClick={handleStep3} disabled={loading}
                className="w-full bg-brand-accent text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40">
                {loading ? 'Creating account…' : 'Create my account and give authorisation'}
              </button>
            </div>
          )}

          {/* ── STEP 4: MFA setup ── */}
          {step === 4 && (
            <MfaSetupInline onDone={handleMfaDone} />
          )}
        </div>
      </div>
    </div>
  )
}

// Inline MFA setup component — uses Supabase TOTP enrolment
function MfaSetupInline({ onDone }: { onDone: () => void }) {
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
      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
      setSecret(data.totp.secret)
    })()
  }, [])

  const verify = async () => {
    if (!factorId || code.length !== 6) return
    setLoading(true); setError(null)
    try {
      const { data: challengeData, error: challengeErr } = await supabase.auth.mfa.challenge({ factorId })
      if (challengeErr) throw challengeErr
      const { error: verifyErr } = await supabase.auth.mfa.verify({ factorId, challengeId: challengeData.id, code })
      if (verifyErr) throw verifyErr
      onDone()
    } catch (e: any) {
      setError('Incorrect code — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
      <h2 className="font-semibold text-brand-primary">Set up two-factor authentication</h2>
      <p className="text-sm text-gray-500">
        Your account holds sensitive tax information. Two-factor authentication is required to keep it secure.
      </p>
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
      {qrCode ? (
        <>
          <p className="text-xs text-gray-400">Scan this QR code with an authenticator app such as Google Authenticator or Authy.</p>
          <div className="flex justify-center">
            <img src={qrCode} alt="MFA QR code" className="w-40 h-40 border border-gray-100 rounded" />
          </div>
          {secret && (
            <div className="text-center">
              <p className="text-xs text-gray-400 mb-1">Or enter this code manually:</p>
              <code className="text-xs font-mono bg-gray-50 px-2 py-1 rounded border border-gray-200 select-all">{secret}</code>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Enter the 6-digit code from your app</label>
            <input type="text" inputMode="numeric" maxLength={6}
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm font-mono text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
          </div>
          <button onClick={verify} disabled={loading || code.length !== 6}
            className="w-full bg-brand-accent text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40">
            {loading ? 'Verifying…' : 'Complete registration'}
          </button>
        </>
      ) : (
        <p className="text-center text-gray-400 text-sm py-6">Setting up two-factor authentication…</p>
      )}
    </div>
  )
}

// ── Tax year helpers ───────────────────────────────────────
function getTaxYear(date: Date): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  if (m > 4 || (m === 4 && d >= 6)) return `${y}/${String(y + 1).slice(2)}`
  return `${y - 1}/${String(y).slice(2)}`
}
function getNextTaxYear(ty: string): string {
  const startYear = parseInt(ty.split('/')[0], 10)
  const next = startYear + 1
  return `${next}/${String(next + 1).slice(2)}`
}
