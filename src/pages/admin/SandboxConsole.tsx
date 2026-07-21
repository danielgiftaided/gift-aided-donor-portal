import { useState } from 'react'

const SANDBOX_KEY = 'sandbox-launchgood-key-giftaided-2026'
const BASE_URL     = typeof window !== 'undefined' ? window.location.origin : ''

const TEST_SCENARIOS = [
  {
    id: 'active',
    label: 'Scenario 1 — Active registered donor',
    email: 'sandbox-active@test.giftaided.com',
    expected: '{ registered: true, active: true }',
    description: 'Simulates a donor who already has Gift Aid set up. LaunchGood should apply Gift Aid silently — no prompt shown to donor.',
    badge: 'bg-green-100 text-green-700',
  },
  {
    id: 'cancelled',
    label: 'Scenario 2 — Cancelled authorisation',
    email: 'sandbox-cancelled@test.giftaided.com',
    expected: '{ registered: true, active: false }',
    description: 'Donor is known but cancelled their Gift Aid. LaunchGood should show the "Add Gift Aid" prompt so they can re-register.',
    badge: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'new',
    label: 'Scenario 3 — Unregistered donor',
    email: 'any-email-not-in-system@test.com',
    expected: '{ registered: false, registrationUrl: "..." }',
    description: 'Donor has never registered with Gift Aided. LaunchGood should show the "Add Gift Aid" button linking to the returned registrationUrl.',
    badge: 'bg-blue-100 text-blue-700',
  },
]

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded px-2 py-0.5 transition-colors">
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-700">
      {label && (
        <div className="bg-gray-800 px-3 py-1.5 flex items-center justify-between">
          <span className="text-xs text-gray-400 font-mono">{label}</span>
          <CopyBtn text={code} />
        </div>
      )}
      <pre className="bg-gray-900 text-green-400 text-xs p-4 overflow-x-auto font-mono leading-relaxed">{code}</pre>
    </div>
  )
}

