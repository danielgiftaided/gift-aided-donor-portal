import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Donation {
  id: string; charityName: string | null; charityHmrcRef: string
  amount: number; donationDate: string; giftAidStatus: string; giftAid: number
}

function Logo() {
  return (
    <span style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 800, color: '#0c745d', fontSize: '1.6rem', lineHeight: 1 }}>
      gift aided <span style={{ fontWeight: 400 }}>Portal</span>
    </span>
  )
}

export default function GivingHistory() {
  const navigate = useNavigate()
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'matched' | 'no_match'>('all')

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/login'); return }
      const resp = await fetch('/api/donor/giving-history', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = await resp.json()
      if (json.ok) setDonations(json.donations || [])
      setLoading(false)
    })()
  }, [])

  const fmt = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
  const filtered = filter === 'all' ? donations : donations.filter(d => d.giftAidStatus === filter)
  const totalGiftAid = donations.filter(d => d.giftAidStatus === 'matched').reduce((s, d) => s + d.giftAid, 0)

  return (
    <div className="min-h-screen bg-brand-surface">
      <nav className="bg-white border-b border-gray-100">
        <div className="w-full px-8 py-4 flex justify-between items-center">
          <Logo />
          <div className="flex items-center gap-5">
            <Link to="/dashboard" className="text-sm font-medium text-brand-primary hover:text-brand-accent">Dashboard</Link>
            <Link to="/giving-history" className="text-sm font-medium text-brand-accent">My Giving</Link>
            <Link to="/authorisation" className="text-sm font-medium text-brand-primary hover:text-brand-accent">Authorisation</Link>
            <Link to="/profile" className="text-sm font-medium text-brand-primary hover:text-brand-accent">Profile</Link>
            <button onClick={async () => { await supabase.auth.signOut(); navigate('/login') }}
              className="text-sm text-gray-400 hover:text-gray-600">Sign out</button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pt-10 pb-12">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-brand-primary">My Giving History</h1>
            <p className="text-gray-400 text-sm mt-1">
              All donations submitted through Gift Aided-connected platforms and charities.
              {totalGiftAid > 0 && ` Total Gift Aid generated: ${fmt(totalGiftAid)}.`}
            </p>
          </div>
          <div className="flex gap-2">
            {(['all', 'matched', 'no_match'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1 rounded-full font-semibold transition-colors
                  ${filter === f ? 'bg-brand-accent text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                {f === 'all' ? 'All' : f === 'matched' ? 'Gift Aid applied' : 'No match'}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="px-6 py-16 text-center text-gray-300">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <p className="text-gray-300 text-sm">No donations found.</p>
              {filter !== 'all' && <button onClick={() => setFilter('all')} className="text-xs text-brand-accent hover:underline mt-2">Show all</button>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-50">
                <thead>
                  <tr className="bg-gray-50/50">
                    {['Charity', 'Donation amount', 'Gift Aid', 'Date', 'Status'].map(h => (
                      <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(d => (
                    <tr key={d.id}>
                      <td className="px-6 py-3 text-sm font-medium text-brand-primary">{d.charityName || d.charityHmrcRef}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">{fmt(d.amount)}</td>
                      <td className="px-6 py-3 text-sm font-semibold text-brand-accent">
                        {d.giftAidStatus === 'matched' ? fmt(d.giftAid) : '—'}
                      </td>
                      <td className="px-6 py-3 text-sm text-gray-400">
                        {new Date(d.donationDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                          ${d.giftAidStatus === 'matched' ? 'bg-green-100 text-green-700' :
                            d.giftAidStatus === 'no_match' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>
                          {d.giftAidStatus === 'matched' ? 'Gift Aid applied' : d.giftAidStatus === 'no_match' ? 'No match' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
