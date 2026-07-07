import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Logo() {
  return (
    <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, color: '#0c745d', fontSize: '1.6rem', lineHeight: 1 }}>
      gift aided <span style={{ fontWeight: 400 }}>Portal</span>
    </span>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [address, setAddress] = useState('')
  const [postcode, setPostcode] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/login'); return }
      const resp = await fetch('/api/donor/me', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const json = await resp.json()
      if (json.ok) {
        setFirstName(json.profile.firstName || '')
        setLastName(json.profile.lastName || '')
        setAddress(json.profile.address || '')
        setPostcode(json.profile.postcode || '')
        setEmail(json.profile.email || '')
      }
      setLoading(false)
    })()
  }, [])

  const handleSave = async () => {
    setError(null); setSuccess(false)
    if (!firstName.trim() || !lastName.trim() || !address.trim() || !postcode.trim()) {
      setError('All fields are required.'); return
    }
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { navigate('/login'); return }
    const resp = await fetch('/api/donor/update-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), address: address.trim(), postcode: postcode.trim().toUpperCase() }),
    })
    const json = await resp.json()
    if (!json.ok) { setError(json.error); setSaving(false); return }
    setSuccess(true); setSaving(false)
  }

  return (
    <div className="min-h-screen bg-brand-surface">
      <nav className="bg-white border-b border-gray-100">
        <div className="w-full px-8 py-4 flex justify-between items-center">
          <Logo />
          <div className="flex items-center gap-5">
            <Link to="/dashboard" className="text-sm font-medium text-brand-primary hover:text-brand-accent">Dashboard</Link>
            <Link to="/giving-history" className="text-sm font-medium text-brand-primary hover:text-brand-accent">My Giving</Link>
            <Link to="/authorisation" className="text-sm font-medium text-brand-primary hover:text-brand-accent">Authorisation</Link>
            <Link to="/profile" className="text-sm font-medium text-brand-accent">Profile</Link>
            <button onClick={async () => { await supabase.auth.signOut(); navigate('/login') }}
              className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
          </div>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-6 pt-10 pb-12 space-y-6">
        <h1 className="text-2xl font-bold text-brand-primary">Your Profile</h1>
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          Keep your home address and postcode up to date — HMRC uses these details to validate Gift Aid declarations.
          If you move house, update your address here straight away.
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
        {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">Profile updated successfully.</div>}

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          {loading ? (
            <p className="text-gray-300 text-sm">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">First name</label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Last name</label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)}
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Email address</label>
                <input type="email" value={email} disabled
                  className="w-full border border-gray-100 bg-gray-50 rounded px-3 py-2 text-sm text-gray-400 cursor-not-allowed" />
                <p className="text-xs text-gray-400 mt-1">Email cannot be changed here. Contact support if needed.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Home address</label>
                <input type="text" value={address} onChange={e => setAddress(e.target.value)}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Postcode</label>
                <input type="text" value={postcode} onChange={e => setPostcode(e.target.value)}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
              </div>
              <button onClick={handleSave} disabled={saving}
                className="w-full bg-brand-accent text-white rounded-lg py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-40">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold text-brand-primary mb-2">Change password</h2>
          <p className="text-sm text-gray-500 mb-3">For security, password changes require a reset link sent to your email.</p>
          <button onClick={async () => {
            if (email) await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
            alert('Reset link sent to your email address.')
          }} className="text-sm font-semibold text-brand-accent border border-brand-accent/30 rounded-lg px-4 py-2 hover:bg-brand-accent/5">
            Send password reset link
          </button>
        </div>
      </div>
    </div>
  )
}
