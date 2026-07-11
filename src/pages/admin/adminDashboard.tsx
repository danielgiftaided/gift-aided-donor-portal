import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AdminLayout from './AdminLayout'

interface Insights {
  totalDonors: number; activeDonors: number; newDonors: number
  totalDonations: number; matchedDonations: number; unmatchedDonations: number
  matchRate: number; totalGiftAid: number
  charityBreakdown: { name: string; donations: number; giftAid: number }[]
}

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [insights, setInsights] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/admin/login'); return }
      const resp = await fetch('/api/admin/insights', { headers: { Authorization: `Bearer ${session.access_token}` } })
      if (resp.status === 403) { navigate('/admin/login'); return }
      const json = await resp.json()
      if (!json.ok) throw new Error(json.error)
      setInsights(json)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const fmt = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-brand-primary">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Donor portal overview</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-6">{error}</div>}

        {loading ? (
          <div className="text-center text-gray-300 py-20">Loading…</div>
        ) : insights && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total Donors', value: String(insights.totalDonors), sub: `${insights.newDonors} new this month` },
                { label: 'Active Authorisations', value: String(insights.activeDonors), sub: `${insights.totalDonors - insights.activeDonors} cancelled` },
                { label: 'Total Gift Aid', value: fmt(insights.totalGiftAid), sub: `${insights.matchedDonations} matched donations` },
                { label: 'Match Rate', value: `${insights.matchRate}%`, sub: `${insights.unmatchedDonations} unmatched` },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl border-l-4 border-brand-accent border-t border-r border-b border-gray-100 shadow-sm p-5">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{c.label}</div>
                  <div className="text-2xl font-bold text-brand-primary">{c.value}</div>
                  <div className="text-xs text-gray-400 mt-1">{c.sub}</div>
                </div>
              ))}
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Review unmatched donations', desc: `${insights.unmatchedDonations} need attention`, path: '/admin/matching', colour: 'bg-amber-50 border-amber-200 text-amber-700' },
                { label: 'View all donors', desc: `${insights.totalDonors} registered`, path: '/admin/donors', colour: 'bg-blue-50 border-blue-200 text-blue-700' },
                { label: 'View all donations', desc: `${insights.totalDonations} total`, path: '/admin/donations', colour: 'bg-green-50 border-green-200 text-green-700' },
              ].map(a => (
                <button key={a.path} onClick={() => navigate(a.path)}
                  className={`text-left p-4 rounded-xl border ${a.colour} hover:opacity-80 transition-opacity`}>
                  <p className="font-semibold text-sm">{a.label}</p>
                  <p className="text-xs mt-0.5 opacity-75">{a.desc}</p>
                </button>
              ))}
            </div>

            {/* Charity breakdown */}
            {insights.charityBreakdown.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-50">
                  <h2 className="font-semibold text-brand-primary">Gift Aid by Charity</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-50">
                    <thead>
                      <tr className="bg-gray-50/50">
                        {['Charity', 'Donations', 'Gift Aid Generated'].map(h => (
                          <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {insights.charityBreakdown.map(c => (
                        <tr key={c.name} className="hover:bg-brand-surface/40">
                          <td className="px-6 py-3 text-sm font-medium text-brand-primary">{c.name}</td>
                          <td className="px-6 py-3 text-sm text-gray-500">{c.donations}</td>
                          <td className="px-6 py-3 text-sm font-bold text-brand-accent">{fmt(c.giftAid)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  )
}
