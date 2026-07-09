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

      // Store all profile data in Supabase user metadata so it can be
      // retrieved after email confirmation without needing a session now.
      const { error: signUpErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Profile data stored in metadata — read by /api/donor/register
          // after the donor confirms their email and a session is established.
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
          // After clicking the email link, donor lands on MFA setup
          // where the profile is created and MFA is configured.
          emailRedirectTo: `https://donors.giftaided.com',
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

      // Move to "check your email" step — no session yet, that comes
      // after the donor clicks the confirmation link.
      setStep(4)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

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
                <p className="font-semibold text-brand-primary">What Gift Aid is</p>
                <p>Gift Aid allows UK charities to reclaim the basic rate of Income Tax on your donations. For every £1 you give, the charity receives an extra 25p from HMRC — at no cost to you.</p>
                <p className="font-semibold text-brand-primary mt-3">What you are authorising</p>
                <p>By registering with Gift Aided, you are authorising <strong>Gift Aided Ltd</strong> to create Gift Aid declarations on your behalf for donations you make to charities that work with Gift Aided.</p>
                <p className="font-semibold text-brand-primary mt-3">Your tax obligation — please read carefully</p>
                <p>You must have paid enough UK Income Tax or Capital Gains Tax in the current tax year to cover the amount of Gift Aid claimed across <strong>all</strong> your charitable donations.</p>
                <p className="font-semibold">If you have not paid enough tax, HMRC may ask you to personally pay the difference.</p>
                <p>If your tax situation changes, you must cancel your Gift Aid authorisation immediately from your account dashboard.</p>
                <p className="font-semibold text-brand-primary mt-3">Your data</p>
                <p>Gift Aided will hold your name, address, and giving history to create declarations on your behalf. We will send you one annual statement each May. We will never sell your data.</p>
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
                  <span className="text-sm text-gray-700">I authorise <strong>Gift Aided Ltd</strong> to create Gift Aid declarations on my behalf for donations I make to charities that work with Gift Aided.</span>
                </label>
                <label className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg cursor-pointer hover:bg-brand-surface/50">
                  <input type="checkbox" checked={consentTaxpayer} onChange={e => setConsentTaxpayer(e.target.checked)} className="mt-1 flex-shrink-0" />
                  <span className="text-sm text-gray-700">I confirm that I am a UK taxpayer and have paid (or will pay) enough UK Income Tax or Capital Gains Tax to cover the Gift Aid claimed on all my charitable donations.</span>
                </label>
                <label className="flex items-start gap-3 p-3 border border-gray-100 rounded-lg cursor-pointer hover:bg-brand-surface/50">
                  <input type="checkbox" checked={consentLiability} onChange={e => setConsentLiability(e.target.checked)} className="mt-1 flex-shrink-0" />
                  <span className="text-sm text-gray-700">I understand that if I do not pay enough tax, HMRC may require me to personally repay the difference, and that I must cancel my authorisation if my tax circumstances change.</span>
                </label>
              </div>
              <button onClick={handleStep3} disabled={loading}
                className="w-full bg-brand-accent text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40">
                {loading ? 'Creating account…' : 'Create my account and give authorisation'}
              </button>
            </div>
          )}

          {/* ── STEP 4: Check your email ── */}
          {step === 4 && (
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
          )}
        </div>
      </div>
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