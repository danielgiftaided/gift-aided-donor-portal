import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import DonorLayout from '../components/DonorLayout'

interface AuthRecord { id: string; authorisationDate: string; taxYearFrom: string; taxYearTo: string; status: string; cancelledAt: string | null; source: string }

export default function Authorisation() {
  const navigate = useNavigate()
  const [authorisations, setAuthorisations] = useState<AuthRecord[]>([])
  const [donorStatus, setDonorStatus] = useState('active')
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { navigate('/login'); return }
    const resp = await fetch('/api/donor/me', { headers: { Authorization: `Bearer ${session.access_token}` } })
    const json = await resp.json()
    if (json.ok) { setDonorStatus(json.profile.status); setAuthorisations(json.profile.authorisations || []) }
    setLoading(false)
  }

  const handleCancel = async () => {
    setCancelling(true); setError(null)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const resp = await fetch('/api/donor/cancel-authorisation', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ reason: 'Cancelled by donor' }),
    })
    const json = await resp.json()
    if (!json.ok) { setError(json.error); setCancelling(false); return }
    setConfirmCancel(false); await load(); setCancelling(false)
  }

  return (
    <DonorLayout active="authorisation">
      <div className="max-w-lg mx-auto px-4 pt-6 pb-6 space-y-4">

        <div>
          <h1 className="text-xl font-bold text-brand-primary">Gift Aid Authorisation</h1>
          <p className="text-xs text-gray-400 mt-0.5">Manage your authorisation for Gift Aided to create Gift Aid declarations on your behalf.</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

        {/* Status card */}
        <div className={`rounded-xl p-4 border ${donorStatus === 'active' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className={`font-semibold text-sm ${donorStatus === 'active' ? 'text-green-700' : 'text-red-700'}`}>
            {donorStatus === 'active' ? '✓ Gift Aid authorisation is active' : '✗ Authorisation cancelled'}
          </p>
          <p className={`text-xs mt-1 leading-relaxed ${donorStatus === 'active' ? 'text-green-600' : 'text-red-600'}`}>
            {donorStatus === 'active'
              ? 'Gift Aid is applied automatically to your eligible donations. You do not need to do anything.'
              : 'Gift Aid is not being applied. Re-register to reinstate your authorisation.'}
          </p>
        </div>

        {/* What this means */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-2">
          <h2 className="font-semibold text-brand-primary text-sm">What your authorisation covers</h2>
          <ul className="text-xs text-gray-600 space-y-1.5">
            {[
              'No Gift Aid tick box needed when donating through connected platforms',
              'Charities automatically receive 25% extra from HMRC on eligible donations',
              'You must continue to pay enough UK Income Tax or Capital Gains Tax',
              'If your tax situation changes, cancel your authorisation immediately',
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-brand-accent mt-0.5 flex-shrink-0">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Cancel section */}
        {donorStatus === 'active' && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
            <h2 className="font-semibold text-brand-primary text-sm">Cancel your authorisation</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Cancel if you have stopped paying UK tax or no longer want Gift Aided to create declarations on your behalf.
              This affects future donations only — past claims remain valid.
            </p>
            {!confirmCancel ? (
              <button onClick={() => setConfirmCancel(true)}
                className="text-sm font-semibold text-red-600 border border-red-200 rounded-lg px-4 py-2 hover:bg-red-50 w-full">
                Cancel my Gift Aid authorisation
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-3">
                <p className="text-xs font-semibold text-red-700">Are you sure? Gift Aid will stop on new donations.</p>
                <div className="flex gap-2">
                  <button onClick={handleCancel} disabled={cancelling}
                    className="flex-1 bg-red-600 text-white text-sm font-semibold rounded-lg py-2 hover:opacity-90 disabled:opacity-40">
                    {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                  </button>
                  <button onClick={() => setConfirmCancel(false)}
                    className="flex-1 text-sm border border-gray-200 rounded-lg py-2 text-gray-500 hover:bg-gray-50">
                    Keep active
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* History */}
        {!loading && authorisations.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <h2 className="font-semibold text-brand-primary text-sm">Authorisation history</h2>
              <p className="text-xs text-gray-400 mt-0.5">Retained for 6 years per the Gift Aid Declarations Regulations 2016.</p>
            </div>
            <div className="divide-y divide-gray-50">
              {authorisations.map(a => (
                <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-brand-primary">
                      {a.taxYearFrom}{a.taxYearTo !== a.taxYearFrom ? ` & ${a.taxYearTo}` : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(a.authorisationDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {a.cancelledAt && ` · Cancelled ${new Date(a.cancelledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${a.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {a.status === 'active' ? 'Active' : 'Cancelled'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DonorLayout>
  )
}
