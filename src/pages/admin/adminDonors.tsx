import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AdminLayout from './AdminLayout'

interface Donor {
  id: string; first_name: string; last_name: string; email: string
  postcode: string; status: string; created_at: string; cancelled_at: string | null
}

const PAGE_SIZE = 25

export default function AdminDonors() {
  const navigate = useNavigate()
  const [donors, setDonors] = useState<Donor[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { loadData() }, [page, status])

  const loadData = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/admin/login'); return }
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE),
        status, ...(search ? { search } : {})
      })
      const resp = await fetch(`/api/admin/listDonors?${params}`, { headers: { Authorization: `Bearer ${session.access_token}` } })
      const json = await resp.json()
      if (!json.ok) throw new Error(json.error)
      setDonors(json.donors); setTotal(json.total)
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const handleCancel = async (donorId: string, name: string) => {
    if (!window.confirm(`Cancel Gift Aid authorisation for ${name}? This cannot be undone.`)) return
    setCancelling(donorId)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const resp = await fetch('/api/admin/cancelDonorAuthorisation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ donor_id: donorId }),
    })
    const json = await resp.json()
    if (json.ok) await loadData()
    else setError(json.error)
    setCancelling(null)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-12">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-brand-primary">Donors</h1>
            <p className="text-gray-400 text-sm mt-1">{total} registered donors</p>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">{error}</div>}

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <input type="text" placeholder="Search by name or email…" value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadData()}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30" />
          <button onClick={loadData} className="bg-brand-accent text-white rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90">Search</button>
          {(['all', 'active', 'cancelled'] as const).map(s => (
            <button key={s} onClick={() => { setStatus(s); setPage(0) }}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${status === s ? 'bg-brand-accent text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-50">
              <thead>
                <tr className="bg-gray-50/50">
                  {['Name', 'Email', 'Postcode', 'Status', 'Registered', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-300">Loading…</td></tr>
                ) : donors.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-300">No donors found</td></tr>
                ) : donors.map(d => (
                  <tr key={d.id} className="hover:bg-brand-surface/40">
                    <td className="px-4 py-3 text-sm font-medium text-brand-primary whitespace-nowrap">{d.first_name} {d.last_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{d.email}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">{d.postcode}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${d.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {d.status === 'active' ? 'Active' : 'Cancelled'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(d.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {d.status === 'active' && (
                        <button onClick={() => handleCancel(d.id, `${d.first_name} ${d.last_name}`)}
                          disabled={cancelling === d.id}
                          className="text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-40">
                          {cancelling === d.id ? 'Cancelling…' : 'Cancel auth'}
                        </button>
                      )}
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
