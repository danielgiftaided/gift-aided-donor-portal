import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import SandboxBanner    from './components/SandboxBanner'

// Donor public pages
import Register          from './pages/register'
import Login             from './pages/login'
import ForgotPassword    from './pages/forgotPassword'
import ResetPassword     from './pages/resetPassword'
import MfaSetup          from './pages/mfaSetup'
import MfaChallenge      from './pages/mfaChallenge'
import QuickRegister     from './pages/quickRegister'

// Donor authenticated pages
import Dashboard         from './pages/dashboard'
import GivingHistory     from './pages/givingHistory'
import Authorisation     from './pages/authorisation'
import Profile           from './pages/profile'

// Admin pages
import AdminLogin        from './pages/admin/adminLogin'
import AdminMfaChallenge from './pages/admin/adminMfaChallenge'
import AdminDashboard    from './pages/admin/adminDashboard'
import AdminDonors       from './pages/admin/adminDonors'
import AdminDonations    from './pages/admin/adminDonations'
import AdminMatching     from './pages/admin/adminMatching'
import AdminStatements   from './pages/admin/adminStatements'

// Sandbox-only page
import SandboxConsole    from './pages/admin/SandboxConsole'

export default function App() {
  return (
    <BrowserRouter>
      {/* Persistent amber banner shown on every page in sandbox mode.
          Renders nothing in production (VITE_SANDBOX_MODE !== 'true'). */}
      <SandboxBanner />

      <Routes>
        {/* ── Donor public ──────────────────────────────────────── */}
        <Route path="/register"        element={<Register />} />
        <Route path="/login"           element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="/quick-register"  element={<QuickRegister />} />

        {/* ── Donor auth flow ───────────────────────────────────── */}
        <Route path="/mfa-setup"       element={<MfaSetup />} />
        <Route path="/mfa-challenge"   element={<MfaChallenge />} />

        {/* ── Donor authenticated ───────────────────────────────── */}
        <Route path="/dashboard"       element={<Dashboard />} />
        <Route path="/giving-history"  element={<GivingHistory />} />
        <Route path="/authorisation"   element={<Authorisation />} />
        <Route path="/profile"         element={<Profile />} />

        {/* ── Admin ─────────────────────────────────────────────── */}
        <Route path="/admin/login"         element={<AdminLogin />} />
        <Route path="/admin/mfa-challenge" element={<AdminMfaChallenge />} />
        <Route path="/admin"               element={<AdminDashboard />} />
        <Route path="/admin/donors"        element={<AdminDonors />} />
        <Route path="/admin/donations"     element={<AdminDonations />} />
        <Route path="/admin/matching"      element={<AdminMatching />} />
        <Route path="/admin/statements"    element={<AdminStatements />} />

        {/* ── Sandbox only ──────────────────────────────────────── */}
        {/* Interactive API console for LaunchGood integration testing.
            Available at /sandbox-console on the sandbox deployment only. */}
        <Route path="/sandbox-console" element={<SandboxConsole />} />

        {/* ── Default ───────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
