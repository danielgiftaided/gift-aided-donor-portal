import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface AuthorisationRecord {
  id: string
  authorisationDate: string
  taxYearFrom: string
  taxYearTo: string
  status: string
  cancelledAt: string | null
  source: string
}

function Logo() {
  return (
    <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, color: '#0c745d', fontSize: '1.6rem', lineHeight: 1 }}>
      gift aided <span style={{ fontWeight: 400 }}>Portal</span>
    </span>
  )
}

export default function Authorisation() {
  const navigate = useNavigate()
  const [authorisations, setAuthorisations] = useState<AuthorisationRecord[]>([])
  const [donorStatus, setDonorStatus] = useState<string>('active')
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [reinstating, setReinstating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { navigate('/login'); return }
    const resp = await fetch('/api/donor/me', { headers: { Authorization: `Bearer ${session.access_token}` } })
    const json = await resp.json()
    if (json.ok) {
      setDonorStatus(json.profile.status)
      setAuthorisations(json.profile.authorisations || [])
    }
    setLoading(false)
  }

  const handleCancel = async () => {
    setCancelling(true); setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const resp = await fetch('/api/donor/cancel-authorisation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ reason: 'Cancelled by donor via portal' }),
    })
    const json = await resp.json()
    if (!json.ok) { setError(json.error); setCancelling(false); return }
    setConfirmCancel(false)
    await loadData()
    setCancelling(false)
  }

  return (
    <div className="min-h-screen bg-brand-surface">
      <nav className="bg-white border-b border-gray-100">
        <div className="w-full px-8 py-4 flex justify-between items-center">
          <Logo />
          <div className="flex items-center gap-5">
            <Link to="/dashboard" className="text-sm font-medium text-brand-primary hover:text-brand-accent">Dashboard</Link>
            <Link to="/giving-history" className="text-sm font-medium text-brand-primary hover:text-brand-accent">My Giving</Link>
            <Link to="/authorisation" className="text-sm font-medium text-brand-accent">Authorisation</Link>
            <Link to="/profile" className="text-sm font-medium text-brand-primary hover:text-brand-accent">Profile</Link>
            <button onClick={async () => { await supabase.auth.signOut(); navigate('/login') }}
              className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 pt-10 pb-12 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Gift Aid Authorisation</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your authorisation for Gift Aided to create Gift Aid declarations on your behalf.</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

        {/* Current status */}
        <div className={`rounded-xl p-5 border ${donorStatus === 'active' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`font-semibold ${donorStatus === 'active' ? 'text-green-700' : 'text-red-700'}`}>
                {donorStatus === 'active' ? '✓ Your Gift Aid authorisation is active' : '✗ Your Gift Aid authorisation is cancelled'}
              </p>
              <p className={`text-sm mt-1 ${donorStatus === 'active' ? 'text-green-600' : 'text-red-600'}`}>
                {donorStatus === 'active'
                  ? 'Gift Aid is being applied automatically to your eligible donations. You do not need to do anything.'
                  : 'Gift Aid is not being applied to new donations. Reinstate your authorisation below to resume.'}
              </p>
            </div>
          </div>
        </div>

        {/* What this means */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="font-semibold text-brand-primary">What your authorisation means</h2>
          <p className="text-sm text-gray-600">You have authorised Gift Aided Ltd to create Gift Aid declarations on your behalf for donations you make to charities that work with Gift Aided. This means:</p>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>You don't need to tick a Gift Aid box when donating through connected platforms</li>
            <li>Gift Aid is applied automatically and charities receive 25% extra from HMRC</li>
            <li>You must continue to pay enough UK Income Tax or Capital Gains Tax to cover the Gift Aid claimed across all your donations</li>
            <li>If your tax situation changes, you must cancel your authorisation immediately</li>
          </ul>
        </div>

        {/* Cancel / reinstate */}
        {donorStatus === 'active' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-semibold text-brand-primary mb-2">Cancel your authorisation</h2>
            <p className="text-sm text-gray-500 mb-4">
              Cancel if you have stopped paying UK tax, or if you no longer want Gift Aided to create declarations on your behalf.
              Cancellation stops new declarations from the date of cancellation — it does not affect declarations already made.
            </p>
            {!confirmCancel ? (
              <button onClick={() => setConfirmCancel(true)}
                className="text-sm font-semibold text-red-600 border border-red-200 rounded-lg px-4 py-2 hover:bg-red-50">
                Cancel my Gift Aid authorisation
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                <p className="text-sm font-semibold text-red-700">Are you sure? This will stop Gift Aid being applied to new donations.</p>
                <div className="flex gap-3">
                  <button onClick={handleCancel} disabled={cancelling}
                    className="bg-red-600 text-white text-sm font-semibold rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-40">
                    {cancelling ? 'Cancelling…' : 'Yes, cancel authorisation'}
                  </button>
                  <button onClick={() => setConfirmCancel(false)}
                    className="text-sm text-gray-500 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50">
                    Keep it active
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Authorisation history */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-brand-primary">Authorisation history</h2>
            <p className="text-xs text-gray-400 mt-0.5">Maintained for 6 years as required by the Gift Aid Declarations Regulations 2016.</p>
          </div>
          {loading ? (
            <div className="px-5 py-8 text-center text-gray-300 text-sm">Loading…</div>
          ) : authorisations.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-300 text-sm">No authorisation records found.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {authorisations.map(a => (
                <div key={a.id} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-brand-primary">
                      Tax year{a.taxYearTo !== a.taxYearFrom ? 's' : ''} {a.taxYearFrom}{a.taxYearTo !== a.taxYearFrom ? ` and ${a.taxYearTo}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Authorised {new Date(a.authorisationDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {a.cancelledAt && ` · Cancelled ${new Date(a.cancelledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                    ${a.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {a.status === 'active' ? 'Active' : 'Cancelled'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
