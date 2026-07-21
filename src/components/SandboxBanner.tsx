/**
 * SandboxBanner — renders a persistent banner on every page when
 * VITE_SANDBOX_MODE=true. Makes it impossible to confuse sandbox
 * with production. Not rendered in production (zero performance cost).
 */
export default function SandboxBanner() {
  if (import.meta.env.VITE_SANDBOX_MODE !== 'true') return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#f59e0b',
        color: '#1c1917',
        textAlign: 'center',
        fontSize: '12px',
        fontWeight: 700,
        fontFamily: 'Arial, sans-serif',
        padding: '4px 8px',
        letterSpacing: '0.05em',
      }}
    >
      ⚠️ SANDBOX ENVIRONMENT — synthetic test data only — no real donors, no real Gift Aid
      &nbsp;&nbsp;|&nbsp;&nbsp;
      API key: <code style={{ background: 'rgba(0,0,0,0.15)', padding: '1px 6px', borderRadius: 3 }}>
        sandbox-launchgood-key-giftaided-2026
      </code>
    </div>
  )
}