export default function SandboxConsole() {
  const [activeScenario, setActiveScenario] = useState(TEST_SCENARIOS[0])
  const [customEmail, setCustomEmail]       = useState('')
  const [loading, setLoading]               = useState(false)
  const [response, setResponse]             = useState<any>(null)
  const [error, setError]                   = useState<string | null>(null)
  const [resetting, setResetting]           = useState(false)
  const [resetMsg, setResetMsg]             = useState<string | null>(null)

  const emailToTest = customEmail || activeScenario.email

  const runCheckDonor = async () => {
    setLoading(true); setError(null); setResponse(null)
    try {
      const params = new URLSearchParams({
        email: emailToTest,
        name: 'Test Donor',
        campaign_name: 'Sandbox Test Campaign',
        redirect_url: 'https://launchgood.com/c/sandbox-test',
      })
      const resp = await fetch(`${BASE_URL}/api/platform/check-donor?${params}`, {
        headers: { 'x-api-key': SANDBOX_KEY },
      })
      const json = await resp.json()
      setResponse({ status: resp.status, body: json })
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }

  const runReset = async () => {
    if (!window.confirm('Reset all sandbox test data? This cannot be undone.')) return
    setResetting(true); setResetMsg(null)
    try {
      const resp = await fetch('/api/admin/sandbox/reset', { method: 'POST' })
      const json = await resp.json()
      setResetMsg(json.ok ? '✓ Sandbox reset — all three test scenarios restored.' : json.error)
    } catch (e: any) { setResetMsg(e.message) } finally { setResetting(false) }
  }

  const checkDonorUrl = `${BASE_URL}/api/platform/check-donor?email=${encodeURIComponent(emailToTest)}&name=Test+Donor&redirect_url=https://launchgood.com/c/test`
  const curlExample = `curl -X GET \\
  "${checkDonorUrl}" \\
  -H "x-api-key: ${SANDBOX_KEY}"`

  const quickRegisterExample = `curl -X POST \\
  "${BASE_URL}/api/platform/quick-register" \\
  -H "x-api-key: ${SANDBOX_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "new-donor@test.com",
    "firstName": "Test",
    "lastName": "Donor",
    "address": "10 Test Street, London",
    "postcode": "EC1A 1BB",
    "campaignName": "Sandbox Test Campaign"
  }'`

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono">

      {/* Header */}
      <div className="bg-amber-500 text-gray-900 px-6 py-2 text-center text-sm font-bold">
        ⚠️ SANDBOX ENVIRONMENT — synthetic test data only — no real donors, no real Gift Aid
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Arial, sans-serif' }}>
              Gift Aided × LaunchGood — Integration Console
            </h1>
            <p className="text-gray-400 text-sm mt-1" style={{ fontFamily: 'Arial, sans-serif' }}>
              Sandbox API testing environment · Base URL: <code className="text-green-400">{BASE_URL}</code>
            </p>
          </div>
          <button onClick={runReset} disabled={resetting}
            className="text-xs bg-red-900 hover:bg-red-800 text-red-200 border border-red-700 rounded px-3 py-1.5 disabled:opacity-40 transition-colors"
            style={{ fontFamily: 'Arial, sans-serif' }}>
            {resetting ? 'Resetting…' : '↺ Reset sandbox data'}
          </button>
        </div>

        {resetMsg && (
          <div className="bg-gray-800 border border-gray-600 text-green-400 px-4 py-2 rounded text-sm mb-6">
            {resetMsg}
          </div>
        )}

        {/* API key */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase tracking-widest">Sandbox API Key (x-api-key header)</span>
            <CopyBtn text={SANDBOX_KEY} />
          </div>
          <code className="text-green-400 text-sm">{SANDBOX_KEY}</code>
          <p className="text-xs text-gray-500 mt-2">Use this key for all sandbox requests. A separate production key will be issued when going live.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left: Test scenarios */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest" style={{ fontFamily: 'Arial, sans-serif' }}>
              Test Scenarios
            </h2>

            {TEST_SCENARIOS.map(s => (
              <button key={s.id} onClick={() => { setActiveScenario(s); setCustomEmail(''); setResponse(null) }}
                className={`w-full text-left p-4 rounded-xl border transition-all ${activeScenario.id === s.id ? 'border-green-500 bg-gray-800' : 'border-gray-700 bg-gray-900 hover:border-gray-500'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.badge}`}
                    style={{ fontFamily: 'Arial, sans-serif' }}>{s.label}</span>
                </div>
                <code className="text-green-400 text-xs">{s.email}</code>
                <p className="text-gray-400 text-xs mt-1" style={{ fontFamily: 'Arial, sans-serif' }}>{s.description}</p>
                <div className="mt-2 text-xs text-gray-500">
                  Expected: <code className="text-amber-400">{s.expected}</code>
                </div>
              </button>
            ))}

            {/* Custom email */}
            <div className="p-4 rounded-xl border border-gray-700 bg-gray-900">
              <p className="text-xs text-gray-400 mb-2" style={{ fontFamily: 'Arial, sans-serif' }}>Or test with a custom email:</p>
              <input
                type="email"
                value={customEmail}
                onChange={e => { setCustomEmail(e.target.value); setResponse(null) }}
                placeholder="any-email@example.com"
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-green-400 focus:outline-none focus:border-green-500 font-mono"
              />
            </div>

            {/* Quick Register link */}
            {response?.body?.registrationUrl && (
              <div className="p-4 rounded-xl border border-blue-700 bg-blue-950">
                <p className="text-xs text-blue-300 mb-2" style={{ fontFamily: 'Arial, sans-serif' }}>Registration URL returned — click to test the quick-register flow:</p>
                <a href={response.body.registrationUrl} target="_blank" rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline text-xs break-all">
                  {response.body.registrationUrl}
                </a>
              </div>
            )}
          </div>

          {/* Right: API tester */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-widest" style={{ fontFamily: 'Arial, sans-serif' }}>
              API Tester
            </h2>

            {/* Endpoint */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs bg-green-800 text-green-200 px-2 py-0.5 rounded font-bold">GET</span>
                <code className="text-green-400 text-xs break-all">/api/platform/check-donor</code>
              </div>
              <div className="space-y-1 text-xs mb-3">
                {[
                  ['email', emailToTest],
                  ['x-api-key', SANDBOX_KEY],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <span className="text-gray-500 w-20 flex-shrink-0">{k}:</span>
                    <span className="text-green-400 break-all">{v}</span>
                  </div>
                ))}
              </div>
              <button onClick={runCheckDonor} disabled={loading}
                className="w-full bg-green-700 hover:bg-green-600 text-white rounded py-2 text-sm font-bold disabled:opacity-40 transition-colors"
                style={{ fontFamily: 'Arial, sans-serif' }}>
                {loading ? 'Calling API…' : '▶  Run check-donor'}
              </button>
            </div>

            {/* Response */}
            {error && (
              <div className="bg-red-950 border border-red-700 text-red-300 p-4 rounded-xl text-xs">
                Error: {error}
              </div>
            )}
            {response && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${response.status === 200 ? 'bg-green-800 text-green-200' : 'bg-red-800 text-red-200'}`}>
                    HTTP {response.status}
                  </span>
                  <span className="text-gray-400 text-xs">Response</span>
                </div>
                <CodeBlock code={JSON.stringify(response.body, null, 2)} />
              </div>
            )}

            {/* cURL examples */}
            <div className="space-y-3">
              <CodeBlock code={curlExample} label="cURL — check-donor" />
              <CodeBlock code={quickRegisterExample} label="cURL — quick-register" />
            </div>
          </div>
        </div>

        {/* Full flow walkthrough */}
        <div className="mt-8 bg-gray-900 border border-gray-700 rounded-xl p-6">
          <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-widest" style={{ fontFamily: 'Arial, sans-serif' }}>
            Integration Flow — Step by Step
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Donor begins donation', desc: 'LaunchGood collects donor email. Call check-donor before payment to determine Gift Aid status.', colour: 'border-blue-700' },
              { step: '2', title: 'Apply or prompt', desc: 'If registered → apply Gift Aid silently. If not → show "Add Gift Aid" button linking to the returned registrationUrl.', colour: 'border-green-700' },
              { step: '3', title: 'Confirm and record', desc: 'After registration or silent match, redirect donor back to LaunchGood with ?gift_aid=activated. Gift Aid is handled by Gift Aided.', colour: 'border-amber-700' },
            ].map(s => (
              <div key={s.step} className={`border ${s.colour} rounded-xl p-4`}>
                <div className="text-2xl font-bold text-gray-600 mb-2">{s.step}</div>
                <p className="text-sm font-semibold text-white mb-1" style={{ fontFamily: 'Arial, sans-serif' }}>{s.title}</p>
                <p className="text-xs text-gray-400" style={{ fontFamily: 'Arial, sans-serif' }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-gray-600" style={{ fontFamily: 'Arial, sans-serif' }}>
          Gift Aided Sandbox · Questions? Contact daniel@giftaided.com
        </div>
      </div>
    </div>
  )
}
