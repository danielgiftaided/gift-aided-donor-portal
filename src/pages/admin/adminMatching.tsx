import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AdminLayout from './AdminLayout'

interface Donation {
  id: string; charity_name: string | null; charity_hmrc_ref: string
  donor_name_submitted: string; donor_postcode_submitted: string
  amount: number; donation_date: string; gift_aid_status: string
}

interface Candidate {
  id: string; first_name: string; last_name: string
  postcode: string; status: string; confidence: 'high' | 'medium' | 'low'
}

const confidenceStyle: Record<string, string> = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-gray-100 text-gray-500',
}

export default function AdminMatching() {
  const navigate = useNavigate()
  const [donations, setDonations] = useState<Donation[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<Record<string, Candidate[]>>({})
  const [applying, setApplying] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  useEffect(() => { loadData() }, [page])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/admin/login'); return }
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE), status: 'pending' })
      const resp = await fetch(`/api/admin/listDonations?${params}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      const json = await resp.json()
      if (!json.ok) throw new Error(json.error)
      setDonations(json.donations.filter((d: Donation) => d.gift_aid_status !== 'matched'))
      setTotal(json.total)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const findMatches = async (donation: Donation) => {
    setSearching(donation.id); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const resp = await fetch('/api/admin/matchDonation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ donation_id: donation.id }),
      })
      const json = await resp.json()
      if (!json.ok) throw new Error(json.error)
      setCandidates(prev => ({ ...prev, [donation.id]: json.candidates || [] }))
    } catch (e: any) { setError(e.message) } finally { setSearching(null) }
  }

  const applyMatch = async (donationId: string, donorId: string, donorName: string) => {
    if (!window.confirm(`Apply Gift Aid match: link this donation to ${donorName}?`)) return
    setApplying(donationId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const resp = await fetch('/api/admin/matchDonation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ donation_id: donationId, donor_id: donorId }),
      })
      const json = await resp.json()
      if (!json.ok) throw new Error(json.error)
      setSuccessMsg(`Gift Aid match applied for ${donorName}`)
      setCandidates(prev => { const n = { ...prev }; delete n[donationId]; return n })
      setTimeout(() => setSuccessMsg(null), 4000)
      await loadData()
    } catch (e: any) { setError(e.message) } finally { setApplying(null) }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-12">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-brand-primary">Donor Matching</h1>
          <p className="text-gray-400 text-sm mt-1">
            Match unmatched platform donations to registered donors. Search finds candidates by name and postcode — you confirm before anything is applied.
          </p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}
        {successMsg && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">{successMsg}</div>}

        {loading ? (
          <div className="text-center text-gray-300 py-20">Loading…</div>
        ) : donations.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-16 text-center">
            <p className="text-green-600 font-semibold text-lg">✓ All caught up</p>
            <p className="text-gray-400 text-sm mt-2">No unmatched donations at the moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {donations.map(d => (
              <div key={d.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-brand-primary">{d.donor_name_submitted}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {d.charity_name || d.charity_hmrc_ref} · {d.donor_postcode_submitted} · £{d.amount.toFixed(2)} · {new Date(d.donation_date).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <button
                    onClick={() => findMatches(d)}
                    disabled={searching === d.id}
                    className="flex-shrink-0 text-xs font-semibold text-brand-accent border border-brand-accent/30 rounded-lg px-3 py-1.5 hover:bg-brand-accent/5 disabled:opacity-40"
                  >
                    {searching === d.id ? 'Searching…' : 'Find matches'}
                  </button>
                </div>

                {/* Candidates */}
                {candidates[d.id] !== undefined && (
                  <div className="border-t border-gray-50 bg-gray-50/50">
                    {candidates[d.id].length === 0 ? (
                      <p className="px-5 py-3 text-sm text-gray-400">No registered donors found matching this name and postcode.</p>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {candidates[d.id].map(c => (
                          <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-4">
                            <div className="text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-brand-primary">{c.first_name} {c.last_name}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${confidenceStyle[c.confidence]}`}>
                                  {c.confidence}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 mt-0.5">Postcode: {c.postcode}</p>
                            </div>
                            <button
                              onClick={() => applyMatch(d.id, c.id, `${c.first_name} ${c.last_name}`)}
                              disabled={applying === d.id}
                              className="flex-shrink-0 bg-brand-accent text-white text-xs font-semibold rounded-lg px-3 py-1.5 hover:opacity-90 disabled:opacity-40"
                            >
                              {applying === d.id ? 'Applying…' : 'Apply match'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm pt-2">
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
        )}
      </div>
    </AdminLayout>
  )
}
