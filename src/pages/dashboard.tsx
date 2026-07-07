import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface DonorProfile {
  firstName: string
  lastName: string
  status: string
  authorisationDate: string | null
  taxYearFrom: string | null
  taxYearTo: string | null
  totalDonations: number
  totalGiftAid: number
  currentTaxYearGiftAid: number
  recentDonations: RecentDonation[]
}

interface RecentDonation {
  id: string
  charityName: string | null
  charityHmrcRef: string
  amount: number
  donationDate: string
  giftAidStatus: string
  giftAid: number
}

function Logo() {
  return (
    <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, color: '#0c745d', fontSize: '1.6rem', lineHeight: 1 }}>
      gift aided <span style={{ fontWeight: 400 }}>Portal</span>
    </span>
  )
}

function Nav({ donorName }: { donorName: string }) {
  const navigate = useNavigate()
  return (
    <nav className="bg-white border-b border-gray-100">
      <div className="w-full px-8 py-4 flex justify-between items-center">
        <Logo />
        <div className="flex items-center gap-5">
          <Link to="/giving-history" className="text-sm font-medium text-brand-primary hover:text-brand-accent transition-colors">My Giving</Link>
          <Link to="/authorisation" className="text-sm font-medium text-brand-primary hover:text-brand-accent transition-colors">Authorisation</Link>
          <Link to="/profile" className="text-sm font-medium text-brand-primary hover:text-brand-accent transition-colors">Profile</Link>
          <button onClick={async () => { await supabase.auth.signOut(); navigate('/login') }}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Sign out</button>
        </div>
      </div>
    </nav>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold px-3 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
      Gift Aid active
    </span>
  )
  return (
    <span className="bg-red-100 text-red-700 text-xs font-semibold px-3 py-1 rounded-full">
      Authorisation cancelled
    </span>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<DonorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadProfile() }, [])

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/login'); return }

      const resp = await fetch('/api/donor/me', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await resp.json()
      if (!resp.ok || !json.ok) {
        if (resp.status === 404) { navigate('/register'); return }
        throw new Error(json.error || 'Failed to load profile')
      }
      setProfile(json.profile)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const fmt = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`

  if (loading) return (
    <div className="min-h-screen bg-brand-surface flex items-center justify-center">
      <p className="text-brand-accent font-medium">Loading your account…</p>
    </div>
  )

  const donorName = profile ? `${profile.firstName} ${profile.lastName}` : ''

  return (
    <div className="min-h-screen bg-brand-surface">
      <Nav donorName={donorName} />

      <div className="max-w-4xl mx-auto px-6 pt-12 pb-12">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">{error}</div>}

        {profile && (
          <>
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-brand-primary">
                  Welcome back, <span className="text-brand-accent">{profile.firstName}</span>
                </h1>
                <StatusBadge status={profile.status} />
              </div>
              {profile.status === 'active' && profile.taxYearFrom && (
                <p className="text-gray-400 text-sm">
                  Your Gift Aid authorisation covers donations made in {profile.taxYearFrom}
                  {profile.taxYearTo && profile.taxYearTo !== profile.taxYearFrom ? ` and ${profile.taxYearTo}` : ''}.
                  Gift Aid is applied automatically — you don't need to do anything.
                </p>
              )}
              {profile.status === 'cancelled' && (
                <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-lg text-sm">
                  Your Gift Aid authorisation is cancelled. New donations will not attract Gift Aid.{' '}
                  <Link to="/authorisation" className="font-semibold hover:underline">Reinstate authorisation →</Link>
                </div>
              )}
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Total Gift Aid Generated', value: fmt(profile.totalGiftAid), color: 'text-brand-accent', accent: true },
                { label: 'This Tax Year', value: fmt(profile.currentTaxYearGiftAid), color: 'text-brand-primary', accent: false },
                { label: 'Donations Covered', value: String(profile.totalDonations), color: 'text-brand-primary', accent: false },
              ].map(c => (
                <div key={c.label} className={`bg-white rounded-xl border-gray-100 shadow-sm p-5 ${c.accent ? 'border-l-4 border-brand-accent border-t border-r border-b' : 'border border-gray-100'}`}>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{c.label}</div>
                  <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
                </div>
              ))}
            </div>

            {/* Higher rate prompt */}
            <div className="bg-brand-primary/5 border border-brand-primary/10 rounded-xl p-4 mb-8">
              <p className="text-sm font-semibold text-brand-primary mb-1">Are you a higher-rate taxpayer?</p>
              <p className="text-xs text-gray-500">
                If you pay 40% or 45% Income Tax, you can personally claim additional tax relief on top of the Gift Aid your charities receive — typically worth 25p extra for every £1 you donate. This must be claimed through Self Assessment or by contacting HMRC directly.
              </p>
              <a href="https://www.gov.uk/donating-to-charity/gift-aid" target="_blank" rel="noopener noreferrer"
                className="text-xs font-semibold text-brand-accent hover:underline mt-2 inline-block">
                Learn how to claim higher-rate relief →
              </a>
            </div>

            {/* Recent donations */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                <h2 className="font-semibold text-brand-primary">Recent Gift Aid Activity</h2>
                <Link to="/giving-history" className="text-xs font-semibold text-brand-accent hover:underline">View all →</Link>
              </div>
              {profile.recentDonations.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <p className="text-gray-300 text-sm">No Gift Aid activity yet.</p>
                  <p className="text-xs text-gray-300 mt-1">
                    Donations made through connected charities and platforms will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-50">
                    <thead>
                      <tr className="bg-gray-50/50">
                        {['Charity', 'Donation', 'Gift Aid', 'Date', 'Status'].map(h => (
                          <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {profile.recentDonations.map(d => (
                        <tr key={d.id} className="hover:bg-brand-surface/50">
                          <td className="px-6 py-3 text-sm text-brand-primary font-medium">{d.charityName || d.charityHmrcRef}</td>
                          <td className="px-6 py-3 text-sm text-gray-600">{fmt(d.amount)}</td>
                          <td className="px-6 py-3 text-sm font-semibold text-brand-accent">{fmt(d.giftAid)}</td>
                          <td className="px-6 py-3 text-sm text-gray-400">
                            {new Date(d.donationDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </td>
                          <td className="px-6 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                              ${d.giftAidStatus === 'matched' ? 'bg-green-100 text-green-700' :
                                d.giftAidStatus === 'no_match' ? 'bg-gray-100 text-gray-500' :
                                'bg-amber-100 text-amber-700'}`}>
                              {d.giftAidStatus === 'matched' ? 'Gift Aid applied' :
                               d.giftAidStatus === 'no_match' ? 'No match' : 'Pending'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
