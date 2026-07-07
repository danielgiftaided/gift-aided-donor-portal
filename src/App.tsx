import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Register       from './pages/register'
import Login          from './pages/login'
import ForgotPassword from './pages/forgotPassword'
import ResetPassword  from './pages/resetPassword'
import MfaSetup       from './pages/mfaSetup'
import MfaChallenge   from './pages/mfaChallenge'
import Dashboard      from './pages/dashboard'
import GivingHistory  from './pages/givingHistory'
import Authorisation  from './pages/authorisation'
import Profile        from './pages/profile'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/register"        element={<Register />} />
        <Route path="/login"           element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />

        {/* Auth flow */}
        <Route path="/mfa-setup"       element={<MfaSetup />} />
        <Route path="/mfa-challenge"   element={<MfaChallenge />} />

        {/* Authenticated donor pages */}
        <Route path="/dashboard"       element={<Dashboard />} />
        <Route path="/giving-history"  element={<GivingHistory />} />
        <Route path="/authorisation"   element={<Authorisation />} />
        <Route path="/profile"         element={<Profile />} />

        {/* Default */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
