import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)

    if (otpSent) {
      // Verify OTP and login
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, otp, role: 'merchant', password: '' })
        })
        const data = await res.json()
        if (res.ok) {
          login(data)
          navigate('/merchant-dashboard')
        } else {
          setMsg({ type: 'error', text: data.error || 'Login failed.' })
        }
      } catch {
        setMsg({ type: 'error', text: 'Network error. Please try again.' })
      }
      setLoading(false)
      return
    }

    // Request reset
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier })
      })
      const data = await res.json()
      if (res.ok) {
        setOtpSent(true)
        setMsg({ type: 'success', text: 'Security code sent! Check your email.' })
      } else {
        setMsg({ type: 'error', text: data.error || 'Failed to request reset.' })
      }
    } catch {
      setMsg({ type: 'error', text: 'Network Error' })
    }
    setLoading(false)
  }

  return (
    <>
      <Navbar />
      <div className="auth-container">
        <div className="auth-box glass-panel">
          <h2 style={{ textAlign: 'center', marginBottom: 10 }}>Forgot Password?</h2>
          <p style={{ textAlign: 'center', color: '#ccc', marginBottom: 30, fontSize: 14 }}>
            Enter your registered email address. We will send you a temporary password.
          </p>

          {msg && <div className={`msg-${msg.type}`}>{msg.text}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Registered Email or Mobile</label>
              <input
                type="text"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required
                placeholder="Enter email or mobile number"
                readOnly={otpSent}
                pattern="^([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}|[0-9]{10})$"
                title="Please enter a valid Email Address or a 10-digit Mobile Number"
              />
            </div>
            {otpSent && (
              <div className="form-group">
                <label>Security Code (OTP)</label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  required
                  style={{ letterSpacing: 5, textAlign: 'center', fontSize: 20 }}
                />
              </div>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Processing...' : (otpSent ? 'Login Now' : 'Reset Password')}
            </button>
          </form>

          <div className="auth-footer">
            Remember your password? <Link to="/merchant-login">Login Here</Link>
          </div>
        </div>
      </div>
    </>
  )
}
