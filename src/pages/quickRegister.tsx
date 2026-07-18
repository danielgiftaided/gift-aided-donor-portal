/**
 * /quick-register — Micro-registration widget for LaunchGood and other
 * platform partners. Single mobile-first screen, no MFA, no email
 * verification. The donor's Gift Aid authorisation is created immediately
 * so they can return to their donation without delay.
 *
 * URL parameters (passed by LaunchGood):
 *   email        — donor's email (pre-filled, editable)
 *   name         — donor's full name (pre-filled, editable)
 *   campaign_id  — LaunchGood campaign ID (for tracking)
 *   campaign_name — campaign display name (shown to donor for context)
 *   redirect_url  — page to return to after registration
 */

import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, color: '#0c745d', fontSize: '1.3rem', lineHeight: 1 }}>
        gift aided
      </span>
    </div>
  )
}

function GiftAidBadge() {
  return (
    <div className="flex items-center gap-1.5 bg-brand-accent/10 border border-brand-accent/20 rounded-full px-3 py-1">
      <svg className="w-4 h-4 text-brand-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-xs font-semibold text-brand-accent">Gift Aid eligible</span>
    </div>
  )
}

type Phase = 'form' | 'submitting' | 'success' | 'already' | 'error'

export default function QuickRegister() {
  const [params] = useSearchParams()

  // Pre-fill from URL parameters
  const emailParam    = params.get('email') || ''
  const nameParam     = params.get('name') || ''
  const campaignName  = params.get('campaign_name') || ''
  const redirectUrl   = params.get('redirect_url') || ''

  // Split name param into first/last
  const nameParts   = nameParam.trim().split(' ')
  const firstDefault = nameParts[0] || ''
  const lastDefault  = nameParts.slice(1).join(' ') || ''

  const [phase, setPhase] = useState<Phase>('form')
  const [firstName, setFirstName]   = useState(firstDefault)
  const [lastName, setLastName]     = useState(lastDefault)
  const [email, setEmail]           = useState(emailParam)
  const [address, setAddress]       = useState('')
  const [postcode, setPostcode]     = useState('')
  const [consent, setConsent]       = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // After success, redirect back to LaunchGood after a short delay
  useEffect(() => {
    if (phase === 'success' || phase === 'already') {
      const dest = redirectUrl
        ? `${redirectUrl}${redirectUrl.includes('?') ? '&' : '?'}gift_aid=activated`
        : null
      if (dest) {
        const t = setTimeout(() => { window.location.href = dest }, 3000)
        return () => clearTimeout(t)
      }
    }
  }, [phase, redirectUrl])

  const handleSubmit = async () => {
    setError(null)
    if (!firstName.trim()) { setError('Please enter your first name.'); return }
    if (!lastName.trim())  { setError('Please enter your last name.'); return }
    if (!email.trim())     { setError('Please enter your email address.'); return }
    if (!address.trim())   { setError('Please enter your home address.'); return }
    if (!postcode.trim())  { setError('Please enter your postcode.'); return }
    if (!consent) { setError('Please confirm the Gift Aid declaration to continue.'); return }

    setPhase('submitting')

    try {
      const resp = await fetch('/api/platform/quick-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_PLATFORM_API_KEY || '',
        },
        body: JSON.stringify({
          email:        email.trim().toLowerCase(),
          firstName:    firstName.trim(),
          lastName:     lastName.trim(),
          address:      address.trim(),
          postcode:     postcode.trim().toUpperCase(),
          campaignName: campaignName || null,
          campaignId:   params.get('campaign_id') || null,
        }),
      })

      let json: any = {}
      try { json = await resp.json() } catch { /* non-JSON */ }

      if (!resp.ok) throw new Error(json.error || 'Something went wrong — please try again.')

      setPhase(json.alreadyRegistered ? 'already' : 'success')

    } catch (e: any) {
      setError(e.message)
      setPhase('form')
    }
  }

  // ── Success screens ──────────────────────────────────────────────────────

  if (phase === 'success' || phase === 'already') {
    return (
      <div className="min-h-screen bg-brand-surface flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-brand-primary mb-2">
            {phase === 'already' ? 'Gift Aid already active!' : 'Gift Aid activated!'}
          </h1>
          <p className="text-gray-500 text-sm mb-4">
            {phase === 'already'
              ? `Your Gift Aid is already registered, ${firstName}. Your donation will automatically attract Gift Aid.`
              : `Your Gift Aid registration is confirmed, ${firstName}. Your donation and all future donations through connected charities will automatically attract Gift Aid at no cost to you.`
            }
          </p>
          <div className="bg-brand-accent/10 border border-brand-accent/20 rounded-xl p-4 mb-4">
            <p className="text-sm font-semibold text-brand-accent">
              +25% Gift Aid will be added to your donation
            </p>
            <p className="text-xs text-brand-accent/70 mt-1">
              Claimed from HMRC on your behalf by Gift Aided
            </p>
          </div>
          {redirectUrl && (
            <p className="text-xs text-gray-400">
              Taking you back to your donation in a moment…
            </p>
          )}
        </div>
        <div className="mt-6 flex items-center gap-2">
          <Logo />
          <span className="text-xs text-gray-400">· Gift Aid administration</span>
        </div>
      </div>
    )
  }

  // ── Registration form ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-brand-surface flex flex-col">

      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <Logo />
        <GiftAidBadge />
      </div>

      <div className="flex-1 flex flex-col items-center justify-start px-4 py-6">
        <div className="w-full max-w-sm">

          {/* Campaign context — shown when LaunchGood passes a campaign name */}
          {campaignName && (
            <div className="bg-brand-primary/5 border border-brand-primary/10 rounded-xl px-4 py-3 mb-5 text-center">
              <p className="text-xs text-gray-400">You're donating to</p>
              <p className="text-sm font-semibold text-brand-primary mt-0.5">{campaignName}</p>
            </div>
          )}

          {/* Value proposition */}
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-brand-primary leading-tight">
              Boost your donation by 25%
            </h1>
            <p className="text-gray-500 text-sm mt-1.5 leading-relaxed">
              Activate Gift Aid once and HMRC adds 25p for every £1 you donate —
              to this and every future eligible donation. Free for you and the charity.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          {/* Form */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  First name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">
                  Last name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  autoComplete="family-name"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Email address <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Home address <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="e.g. 14 Chapel Street, Birmingham"
                autoComplete="street-address"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
              />
              <p className="text-xs text-gray-400 mt-1">HMRC requires your home address — not a work address or PO Box.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Postcode <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={postcode}
                onChange={e => setPostcode(e.target.value)}
                placeholder="e.g. B1 1BB"
                autoComplete="postal-code"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-accent/30"
              />
            </div>

            {/* Legal declaration — condensed to one checkbox */}
            <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
              <div
                className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 border-2 flex items-center justify-center transition-colors cursor-pointer
                  ${consent ? 'bg-brand-accent border-brand-accent' : 'border-gray-300'}`}
                onClick={() => setConsent(!consent)}
              >
                {consent && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <span className="text-xs text-gray-600 leading-relaxed">
                I am a UK taxpayer and authorise <strong className="text-brand-primary">Gift Aided Ltd</strong> to
                claim Gift Aid on my donations. I understand I must pay enough Income Tax or Capital Gains Tax to
                cover the amount claimed and will cancel this authorisation if my tax status changes.
              </span>
            </label>

            {/* CTA */}
            <button
              onClick={handleSubmit}
              disabled={phase === 'submitting'}
              className="w-full bg-brand-accent text-white rounded-xl py-3.5 text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity mt-1"
            >
              {phase === 'submitting' ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Activating Gift Aid…
                </span>
              ) : 'Activate Gift Aid — free'}
            </button>

          </div>

          {/* Trust signals */}
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-400">
            <span>🔒 Secure</span>
            <span>·</span>
            <span>HMRC recognised</span>
            <span>·</span>
            <span>Cancel any time</span>
          </div>

          {/* Fine print */}
          <p className="text-center text-xs text-gray-400 mt-3 leading-relaxed px-2">
            Gift Aided Ltd holds your name, address and giving history solely to create Gift Aid declarations.
            You'll receive a free annual statement each May. We never sell your data.{' '}
            {redirectUrl && (
              <button
                onClick={() => { window.location.href = redirectUrl }}
                className="text-gray-400 underline hover:text-gray-500"
              >
                No thanks, continue without Gift Aid
              </button>
            )}
          </p>

        </div>
      </div>
    </div>
  )
}
