import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { Modal, useModal } from '../components/Modal'

export default function BookingPage() {
  const [searchParams] = useSearchParams()
  const merchantId = searchParams.get('merchant_id')
  const merchantNameParam = searchParams.get('name')

  const [merchantName, setMerchantName] = useState(merchantNameParam || 'Loading...')
  const [msg, setMsg] = useState(null)
  const [loading, setLoading] = useState(false)
  const [locationLoading, setLocationLoading] = useState(false)
  const [address, setAddress] = useState('')
  const navigate = useNavigate()
  const { modal, handleClose, customAlert } = useModal()

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (!merchantId) {
      customAlert('No merchant selected!').then(() => navigate('/find-merchants'))
      return
    }

    fetch(`/api/merchants/${merchantId}`)
      .then(r => r.json())
      .then(async m => {
        const now = new Date()
        const expiry = new Date(m.expiry_date)
        if (m.status !== 'ACTIVE' || expiry < now || !m.is_taking_bookings) {
          await customAlert('This merchant is currently unavailable for bookings (Subscription expired or offline).')
          navigate('/find-merchants')
        } else {
          setMerchantName(m.vehicle_name)
        }
      })
      .catch(() => {})
  }, [merchantId])

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser.')
      return
    }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng } = position.coords
        let locationText = `Coordinates: ${lat}, ${lng}`
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          )
          const data = await res.json()
          if (data.display_name) locationText = data.display_name
        } catch {}
        setAddress(prev => prev ? `${prev}\n\n${locationText}` : locationText)
        setLocationLoading(false)
      },
      () => {
        customAlert('Unable to retrieve your location. Please check your location permissions.')
        setLocationLoading(false)
      }
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMsg(null)

    const formData = new FormData(e.target)
    const data = Object.fromEntries(formData.entries())
    data.customer_address = address

    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      const result = await res.json()

      if (res.ok) {
        // Save booking to localStorage
        const myBookings = JSON.parse(localStorage.getItem('my_bookings') || '[]')
        myBookings.push({ merchant_id: data.merchant_id, booking_id: result.id, mobile: data.customer_mobile })
        localStorage.setItem('my_bookings', JSON.stringify(myBookings))

        let successHtml = result.message || 'Booking request sent.'
        setMsg({ type: 'success', html: successHtml, merchantMobile: result.merchant_mobile, bookingData: data })

        setTimeout(() => navigate('/find-merchants'), 4000)
      } else {
        if (result.type === 'LIMIT_REACHED' && result.suggestions?.length > 0) {
          setMsg({ type: 'slot_full', suggestions: result.suggestions, error: result.error })
        } else {
          setMsg({ type: 'error', text: result.error })
        }
      }
    } catch {
      setMsg({ type: 'error', text: 'System Error. Please try again.' })
    }
    setLoading(false)
  }

  return (
    <>
      <Modal modal={modal} onClose={handleClose} />
      <Navbar />
      <div className="page-container-center">
        <div className="booking-box">
          <div className="booking-header">
            <h2 style={{ fontFamily: 'var(--font-heading)' }}>Confirm Booking</h2>
            <div className="merchant-badge">Merchant: {merchantName}</div>
          </div>

          {msg?.type === 'success' && (
            <div className="msg-success">
              <div>{msg.html}</div>
              {msg.merchantMobile && (
                <div style={{ marginTop: 15 }}>
                  <a href={`tel:${msg.merchantMobile}`} className="btn btn-primary" style={{ display: 'inline-block', marginRight: 10 }}>
                    <i className="fas fa-phone"></i> Call Merchant
                  </a>
                  <a
                    href={`https://wa.me/91${msg.merchantMobile}?text=${encodeURIComponent(
                      `Hello, I have just booked an appointment with you via Borewell Master.\n\nName: ${msg.bookingData?.customer_name}\nDate: ${msg.bookingData?.date}\nAddress: ${msg.bookingData?.customer_address}`
                    )}`}
                    target="_blank" rel="noreferrer"
                    className="btn btn-primary"
                    style={{ display: 'inline-block', backgroundColor: '#25D366' }}
                  >
                    <i className="fab fa-whatsapp"></i> WhatsApp
                  </a>
                </div>
              )}
              <p style={{ marginTop: 10, color: '#aaa', fontSize: 13 }}>Redirecting back to merchants in 4 seconds...</p>
            </div>
          )}

          {msg?.type === 'error' && <div className="msg-error">{msg.text}</div>}

          {msg?.type === 'slot_full' && (
            <div className="msg-error">
              <strong>Slot Full!</strong> The merchant is fully booked for this date.<br />Try these available dates:<br />
              <div style={{ marginTop: 10, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                {msg.suggestions.map(d => (
                  <button key={d} type="button" className="btn" style={{ background: 'white', color: 'black', fontSize: 12, padding: '5px 10px' }}
                    onClick={() => { document.getElementById('datePicker').value = d; setMsg(null) }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msg?.type !== 'success' && (
            <form onSubmit={handleSubmit}>
              <input type="hidden" name="merchant_id" value={merchantId || ''} />

              <div className="form-group">
                <label>Your Name</label>
                <input type="text" name="customer_name" required placeholder="Enter your full name" />
              </div>
              <div className="form-group">
                <label>Mobile Number</label>
                <input type="tel" name="customer_mobile" required placeholder="For contact" pattern="[0-9]{10}" />
              </div>
              <div className="form-group">
                <label>Email Address (For Receipt)</label>
                <input type="email" name="customer_email" required placeholder="Ex: you@example.com" />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Service Address</span>
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={locationLoading}
                    className="btn btn-outline"
                    style={{ padding: '4px 8px', fontSize: 12, background: 'rgba(255,102,0,0.2)', borderColor: 'var(--primary)', color: 'white' }}
                  >
                    <i className={`fas ${locationLoading ? 'fa-spinner fa-spin' : 'fa-map-marker-alt'}`}></i>
                    {locationLoading ? ' Getting...' : ' Get Live Location'}
                  </button>
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Where do you need the borewell?"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Date of Service</label>
                <input type="date" name="date" id="datePicker" required min={today} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                {loading ? 'Checking Availability...' : 'Book Appointment'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
