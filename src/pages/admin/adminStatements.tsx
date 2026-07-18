import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import AdminLayout from './AdminLayout'

interface Status {
  taxYear: string; total: number; sent: number; unsent: number
  totalGiftAid: number; daysUntilDeadline: number; deadlinePassed: boolean
}

const TAX_YEARS = ['2024/25', '2023/24', '2022/23', '2021/22']

function DeadlineBanner({ days, passed }: { days: number; passed: boolean }) {
  if (passed) return (
    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
      <span className="text-red-500 text-lg flex-shrink-0">⚠️</span>
      <div>
        <p className="text-sm font-bold text-red-700">Deadline has passed</p>
        <p className="text-xs text-red-600 mt-0.5">Annual statements were legally required to be sent by 31 May. Send any outstanding statements immediately and document the late dispatch.</p>
      </div>
    </div>
  )
  if (days <= 14) return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
      <span className="text-amber-500 text-lg flex-shrink-0">⏰</span>
      <div>
        <p className="text-sm font-bold text-amber-700">{days} days until the 31 May deadline</p>
        <p className="text-xs text-amber-600 mt-0.5">Annual statements must be dispatched by 31 May. Generate and send any outstanding statements now.</p>
      </div>
    </div>
  )
  if (days <= 30) return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
      <span className="text-blue-500 text-lg flex-shrink-0">📅</span>
      <div>
        <p className="text-sm font-bold text-blue-700">{days} days until the 31 May deadline</p>
        <p className="text-xs text-blue-600 mt-0.5">Statements due by 31 May. Start generating them now to avoid a last-minute rush.</p>
      </div>
    </div>
  )
  return null
}

