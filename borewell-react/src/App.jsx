import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { lazy, Suspense } from 'react'

const HomePage = lazy(() => import('./pages/HomePage'))
const MerchantLoginPage = lazy(() => import('./pages/MerchantLoginPage'))
const MerchantRegisterPage = lazy(() => import('./pages/MerchantRegisterPage'))
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'))
const CustomerPage = lazy(() => import('./pages/CustomerPage'))
const BookingPage = lazy(() => import('./pages/BookingPage'))
const MerchantDashboard = lazy(() => import('./pages/MerchantDashboard'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))

function ProtectedRoute({ children, role }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/merchant-login" replace />
  if (role && user.role !== role) return <Navigate to="/" replace />
  return children
}

const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#111', color: '#FF6600', fontFamily: 'sans-serif' }}>
    <p>Loading...</p>
  </div>
)

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/merchant-login" element={<MerchantLoginPage />} />
            <Route path="/merchant-register" element={<MerchantRegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/find-merchants" element={<CustomerPage />} />
            <Route path="/booking" element={<BookingPage />} />
            <Route path="/merchant-dashboard" element={
              <ProtectedRoute role="merchant">
                <MerchantDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin-dashboard" element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}

