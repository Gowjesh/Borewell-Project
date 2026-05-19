import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Navbar from '../components/Navbar'

async function compressImage(file, maxWidth = 800) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (event) => {
      const img = new Image()
      img.src = event.target.result
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width)
          width = maxWidth
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: 'image/jpeg' }))
        }, 'image/jpeg', 0.7)
      }
    }
  })
}

export default function MerchantRegisterPage() {
  const navigate = useNavigate()
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)

    const formEl = e.target
    const formData = new FormData(formEl)

    const selectedServices = formData.getAll('services')
    if (selectedServices.length === 0) {
      setMsg({ type: 'error', text: 'Please select at least one service.' })
      setLoading(false)
      return
    }
    // Combine array of checkboxes into a single comma-separated string for the DB
    formData.set('services', selectedServices.join(', '))

    const fileInput = formEl.querySelector('input[type="file"]')
    if (fileInput.files.length > 0) {
      const compressed = await compressImage(fileInput.files[0])
      formData.set('profile_image', compressed)
    }

    try {
      const response = await fetch('/api/register', { method: 'POST', body: formData })
      const result = await response.json()

      if (response.ok) {
        setMsg({ type: 'success', text: 'Registration Successful! Redirecting to login...' })
        setTimeout(() => navigate('/merchant-login'), 2000)
      } else {
        setMsg({ type: 'error', text: result.error })
      }
    } catch {
      setMsg({ type: 'error', text: 'Something went wrong. Please try again.' })
    }
    setLoading(false)
  }

  return (
    <>
      <Navbar />
      <div className="auth-container" style={{ paddingTop: 100 }}>
        <div className="auth-box glass-panel" style={{ maxWidth: 500 }}>
          <h2 style={{ textAlign: 'center', marginBottom: 30, fontFamily: 'var(--font-heading)' }}>
            Merchant Registration
          </h2>

          {msg && <div className={`msg-${msg.type}`}>{msg.text}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Owner Name</label>
              <input type="text" name="owner_name" required placeholder="Ex: Palanisamy" />
            </div>
            <div className="form-group">
              <label>Vehicle Name / Business Name</label>
              <input type="text" name="vehicle_name" required placeholder="Ex: Palanisamy Borewells" />
            </div>
            <div className="form-group">
              <label>Mobile Number (Unique)</label>
              <input type="tel" name="mobile" required placeholder="Ex: 9942440838" pattern="[0-9]{10}" />
            </div>
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" name="email" required placeholder="Ex: business@example.com" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" name="password" required placeholder="Create a strong password" />
            </div>
            <div className="form-group">
              <label>Location (City)</label>
              <input type="text" name="location" required placeholder="Ex: Bijapur, Karnataka" />
            </div>
            <div className="form-group">
              <label>Profile Image (Optional)</label>
              <input type="file" name="profile_image" accept="image/*" />
            </div>
            <div className="form-group">
              <label>Services Offered (Select all that apply)</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, background: 'rgba(255,255,255,0.05)', padding: 15, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', margin: 0, fontWeight: 'normal', color: '#ddd' }}>
                  <input type="checkbox" name="services" value="Domestic Drilling" style={{ width: 'auto', marginBottom: 0 }} /> Domestic Drilling
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', margin: 0, fontWeight: 'normal', color: '#ddd' }}>
                  <input type="checkbox" name="services" value="Agricultural Drilling" style={{ width: 'auto', marginBottom: 0 }} /> Agricultural Drilling
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', margin: 0, fontWeight: 'normal', color: '#ddd' }}>
                  <input type="checkbox" name="services" value="Industrial Drilling" style={{ width: 'auto', marginBottom: 0 }} /> Industrial Drilling
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', margin: 0, fontWeight: 'normal', color: '#ddd' }}>
                  <input type="checkbox" name="services" value="Cleaning & Maintenance" style={{ width: 'auto', marginBottom: 0 }} /> Cleaning & Maintenance
                </label>
              </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Processing...' : 'Register Now'}
            </button>
          </form>

          <div className="auth-footer" style={{ marginTop: 20 }}>
            Already have an account? <Link to="/merchant-login">Login Here</Link>
          </div>
        </div>
      </div>
    </>
  )
}
