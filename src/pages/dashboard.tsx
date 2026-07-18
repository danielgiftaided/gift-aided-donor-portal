import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import DonorLayout from '../components/DonorLayout'

interface DonorProfile {
  firstName: string; lastName: string; status: string
  authorisationDate: string | null; taxYearFrom: string | null; taxYearTo: string | null
  totalDonations: number; totalGiftAid: number; currentTaxYearGiftAid: number
  recentDonations: RecentDonation[]
}
interface RecentDonation {
  id: string; charityName: string | null; charityHmrcRef: string
  amount: number; donationDate: string; giftAidStatus: string; giftAid: number
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm p-4 ${accent ? 'border-l-4 border-brand-accent border-t border-r border-b border-gray-100' : 'border border-gray-100'}`}>
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 leading-tight">{label}</div>
      <div className={`text-xl font-bold ${accent ? 'text-brand-accent' : 'text-brand-primary'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-700 text-xs font-semibold px-2.5 py-1 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Gift Aid active
    </span>
  )
  return <span className="bg-red-100 text-red-700 text-xs font-semibold px-2.5 py-1 rounded-full">Authorisation cancelled</span>
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<DonorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/login'); return }
      const resp = await fetch('/api/donor/me', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const json = await resp.json()
      if (!resp.ok) { if (resp.status === 404) { navigate('/register'); return } throw new Error(json.error) }
      setProfile(json.profile)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const fmt = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`

  if (loading) return (
    <DonorLayout active="dashboard">
      <div className="flex items-center justify-center h-64">
        <p className="text-brand-accent font-medium text-sm">Loading…</p>
      </div>
    </DonorLayout>
  )

  return (
    <DonorLayout active="dashboard">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-6 space-y-5">

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

        {profile && (
          <>
            {/* Header */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-brand-primary">
                  Welcome, <span className="text-brand-accent">{profile.firstName}</span>
                </h1>
                <StatusBadge status={profile.status} />
              </div>
              {profile.status === 'active' && profile.taxYearFrom && (
                <p className="text-xs text-gray-400">
                  Gift Aid active for {profile.taxYearFrom}
                  {profile.taxYearTo && profile.taxYearTo !== profile.taxYearFrom ? ` & ${profile.taxYearTo}` : ''}.
                  Applied automatically to every eligible donation.
                </p>
              )}
              {profile.status === 'cancelled' && (
                <div className="mt-2 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg text-xs">
                  Gift Aid is paused.{' '}
                  <Link to="/authorisation" className="font-semibold underline">Reinstate →</Link>
                </div>
              )}
            </div>

            {/* Stat cards — 2 columns on mobile, 3 on desktop */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatCard label="Total Gift Aid" value={fmt(profile.totalGiftAid)} accent />
              <StatCard label="This Tax Year"  value={fmt(profile.currentTaxYearGiftAid)} />
              <StatCard label="Donations Covered" value={String(profile.totalDonations)} />
            </div>

            {/* Higher-rate prompt */}
            <div className="bg-brand-primary/5 border border-brand-primary/10 rounded-xl p-4">
              <p className="text-sm font-semibold text-brand-primary mb-1">Higher-rate taxpayer?</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                If you pay 40% or 45% tax, you can personally claim extra relief on your donations through Self Assessment — typically worth 25p per £1 on top of what your charities already receive.
              </p>
              <a href="https://www.gov.uk/donating-to-charity/gift-aid" target="_blank" rel="noopener noreferrer"
                className="text-xs font-semibold text-brand-accent hover:underline mt-2 inline-block">
                How to claim →
              </a>
            </div>

            {/* Recent donations */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <h2 className="font-semibold text-brand-primary text-sm">Recent Activity</h2>
                <Link to="/giving-history" className="text-xs font-semibold text-brand-accent">View all →</Link>
              </div>
              {profile.recentDonations.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-gray-300 text-sm">No activity yet.</p>
                  <p className="text-xs text-gray-300 mt-1">Donations through connected charities appear here automatically.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {profile.recentDonations.map(d => (
                    <div key={d.id} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-brand-primary truncate">{d.charityName || d.charityHmrcRef}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(d.donationDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm text-gray-600">{fmt(d.amount)}</p>
                        {d.giftAidStatus === 'matched' ? (
                          <p className="text-xs font-semibold text-brand-accent">+{fmt(d.giftAid)} Gift Aid</p>
                        ) : (
                          <p className="text-xs text-gray-400">Pending</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </DonorLayout>
  )
}
