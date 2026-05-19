import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { useAuth } from '../context/AuthContext'

export default function MerchantLoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [permission, setPermission] = useState('')
  const [showOtp, setShowOtp] = useState(false)
  const [showPermission, setShowPermission] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const { login } = useAuth()
  const navigate = useNavigate()

  // Timer logic for OTP expiry/resend cooldown
  useEffect(() => {
    let timer;
    if (showOtp && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showOtp, timeLeft]);

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)

    const data = { identifier, password }
    if (showOtp) data.otp = otp
    if (showPermission) data.permission = permission

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await response.json()

      if (response.ok) {
        if (result.requireOtp) {
          setShowOtp(true)
          setShowPermission(false)
          setTimeLeft(120) // Start 2-minute timer
          setMsg({ type: 'info', text: result.message || 'Please enter your Security Code' })
          setLoading(false)
          return
        }
        if (result.requirePermission) {
          setShowOtp(false)
          setShowPermission(true)
          setMsg({ type: 'info', text: result.message || 'Step 3: Enter Permission Code' })
          setLoading(false)
          return
        }
        login(result)
        if (result.role === 'admin') {
          navigate('/admin-dashboard')
        } else {
          navigate('/merchant-dashboard')
        }
      } else {
        setMsg({ type: 'error', text: result.error || result.message || 'Server Error. Please check your internet connection or try again later.' })
        // If too many attempts, allow immediate resend even if time is > 30s
        if (response.status === 403 && showOtp) {
          setTimeLeft(0) // Force resend availability
        }
      }
    } catch {
      setMsg({ type: 'error', text: 'Network Error' })
    }
    setLoading(false)
  }

  const handleResend = async () => {
    // Allow resend if timer is below 30s OR if 3 attempts were wrong
    if (timeLeft > 30 && timeLeft !== 0) return; 
    setLoading(true)
    try {
      const response = await fetch('/api/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier })
      })
      const result = await response.json()
      if (response.ok) {
        setMsg({ type: 'info', text: 'New code sent!' })
        setShowOtp(true)
        setShowPermission(false)
        setTimeLeft(120)
        setOtp('')
      } else {
        setMsg({ type: 'error', text: result.error })
      }
    } catch {
      setMsg({ type: 'error', text: 'Failed to resend code' })
    }
    setLoading(false)
  }

  return (
    <>
      <Navbar />
      <div className="auth-container">
        <div className="auth-box glass-panel">
          <h2 style={{ textAlign: 'center', marginBottom: 30 }}>Login</h2>

          {msg && <div className={`msg-${msg.type}`}>{msg.text}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email or Mobile</label>
              <input type="text" value={identifier} onChange={e => setIdentifier(e.target.value)} required disabled={showOtp || showPermission} />
            </div>
            {!showOtp && !showPermission && (
              <div className="form-group">
                <label>Password</label>
                <div className="password-wrapper">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" className="toggle-pw" onClick={() => setShowPw(!showPw)}>
                    👁
                  </button>
                </div>
              </div>
            )}
            {showOtp && (
              <div className="form-group">
                <label>Security Code (6-digits)</label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  maxLength={6}
                  placeholder="Enter 6-digit OTP"
                  required
                  autoFocus
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <span style={{ fontSize: 12, opacity: 0.8 }}>
                    {timeLeft > 0 ? `Expires in: ${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}` : 'Code expired'}
                  </span>
                  <button 
                    type="button" 
                    onClick={handleResend} 
                    disabled={(timeLeft > 30 && timeLeft !== 0) || loading}
                    style={{ background: 'none', border: 'none', color: (timeLeft <= 30 || timeLeft === 0) ? 'var(--primary)' : '#888', cursor: (timeLeft <= 30 || timeLeft === 0) ? 'pointer' : 'default', fontSize: 12, textDecoration: 'underline' }}
                  >
                    Resend OTP
                  </button>
                </div>
              </div>
            )}
            {showPermission && (
              <div className="form-group">
                <label>Admin Permission Code</label>
                <input
                  type="password"
                  value={permission}
                  onChange={e => setPermission(e.target.value)}
                  placeholder="Enter 4-digit master code"
                  required
                  autoFocus
                />
              </div>
            )}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 20 }} disabled={loading}>
              {loading ? 'Please wait...' : (showOtp ? 'Verify OTP' : (showPermission ? 'Verify Permission' : 'Login'))}
            </button>
            {(showOtp || showPermission) && (
              <button type="button" onClick={() => { setShowOtp(false); setShowPermission(false); setOtp(''); setPermission(''); setMsg(null); }} className="btn btn-outline" style={{ width: '100%', marginTop: 10 }}>
                Back to Password
              </button>
            )}
          </form>

          <div className="auth-footer">
            {!showOtp && (
              <>
                Forgot Password? <Link to="/forgot-password" style={{ marginRight: 15 }}>Reset Here</Link>
                <br /><br />
                Don't have an account? <Link to="/merchant-register">Register Here</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
