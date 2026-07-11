import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AdminLayout from './AdminLayout'

interface Donation {
  id: string; charity_name: string | null; charity_hmrc_ref: string
  donor_name_submitted: string; donor_postcode_submitted: string
  amount: number; donation_date: string; gift_aid_status: string
  giftAid: number; matchedDonor: { first_name: string; last_name: string; postcode: string } | null
  received_at: string
}

const PAGE_SIZE = 25

const statusColour = (s: string) => {
  if (s === 'matched') return 'bg-green-100 text-green-700'
  if (s === 'no_match') return 'bg-red-100 text-red-700'
  if (s === 'ineligible') return 'bg-gray-100 text-gray-500'
  return 'bg-amber-100 text-amber-700'
}

const statusLabel = (s: string) => {
  if (s === 'matched') return 'Gift Aid applied'
  if (s === 'no_match') return 'No match'
  if (s === 'ineligible') return 'Ineligible'
  return 'Pending'
}

export default function AdminDonations() {
  const navigate = useNavigate()
  const [donations, setDonations] = useState<Donation[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadData() }, [page, status])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/admin/login'); return }
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE), status })
      const resp = await fetch(`/api/admin/listDonations?${params}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      const json = await resp.json()
      if (!json.ok) throw new Error(json.error)
      setDonations(json.donations); setTotal(json.total)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const fmt = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-12">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-brand-primary">Platform Donations</h1>
            <p className="text-gray-400 text-sm mt-1">{total} donations received via API</p>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

        <div className="flex gap-2 mb-4">
          {(['all', 'pending', 'matched', 'no_match'] as const).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(0) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${status === s ? 'bg-brand-accent text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {s === 'all' ? 'All' : s === 'no_match' ? 'No match' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-50">
              <thead>
                <tr className="bg-gray-50/50">
                  {['Charity', 'Donor submitted', 'Amount', 'Gift Aid', 'Date', 'Status', 'Matched to'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-300">Loading…</td></tr>
                ) : donations.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-300">No donations found</td></tr>
                ) : donations.map(d => (
                  <tr key={d.id} className="hover:bg-brand-surface/40">
                    <td className="px-4 py-3 text-sm font-medium text-brand-primary whitespace-nowrap">{d.charity_name || d.charity_hmrc_ref}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {d.donor_name_submitted}
                      <span className="text-gray-400 ml-1 font-mono text-xs">{d.donor_postcode_submitted}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{fmt(d.amount)}</td>
                    <td className="px-4 py-3 text-sm font-bold text-brand-accent whitespace-nowrap">
                      {d.gift_aid_status === 'matched' ? fmt(d.giftAid) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                      {new Date(d.donation_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColour(d.gift_aid_status)}`}>
                        {statusLabel(d.gift_aid_status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {d.matchedDonor ? `${d.matchedDonor.first_name} ${d.matchedDonor.last_name} · ${d.matchedDonor.postcode}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between text-sm">
              <span className="text-gray-400">Page {page + 1} of {totalPages}</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="px-3 py-1 rounded border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50">Previous</button>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="px-3 py-1 rounded border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
