import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import DonorLayout from '../components/DonorLayout'

interface Donation {
  id: string; charityName: string | null; charityHmrcRef: string
  amount: number; donationDate: string; giftAidStatus: string; giftAid: number
}

const statusColour = (s: string) => s === 'matched' ? 'bg-green-100 text-green-700' : s === 'no_match' ? 'bg-gray-100 text-gray-400' : 'bg-amber-100 text-amber-700'
const statusLabel  = (s: string) => s === 'matched' ? 'Gift Aid applied' : s === 'no_match' ? 'No match' : 'Pending'

export default function GivingHistory() {
  const navigate = useNavigate()
  const [donations, setDonations] = useState<Donation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'matched' | 'no_match'>('all')

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { navigate('/login'); return }
      const resp = await fetch('/api/donor/giving-history', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const json = await resp.json()
      if (json.ok) setDonations(json.donations || [])
      setLoading(false)
    })()
  }, [])

  const fmt = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
  const filtered = filter === 'all' ? donations : donations.filter(d => d.giftAidStatus === filter)
  const totalGiftAid = donations.filter(d => d.giftAidStatus === 'matched').reduce((s, d) => s + d.giftAid, 0)

  return (
    <DonorLayout active="giving">
      <div className="max-w-2xl mx-auto px-4 pt-6 pb-6 space-y-4">

        <div>
          <h1 className="text-xl font-bold text-brand-primary">My Giving</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {totalGiftAid > 0 ? `${fmt(totalGiftAid)} Gift Aid generated across all your donations.` : 'All donations processed through Gift Aided-connected charities.'}
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'matched', 'no_match'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition-colors
                ${filter === f ? 'bg-brand-accent text-white' : 'bg-white border border-gray-200 text-gray-500'}`}>
              {f === 'all' ? 'All' : f === 'matched' ? 'Gift Aid applied' : 'No match'}
            </button>
          ))}
        </div>

        {/* Mobile: card list / Desktop: show as list but clean */}
        <div className="space-y-2">
          {loading ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-300 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
              <p className="text-gray-300 text-sm">No donations found.</p>
              {filter !== 'all' && <button onClick={() => setFilter('all')} className="text-xs text-brand-accent hover:underline mt-2">Show all</button>}
            </div>
          ) : filtered.map(d => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-brand-primary truncate">{d.charityName || d.charityHmrcRef}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(d.donationDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-gray-700">{fmt(d.amount)}</p>
                  {d.giftAidStatus === 'matched' && (
                    <p className="text-xs font-bold text-brand-accent mt-0.5">+{fmt(d.giftAid)}</p>
                  )}
                </div>
              </div>
              <div className="mt-2">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColour(d.giftAidStatus)}`}>
                  {statusLabel(d.giftAidStatus)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </DonorLayout>
  )
}