export default function AdminStatements() {
  const navigate = useNavigate()
  const [selectedYear, setSelectedYear] = useState(TAX_YEARS[0])
  const [status, setStatus]             = useState<Status | null>(null)
  const [loading, setLoading]           = useState(false)
  const [generating, setGenerating]     = useState(false)
  const [sending, setSending]           = useState(false)
  const [dryRunResult, setDryRunResult] = useState<number | null>(null)
  const [message, setMessage]           = useState<string | null>(null)
  const [error, setError]               = useState<string | null>(null)

  useEffect(() => { loadStatus() }, [selectedYear])

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { navigate('/admin/login'); return null }
    return session.access_token
  }

  const loadStatus = async () => {
    setLoading(true); setError(null); setMessage(null); setDryRunResult(null)
    const token = await getToken(); if (!token) return
    const resp = await fetch(`/api/admin/statementStatus?taxYear=${encodeURIComponent(selectedYear)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await resp.json()
    if (json.ok) setStatus(json)
    else setError(json.error)
    setLoading(false)
  }

  const handleGenerate = async () => {
    setGenerating(true); setError(null); setMessage(null)
    const token = await getToken(); if (!token) return
    const resp = await fetch('/api/admin/generateStatements', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ taxYear: selectedYear }),
    })
    const json = await resp.json()
    if (json.ok) { setMessage(json.message); await loadStatus() }
    else setError(json.error)
    setGenerating(false)
  }

  const handleDryRun = async () => {
    setError(null); setMessage(null)
    const token = await getToken(); if (!token) return
    const resp = await fetch('/api/admin/sendStatements', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ taxYear: selectedYear, dryRun: true }),
    })
    const json = await resp.json()
    if (json.ok) setDryRunResult(json.wouldSend)
    else setError(json.error)
  }

  const handleSend = async () => {
    if (!window.confirm(`Send annual statements to ${status?.unsent} donors? This cannot be undone.`)) return
    setSending(true); setError(null); setMessage(null); setDryRunResult(null)
    const token = await getToken(); if (!token) return
    const resp = await fetch('/api/admin/sendStatements', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ taxYear: selectedYear, dryRun: false }),
    })
    const json = await resp.json()
    if (json.ok) { setMessage(json.message); await loadStatus() }
    else setError(json.error)
    setSending(false)
  }

  const fmt = (n: number) => `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto px-6 pt-10 pb-12 space-y-6">

        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Annual Statements</h1>
          <p className="text-gray-400 text-sm mt-1">
            Generate and dispatch annual Gift Aid statements. Legally required by 31 May each year
            under SI 2016/1195 regulation 6.
          </p>
        </div>

        {/* Deadline banner */}
        {status && <DeadlineBanner days={status.daysUntilDeadline} passed={status.deadlinePassed} />}

        {/* Tax year selector */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-semibold text-gray-500">Tax year:</label>
          <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-accent/30">
            {TAX_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Feedback messages */}
        {error   && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
        {message && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{message}</div>}
        {dryRunResult !== null && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-sm">
            Dry run complete — {dryRunResult} statement{dryRunResult === 1 ? '' : 's'} would be sent. Click "Send now" to dispatch.
          </div>
        )}

        {/* Status cards */}
        {loading ? (
          <div className="text-center text-gray-300 py-10">Loading…</div>
        ) : status && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Generated', value: String(status.total), colour: 'text-brand-primary' },
              { label: 'Sent',      value: String(status.sent),  colour: 'text-green-600' },
              { label: 'Unsent',    value: String(status.unsent), colour: status.unsent > 0 ? 'text-amber-600' : 'text-gray-400' },
              { label: 'Total Gift Aid', value: fmt(status.totalGiftAid), colour: 'text-brand-accent' },
            ].map(c => (
              <div key={c.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{c.label}</div>
                <div className={`text-xl font-bold ${c.colour}`}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-brand-primary">Actions for {selectedYear}</h2>

          {/* Step 1 */}
          <div className="border border-gray-100 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center">1</span>
              <p className="text-sm font-semibold text-brand-primary">Generate statements</p>
            </div>
            <p className="text-xs text-gray-500 ml-8">
              Calculates totals for every donor with matched donations in {selectedYear}.
              Safe to run multiple times — updates existing records rather than duplicating them.
            </p>
            <div className="ml-8">
              <button onClick={handleGenerate} disabled={generating}
                className="bg-brand-primary text-white text-sm font-semibold rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-40">
                {generating ? 'Generating…' : 'Generate statements'}
              </button>
            </div>
          </div>

          {/* Step 2 */}
          <div className="border border-gray-100 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center">2</span>
              <p className="text-sm font-semibold text-brand-primary">Preview before sending</p>
            </div>
            <p className="text-xs text-gray-500 ml-8">
              Run a dry run to confirm exactly how many statements will go out, without sending anything.
            </p>
            <div className="ml-8">
              <button onClick={handleDryRun}
                className="bg-gray-100 text-gray-600 text-sm font-semibold rounded-lg px-4 py-2 hover:bg-gray-200">
                Dry run
              </button>
            </div>
          </div>

          {/* Step 3 */}
          <div className="border border-gray-100 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center ${status?.deadlinePassed ? 'bg-red-500' : 'bg-brand-accent'}`}>3</span>
              <p className="text-sm font-semibold text-brand-primary">Send statements</p>
              {status && status.unsent === 0 && status.total > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">All sent ✓</span>
              )}
            </div>
            <p className="text-xs text-gray-500 ml-8">
              Sends branded email statements to all donors who haven't received one yet for {selectedYear}.
              Only unsent statements are dispatched — already-sent statements are skipped.
            </p>
            {status && status.unsent > 0 && (
              <div className="ml-8">
                <button onClick={handleSend} disabled={sending || status.total === 0}
                  className={`text-white text-sm font-semibold rounded-lg px-4 py-2 hover:opacity-90 disabled:opacity-40 ${status.deadlinePassed ? 'bg-red-600' : 'bg-brand-accent'}`}>
                  {sending ? 'Sending…' : `Send ${status.unsent} statement${status.unsent === 1 ? '' : 's'}`}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Legal reminder */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong className="text-gray-700">Legal requirement:</strong> Under The Donations to Charity (Gift Aid Declarations) Regulations 2016
            (SI 2016/1195) regulation 6, annual statements must be sent to all donors by <strong>31 May</strong> following the end of the tax year.
            Failure to send is a penalty-bearing offence with a maximum penalty of £3,000 per tax year.
            Both the statement content and the dispatch date must be retained for 6 years.
          </p>
        </div>

      </div>
    </AdminLayout>
  )
}
