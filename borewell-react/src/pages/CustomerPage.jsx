import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import { Modal, useModal } from '../components/Modal'

export default function CustomerPage() {
  const [merchants, setMerchants] = useState([])
  const [loading, setLoading] = useState(true)
  const [locationLoading, setLocationLoading] = useState(false)
  const [search, setSearch] = useState('')
  const debounceRef = useRef(null)
  const navigate = useNavigate()
  const { modal, handleClose, customAlert, customConfirm } = useModal()

  const getMyBookings = () => {
    try { return JSON.parse(localStorage.getItem('my_bookings') || '[]') } catch { return [] }
  }

  const loadMerchants = async (location = '') => {
    setLoading(true)
    try {
      const url = location
        ? `/api/merchants?location=${encodeURIComponent(location.trim().toLowerCase())}`
        : '/api/merchants'
      const res = await fetch(url)
      const data = await res.json()
      setMerchants(data)
    } catch {
      setMerchants([])
    }
    setLoading(false)
  }

  // Sync bookings on mount
  useEffect(() => {
    const syncAndLoad = async () => {
      const myBookings = getMyBookings()
      if (myBookings.length > 0) {
        try {
          const res = await fetch('/api/public/bookings/verify-active', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookings: myBookings })
          })
          if (res.ok) {
            const data = await res.json()
            if (data.active) localStorage.setItem('my_bookings', JSON.stringify(data.active))
          }
        } catch { }
      }
      loadMerchants()
    }

    syncAndLoad()
    const interval = setInterval(syncAndLoad, 10000)
    return () => clearInterval(interval)
  }, [])

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      customAlert('Geolocation is not supported by your browser.')
      return
    }
    setLocationLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
            headers: { 'Accept-Language': 'en', 'User-Agent': 'BorewellMaster/1.0' }
          })
          const data = await res.json()
          const a = data.address || {}
          // Prioritize district/city for a broader search as requested by user
          const locationName = (a.state_district || a.county || a.city || a.district || a.town || '').trim()
          
          if (locationName) {
            setSearch(locationName)
            loadMerchants(locationName)
          } else {
            customAlert('Could not identify your specific area. Please type it manually.')
          }
        } catch (err) {
          customAlert('Failed to fetch location name. Check your internet connection.')
        }
        setLocationLoading(false)
      },
      () => {
        customAlert('Location access denied. Please enable it in your browser.')
        setLocationLoading(false)
      }
    )
  }

  const handleSearch = (e) => {
    const val = e.target.value
    setSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => loadMerchants(val), 500)
  }

  const cancelBooking = async (bookingId, merchantId) => {
    const confirmed = await customConfirm('Are you sure you want to cancel this booking?')
    if (!confirmed) return

    const myBookings = getMyBookings()
    const booking = myBookings.find(b => b.booking_id == bookingId)
    let mobile = booking?.mobile || ''

    if (!mobile) {
      mobile = prompt('Please enter the mobile number used for booking:')
    }
    if (!mobile) return

    try {
      const res = await fetch(`/api/public/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile })
      })
      const data = await res.json()

      if (res.ok || res.status === 404 || (res.status === 400 && data.error?.includes('already'))) {
        await customAlert(res.ok ? 'Booking cancelled successfully.' : (data.error || 'Booking removed.'))
        const updated = myBookings.filter(b => String(b.booking_id) !== String(bookingId))
        localStorage.setItem('my_bookings', JSON.stringify(updated))
        loadMerchants(search)
      } else {
        await customAlert('Cancellation failed: ' + (data.error || 'Unknown Error'))
      }
    } catch {
      await customAlert('Network Error')
    }
  }

  const getImgUrl = (m) => {
    if (!m.image_url) return '/image.png'
    return m.image_url.startsWith('data:') ? m.image_url : `/${m.image_url.replace(/\\/g, '/')}`
  }

  const renderActions = (m) => {
    const myBookings = getMyBookings()
    const booking = myBookings.find(b => b.merchant_id == m.id)

    if (booking) {
      return (
        <div style={{ marginTop: 15 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <button className="book-btn" style={{ background: '#555', cursor: 'default', flex: 1 }}>Booked</button>
            <button
              className="book-btn"
              style={{ background: 'red', flex: 1, fontSize: 12 }}
              onClick={() => cancelBooking(booking.booking_id, m.id)}
            >Cancel</button>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href={`tel:${m.mobile}`} className="book-btn" style={{ background: 'var(--primary)', fontSize: 12, padding: 8, flex: 1, textAlign: 'center' }}>
              <i className="fas fa-phone"></i> Call
            </a>
            <a href={`https://wa.me/91${m.mobile}`} target="_blank" rel="noreferrer" className="book-btn" style={{ background: '#25D366', fontSize: 12, padding: 8, flex: 1, textAlign: 'center' }}>
              <i className="fab fa-whatsapp"></i> WhatsApp
            </a>
          </div>
        </div>
      )
    }
    return (
      <button
        className="book-btn"
        onClick={() => navigate(`/booking?merchant_id=${m.id}&name=${encodeURIComponent(m.vehicle_name)}`)}
      >Book Now</button>
    )
  }

  return (
    <>
      <Modal modal={modal} onClose={handleClose} />
      <Navbar />
      <div className="page-container">
        <h1 style={{ textAlign: 'center', marginBottom: 20, fontFamily: 'var(--font-heading)' }}>Verified Merchants</h1>

        <div style={{ display: 'flex', gap: 10, maxWidth: 600, margin: '0 auto 40px auto', alignItems: 'stretch' }}>
          <div className="search-bar" style={{ position: 'relative', flex: 1, margin: 0 }}>
            <input
              type="text"
              value={search}
              onChange={handleSearch}
              placeholder="Search by city, town or district..."
              style={{ paddingRight: 40, width: '100%', height: '100%', borderRadius: 25 }}
            />
            <i className="fas fa-search" style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', opacity: 0.7 }}></i>
          </div>
          
          <button 
            onClick={handleGetLocation} 
            disabled={locationLoading}
            className="btn"
            title="Use Live Location"
            style={{ padding: '0 20px', borderRadius: 25, background: 'rgba(255, 102, 0, 0.2)', border: '1px solid var(--primary)', color: 'white', display: 'flex', alignItems: 'center', gap: 8, minWidth: 'max-content' }}
          >
            {locationLoading ? (
              <i className="fas fa-spinner fa-spin"></i>
            ) : (
              <>
                <i className="fas fa-crosshairs"></i>
                <span style={{ fontSize: 13 }}>Live Location</span>
              </>
            )}
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: 'center', width: '100%' }}>Loading merchants...</p>
        ) : merchants.length === 0 ? (
          <p style={{ textAlign: 'center', width: '100%' }}>No merchants found.</p>
        ) : (
          <div className="merchant-grid">
            {merchants.map(m => (
              <div className="merchant-card" key={m.id}>
                <img src={getImgUrl(m)} alt={m.vehicle_name} className="merchant-img" />
                <div className="merchant-body">
                  <h3 className="merchant-title">{m.vehicle_name}</h3>
                  <div className="merchant-detail"><i className="fas fa-user"></i> Owner: {m.owner_name}</div>
                  <div className="merchant-detail"><i className="fas fa-map-marker-alt"></i> {m.location}</div>
                  <div className="merchant-detail"><i className="fas fa-tools"></i> {m.services}</div>
                  <div className="merchant-detail"><i className="fas fa-phone"></i> {m.mobile}</div>
                  {renderActions(m)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
