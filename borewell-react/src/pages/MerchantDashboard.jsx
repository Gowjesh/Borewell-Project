import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Modal, useModal } from '../components/Modal'

const STATUS_COLORS = {
  PENDING: 'orange',
  CONFIRMED: '#6af',
  COMPLETED: 'lime',
  CANCELLED: 'red'
}

function getDayLabel(dateStr) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
  const diff = Math.round((d - today) / 86400000)
  if (diff === 0) return `Today (${dateStr})`
  if (diff === 1) return `Tomorrow (${dateStr})`
  if (diff === -1) return `Yesterday (${dateStr})`
  return dateStr
}

function escHtml(str) {
  if (!str) return ''
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default function MerchantDashboard() {
  const { user, logout, fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const { modal, handleClose, customAlert, customConfirm, customPrompt } = useModal()

  const [merchant, setMerchant] = useState(null)
  const [bookings, setBookings] = useState([])
  const [view, setView] = useState('profile')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ pending: 0, recent: 0 })
  const [menuOpen, setMenuOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [bookingSearch, setBookingSearch] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPayModal, setShowPayModal] = useState(null) // 'expired' | 'extend'
  const [showPaymentForm, setShowPaymentForm] = useState(null) // bookingId
  const [adminSettings, setAdminSettings] = useState({ fee: '2999', mobile: '' })
  const [subInfo, setSubInfo] = useState({ daysLeft: 0, pct: 0, color: 'lime' })
  const [editForm, setEditForm] = useState({})
  const [editPreview, setEditPreview] = useState('')
  const [availability, setAvailability] = useState(true)

  const mid = user?.user?.id

  // Redirect if not merchant
  useEffect(() => {
    if (!user || user.role !== 'merchant') navigate('/merchant-login')
  }, [user])

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      setAdminSettings({ fee: d.subscription_fee || '2999', mobile: d.admin_mobile || '' })
    }).catch(() => { })
  }, [])

  // Load merchant profile
  const loadProfile = useCallback(async () => {
    if (!mid) return
    try {
      const res = await fetchWithAuth(`/api/merchants/${mid}`)
      const data = await res.json()
      setMerchant(data)
      setAvailability(data.is_taking_bookings !== false)

      if (data.expiry_date) {
        const now = new Date();
        const exp = new Date(data.expiry_date);
        const diffMs = exp - now;
        const daysLeft = diffMs <= 0 ? 0 : Math.max(1, Math.ceil(diffMs / 86400000));
        const pct = Math.max(0, Math.min(100, (daysLeft / 30) * 100));
        const color = daysLeft > 10 ? '#2ecc71' : daysLeft > 5 ? 'orange' : 'red';
        setSubInfo({ daysLeft, pct, color });
        if (diffMs <= 0 || data.status !== 'ACTIVE') setShowPayModal('expired');
      }
    } catch { }
  }, [mid, fetchWithAuth])

  // Load bookings
  const loadBookings = useCallback(async (type) => {
    if (!mid) return
    setLoading(true)
    try {
      let url = `/api/bookings?merchant_id=${mid}`
      if (type === 'paid') url += '&status=COMPLETED&payment_status=FULLY_PAID'
      if (type === 'not_paid') url += '&status=COMPLETED&payment_status_not=FULLY_PAID'
      if (type === 'cancelled') url += '&status=CANCELLED'

      const res = await fetchWithAuth(url)
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setBookings(data)

      if (type === 'pending') {
        const pending = data.filter(b => b.status === 'PENDING').length
        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
        const recent = data.filter(b => new Date(b.date) >= weekAgo).length
        setStats({ pending, recent })
      }
    } catch { }
    setLoading(false)
  }, [mid, fetchWithAuth])

  useEffect(() => {
    setView('profile')
    loadProfile()
  }, [loadProfile])

  useEffect(() => {
    if (view !== 'profile') loadBookings(view)
    else loadBookings('pending')
  }, [view, loadBookings])

  const handleLogout = async () => {
    const ok = await customConfirm('Are you sure you want to logout?')
    if (ok) { logout(); navigate('/') }
  }

  const toggleStatus = async () => {
    const newStatus = !availability
    try {
      const res = await fetchWithAuth(`/api/merchants/${mid}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_taking_bookings: newStatus })
      })
      if (res.ok) setAvailability(newStatus)
      else await customAlert('Failed to update status')
    } catch { }
  }

  const updateStatus = async (bookingId, newStatus) => {
    let body = { status: newStatus }
    const texts = { CONFIRMED: 'confirm', CANCELLED: 'cancel', COMPLETED: 'complete' }
    const ok = await customConfirm(`Are you sure you want to ${texts[newStatus] || 'update'} this booking?`)
    if (!ok) return

    if (newStatus === 'CANCELLED') {
      return removeBooking(bookingId)
    }

    if (newStatus === 'COMPLETED') {
      const amt = await customPrompt('Enter Total Amount (₹):', 'number', '')
      if (amt !== null && amt !== '') {
        const confirmAmt = await customConfirm(`Total bill: ₹${amt}. Are you sure this is correct?`)
        if (!confirmAmt) return
        body.total_amount = parseFloat(amt)
      }

      const depth = await customPrompt('Enter Drill Depth (meters):', 'number', '')
      if (depth !== null && depth !== '') body.drill_depth = depth
    }

    try {
      const res = await fetchWithAuth(`/api/bookings/${bookingId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (res.ok) loadBookings(view)
      else { const d = await res.json(); await customAlert(d.error || 'Failed') }
    } catch { }
  }

  const updateDate = async (bookingId, currentDate) => {
    const newDate = await customPrompt('Enter new date (YYYY-MM-DD):', 'date', currentDate)
    if (!newDate) return
    try {
      const res = await fetchWithAuth(`/api/bookings/${bookingId}/date`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newDate })
      })
      if (res.ok) loadBookings(view)
      else await customAlert('Failed to update date')
    } catch { }
  }

  const removeBooking = async (id) => {
    const ok = await customConfirm('Remove this booking record from history?')
    if (!ok) return
    try {
      await fetchWithAuth(`/api/bookings/${id}`, { method: 'DELETE' })
      loadBookings(view)
    } catch { }
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    try {
      const res = await fetchWithAuth(`/api/merchants/${mid}`, { method: 'PUT', body: formData })
      if (res.ok) {
        await customAlert('Profile updated!')
        setShowEditModal(false)
        loadProfile()
      } else {
        const d = await res.json()
        await customAlert(d.error || 'Failed to update')
      }
    } catch { }
  }

  const openEditModal = () => {
    if (!merchant) return
    setEditForm({
      owner_name: merchant.owner_name || '',
      vehicle_name: merchant.vehicle_name || '',
      mobile: merchant.mobile || '',
      location: merchant.location || '',
      services: merchant.services || ''
    })
    const imgSrc = merchant.image_url
      ? (merchant.image_url.startsWith('data:') ? merchant.image_url : `/${merchant.image_url}`)
      : '/logo.png'
    setEditPreview(imgSrc)
    setShowEditModal(true)
  }

  const handlePaySubscription = async () => {
    if (!merchant || !window.Razorpay) {
      await customAlert('Payment gateway not available.')
      return
    }
    try {
      const res = await fetchWithAuth(`/api/merchants/${mid}/subscription-pay/order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
      })
      const orderData = await res.json()
      if (!res.ok) throw new Error(orderData.error || 'Order creation failed.')

      const options = {
        key: orderData.key, amount: orderData.amount, currency: orderData.currency,
        name: 'Borewell Master', description: 'Monthly Subscription', order_id: orderData.id,
        handler: async (response) => {
          try {
            const verifyRes = await fetchWithAuth(`/api/merchants/${mid}/subscription-pay/verify`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response)
            })
            const result = await verifyRes.json()
            if (verifyRes.ok) {
              await customAlert('Subscription Paid Successfully!')
              setShowPayModal(null)
              loadProfile()
            } else {
              await customAlert('Verification failed: ' + (result.error || 'Unknown error'))
            }
          } catch { await customAlert('Failed to verify payment.') }
        },
        prefill: { name: merchant.owner_name, email: merchant.email, contact: merchant.mobile },
        theme: { color: '#FF6600' }
      }
      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) { await customAlert(err.message || 'Failed to initiate payment') }


  }

  const handleAddPayment = async (e) => {
    e.preventDefault()
    const fd = new FormData(e.target)
    const amountEntered = parseFloat(fd.get('amount'))
    const note = fd.get('note')
    const date = fd.get('date')

    const b = bookings.find(x => x.id === showPaymentForm)
    if (!b) return

    const hist = (() => { try { return typeof b.payment_history === 'string' ? JSON.parse(b.payment_history) : (b.payment_history || []) } catch { return [] } })()
    const totalPaid = hist.reduce((s, p) => s + parseFloat(p.amount || 0), 0)
    const totalBill = parseFloat(b.total_amount) || 0

    if (amountEntered + totalPaid > totalBill) {
      return await customAlert('you enter extra amount correct it')
    }

    const ok = await customConfirm(`Entered amount: ₹${amountEntered}. Are you sure this is correct?`)
    if (!ok) return

    try {
      const res = await fetchWithAuth(`/api/bookings/${showPaymentForm}/payment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: amountEntered, note, date })
      })
      if (res.ok) {
        await customAlert('Payment recorded!')
        setShowPaymentForm(null)
        loadBookings(view)
      } else {
        const d = await res.json()
        await customAlert(d.error || 'Failed')
      }
    } catch { }
  }

  // Filtered + sorted bookings
  const filtered = bookings.filter(b => {
    if (view === 'pending') return b.status === 'PENDING'
    if (view === 'confirmed') return b.status === 'CONFIRMED'
    if (view === 'paid') return b.status === 'COMPLETED' && b.payment_status === 'FULLY_PAID'
    if (view === 'not_paid') return b.status === 'COMPLETED' && b.payment_status !== 'FULLY_PAID'
    return false
  }).filter(b => {
    const s = bookingSearch.toLowerCase()
    return b.customer_name?.toLowerCase().includes(s) ||
      b.customer_address?.toLowerCase().includes(s) ||
      String(b.customer_mobile || '').includes(s)
  }).sort((a, b) =>
    (view === 'pending' || view === 'confirmed')
      ? new Date(a.date) - new Date(b.date)
      : new Date(b.date) - new Date(a.date)
  )

  // Group pending/confirmed by date
  const grouped = {}
  if (view === 'pending' || view === 'confirmed') {
    filtered.forEach(b => {
      if (!grouped[b.date]) grouped[b.date] = []
      grouped[b.date].push(b)
    })
  }

  const [viewHistory, setViewHistory] = useState(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)

  const imgSrc = merchant?.image_url
    ? (merchant.image_url.startsWith('data:') ? merchant.image_url : `/${merchant.image_url}`)
    : '/logo.png'

  const sectionTitles = {
    pending: 'New Booking Requests', confirmed: 'Confirmed Tasks',
    paid: 'Paid History', not_paid: 'Pending Payments',
    profile: 'Merchant Profile'
  }

  const BookingCard = ({ b }) => {
    const isPending = b.status === 'PENDING'
    const isConfirmed = b.status === 'CONFIRMED'
    const isHistory = !isPending && !isConfirmed
    const statusColor = STATUS_COLORS[b.status] || 'white'

    let displayAddress = b.customer_address || ''
    let metaLoc = b.merchant_location
    let metaDepth = b.drill_depth
    if (displayAddress.includes('||--META--||')) {
      const parts = displayAddress.split('||--META--||')
      displayAddress = parts[0].trim()
      try {
        const metaObj = JSON.parse(parts[1].trim())
        if (!metaLoc && metaObj.merchant_location) metaLoc = metaObj.merchant_location
        if (!metaDepth && metaObj.drill_depth) metaDepth = metaObj.drill_depth
      } catch (e) { }
    }

    let paymentHtml = null
    const hist = (() => { try { return typeof b.payment_history === 'string' ? JSON.parse(b.payment_history) : (b.payment_history || []) } catch { return [] } })()
    const totalPaid = hist.reduce((s, p) => s + parseFloat(p.amount || 0), 0)
    const totalBill = parseFloat(b.total_amount) || 0

    if (b.status === 'COMPLETED') {
      paymentHtml = (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: b.payment_status === 'FULLY_PAID' ? 'rgba(0,255,0,0.15)' : 'rgba(255,165,0,0.15)', color: b.payment_status === 'FULLY_PAID' ? 'lime' : 'orange', border: `1px solid ${b.payment_status === 'FULLY_PAID' ? 'lime' : 'orange'}` }}>
              {b.payment_status === 'FULLY_PAID' ? '✓ Paid' : 'Payment Pending'}
            </span>
            {b.payment_status !== 'FULLY_PAID' && (
              <button onClick={() => setShowPaymentForm(b.id)} className="btn" style={{ padding: '2px 8px', fontSize: 11, background: 'var(--primary)', color: 'white' }}>
                + Add Payment
              </button>
            )}
            <button onClick={() => { setViewHistory(b); setShowHistoryModal(true) }} className="btn" style={{ padding: '2px 6px', fontSize: 14, background: 'rgba(255,255,255,0.1)', color: 'white' }} title="View Payment Details">
              <i className="fas fa-info-circle"></i>
            </button>
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)', marginTop: 5 }}>
            Bill: ₹{totalBill} &nbsp;|&nbsp; Paid: ₹{totalPaid} &nbsp;|&nbsp; <span style={{ color: totalBill - totalPaid > 0 ? 'var(--danger)' : 'var(--success)' }}>Rem: ₹{totalBill - totalPaid}</span>
          </div>

          {metaDepth && (
            <div style={{ marginTop: 8, fontSize: 12, color: '#ddd', paddingTop: 8, borderTop: '1px dashed rgba(255,255,255,0.1)' }}>
              <div><strong>Depth:</strong> {metaDepth} meters</div>
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="booking-card" style={{ background: 'rgba(0,0,0,0.3)', borderLeft: `4px solid ${statusColor}`, borderRadius: 12, padding: 20, marginBottom: 15, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ marginBottom: 5 }}>{b.customer_name}</h4>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
            <i className="fas fa-calendar" style={{ color: 'var(--primary)', marginRight: 6 }}></i>{b.date} &nbsp;|&nbsp;
            <i className="fas fa-phone" style={{ color: 'var(--primary)', marginRight: 6 }}></i>{b.customer_mobile}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, marginTop: 5 }}>
            <a href={`tel:${b.customer_mobile}`} style={{ textDecoration: 'none', color: 'var(--success)', border: '1px solid var(--success)', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
              <i className="fas fa-phone"></i> Call
            </a>
            <a href={`https://wa.me/91${b.customer_mobile}?text=${encodeURIComponent(`Hello ${b.customer_name}, this is regarding your Borewell booking for ${b.date}.\n\nAddress: ${b.customer_address}`)}`}
              target="_blank" rel="noreferrer"
              style={{ textDecoration: 'none', color: 'var(--success)', border: '1px solid var(--success)', padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>
              <i className="fab fa-whatsapp"></i> WhatsApp
            </a>
          </div>
          <div style={{ fontSize: 13, color: '#ccc', marginBottom: 8 }}>
            <strong>Address:</strong> {displayAddress}<br />
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayAddress)}`}
              target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', fontSize: 12, marginTop: 4, display: 'inline-block' }}>
              <i className="fas fa-map-marker-alt"></i> View on Google Maps
            </a>
          </div>
          {paymentHtml}
        </div>

        {/* Footer actions - Neatly Arranged */}
        <div style={{ width: '100%', marginTop: 20, paddingTop: 15, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 15 }}>
          <div style={{ fontSize: 13, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <span className={`status-${b.status}`} style={{ opacity: 1, textTransform: 'uppercase', letterSpacing: 1 }}>{b.status}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {isPending && <>
              <button onClick={() => updateStatus(b.id, 'CONFIRMED')} className="btn" style={{ padding: '6px 12px', fontSize: 13, background: '#3498db', color: '#fff' }}><i className="fas fa-check"></i> Confirm</button>
              <button onClick={() => updateDate(b.id, b.date)} className="btn" style={{ padding: '6px 12px', fontSize: 13, background: '#9b59b6', color: '#fff' }}><i className="fas fa-edit"></i> Reschedule</button>
              <button onClick={() => updateStatus(b.id, 'CANCELLED')} className="btn" style={{ padding: '6px 12px', fontSize: 13, background: 'var(--danger)', color: '#fff' }}><i className="fas fa-times"></i> Cancel</button>
            </>}
            {isConfirmed && <>
              <button onClick={() => updateStatus(b.id, 'COMPLETED')} className="btn" style={{ padding: '6px 12px', fontSize: 13, background: 'var(--success)', color: '#fff' }}><i className="fas fa-check-double"></i> Complete</button>
              <button onClick={() => updateDate(b.id, b.date)} className="btn" style={{ padding: '6px 12px', fontSize: 13, background: '#9b59b6', color: '#fff' }}><i className="fas fa-edit"></i> Reschedule</button>
              <button onClick={() => updateStatus(b.id, 'CANCELLED')} className="btn" style={{ padding: '6px 12px', fontSize: 13, background: 'var(--danger)', color: '#fff' }}><i className="fas fa-times"></i> Cancel</button>
            </>}
            {isHistory && (
              <button onClick={() => removeBooking(b.id)} className="btn" style={{ padding: '6px 12px', fontSize: 13, background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className="fas fa-trash"></i> Remove
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <>
      <Modal modal={modal} onClose={handleClose} />

      {/* Payment History Modal */}
      {showHistoryModal && viewHistory && (
        <div className="modal-overlay" style={{ zIndex: 99999 }}>
          <div className="modal-box" style={{ maxWidth: 550, width: '90%' }}>
            <h3 style={{ marginBottom: 20 }}>Payment Process (History)</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', color: 'white', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: 10, textAlign: 'left' }}>Date</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>Amount</th>
                    <th style={{ padding: 10, textAlign: 'left' }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {(typeof viewHistory.payment_history === 'string' ? JSON.parse(viewHistory.payment_history) : (viewHistory.payment_history || [])).map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: 10 }}>{new Date(p.date).toLocaleDateString()}</td>
                      <td style={{ padding: 10, fontWeight: 'bold', color: 'lime' }}>₹{p.amount}</td>
                      <td style={{ padding: 10, opacity: 0.8 }}>{p.note || '-'}</td>
                    </tr>
                  ))}
                  <tr style={{ background: 'rgba(255,102,0,0.1)' }}>
                    <td colSpan="3" style={{ padding: 10, textAlign: 'right', fontWeight: 'bold' }}>
                      Grand Total Paid: ₹{(typeof viewHistory.payment_history === 'string' ? JSON.parse(viewHistory.payment_history) : (viewHistory.payment_history || [])).reduce((s, p) => s + parseFloat(p.amount || 0), 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <button onClick={() => setShowHistoryModal(false)} className="btn btn-primary" style={{ width: '100%' }}>Close History</button>
            </div>
          </div>
        </div>
      )}
      {showPayModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'white' }}>
          <div style={{ maxWidth: 450, padding: 30, background: 'rgba(255,255,255,0.05)', borderRadius: 16, border: '1px solid rgba(255,102,0,0.3)' }}>
            <i className="fas fa-lock" style={{ fontSize: 48, color: 'var(--primary)', marginBottom: 20 }}></i>
            <h2 style={{ fontFamily: 'var(--font-heading)', marginBottom: 15 }}>
              {showPayModal === 'expired' ? 'SUBSCRIPTION EXPIRED' : 'EXTEND SUBSCRIPTION'}
            </h2>
            <p style={{ opacity: 0.8, marginBottom: 20 }}>
              {showPayModal === 'expired'
                ? 'Your subscription has expired. Renew to continue managing bookings.'
                : 'Extend your subscription to keep accepting new bookings.'}
            </p>
            <div style={{ background: 'rgba(255,102,0,0.1)', border: '1px solid rgba(255,102,0,0.3)', borderRadius: 10, padding: 20, marginBottom: 25 }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--primary)' }}>₹{adminSettings.fee}</div>
              <div style={{ opacity: 0.7 }}>/ 30 days</div>
            </div>
            <button onClick={handlePaySubscription} className="btn btn-primary" style={{ width: '100%', marginBottom: 10 }}>
              <i className="fas fa-credit-card"></i> Pay Now (Razorpay)
            </button>
            <p style={{ fontSize: 13, opacity: 0.7, marginTop: 15 }}>
              Issue with payment? <br />
              {adminSettings.mobile && (
                <>Contact Admin: <a href={`tel:${adminSettings.mobile}`} style={{ color: 'var(--primary)', fontWeight: 'bold' }}>{adminSettings.mobile}</a></>
              )}
            </p>
            {showPayModal === 'extend' && (
              <button onClick={() => setShowPayModal(null)} className="btn btn-outline" style={{ width: '100%', marginTop: 10 }}>Close</button>
            )}
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1a1a', padding: 30, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', width: '90%', maxWidth: 450, maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 20 }}>Edit Profile</h3>
            <form onSubmit={handleEditSubmit} encType="multipart/form-data">
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <img src={editPreview} alt="Preview" style={{ width: 100, height: 100, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--primary)' }} />
                <br />
                <label htmlFor="edit_profile_image" className="btn btn-outline" style={{ fontSize: 12, marginTop: 10, cursor: 'pointer', display: 'inline-block' }}>Change Photo</label>
                <input type="file" id="edit_profile_image" name="profile_image" style={{ display: 'none' }} accept="image/*"
                  onChange={e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = ev => setEditPreview(ev.target.result); r.readAsDataURL(f) } }} />
              </div>
              {[['owner_name', 'Owner Name'], ['vehicle_name', 'Business Name'], ['mobile', 'Mobile'], ['location', 'Location'], ['services', 'Services']].map(([k, label]) => (
                <div className="form-group" key={k} style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 13, marginBottom: 5, display: 'block' }}>{label}</label>
                  <input type="text" name={k} value={editForm[k] || ''} onChange={e => setEditForm(f => ({ ...f, [k]: e.target.value }))} required style={{ width: '100%', padding: 10, background: '#333', border: '1px solid #444', color: 'white', borderRadius: 5 }} />
                </div>
              ))}
              <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.1)', margin: '15px 0' }} />
              <label style={{ color: 'var(--primary)', fontSize: 13 }}>Change Password (Optional)</label>
              <input type="text" name="password" placeholder="Enter new password" style={{ width: '100%', padding: 10, background: '#333', border: '1px solid #444', color: 'white', borderRadius: 5, marginTop: 8, marginBottom: 15 }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Changes</button>
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showPaymentForm && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1a1a', padding: 30, borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', width: '90%', maxWidth: 400 }}>
            <h3 style={{ marginBottom: 20 }}>Add Payment</h3>
            <form onSubmit={handleAddPayment}>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 13 }}>Amount (₹)</label>
                <input type="number" name="amount" required style={{ width: '100%', padding: 10, background: '#333', border: '1px solid #444', color: 'white', borderRadius: 5 }} />
              </div>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 13 }}>Note</label>
                <input type="text" name="note" placeholder="e.g. UPI Ref 1234..." style={{ width: '100%', padding: 10, background: '#333', border: '1px solid #444', color: 'white', borderRadius: 5 }} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 13 }}>Payment Date</label>
                <input type="date" name="date" defaultValue={new Date().toISOString().split('T')[0]} required style={{ width: '100%', padding: 10, background: '#333', border: '1px solid #444', color: 'white', borderRadius: 5 }} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Record Payment</button>
                <button type="button" onClick={() => setShowPaymentForm(null)} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav>
        <div className="logo" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>Borewell<span>Master</span></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
          <a href={`tel:${adminSettings.mobile || '8838618185'}`}
            style={{ cursor: 'pointer', color: 'var(--primary)', textDecoration: 'none', fontSize: 18, marginRight: 10 }}
            title="Contact Admin"
          >
            <i className="fas fa-headset"></i>
          </a>
          <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}><i className="fas fa-bars"></i></button>
        </div>
        <div className={`nav-links ${menuOpen ? 'active' : ''}`}>
          {merchant && (
            <span className="desktop-only" style={{ marginRight: 20, opacity: 0.8, fontSize: 14 }}>Welcome, {merchant.owner_name}</span>
          )}
          {[
            { label: 'New Requests', key: 'pending' },
            { label: 'Confirmed', key: 'confirmed' },
          ].map(({ label, key }) => (
            <a key={key} onClick={() => { setView(key); setMenuOpen(false) }} style={{ cursor: 'pointer' }}>{label}</a>
          ))}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <a onClick={() => setHistoryOpen(!historyOpen)} style={{ cursor: 'pointer' }}>History {historyOpen ? '▴' : '▾'}</a>
            {historyOpen && (
              <div style={{ position: 'absolute', top: '100%', right: 0, background: '#1a2634', borderRadius: 8, padding: '5px 0', minWidth: 150, zIndex: 100, border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                {[['paid', 'Paid'], ['not_paid', 'Pending Payment']].map(([k, l]) => (
                  <a key={k} onClick={() => { setView(k); setMenuOpen(false); setHistoryOpen(false) }} style={{ display: 'block', padding: '8px 15px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{l}</a>
                ))}
              </div>
            )}
          </div>
          <button onClick={toggleStatus} className="btn" style={{ padding: '5px 15px', fontWeight: 'bold', background: availability ? 'rgba(0,200,0,0.15)' : 'rgba(255,0,0,0.15)', border: `1px solid ${availability ? 'lime' : 'red'}`, color: availability ? 'lime' : 'red' }}>
            {availability ? '● Online' : '● Offline'}
          </button>
          <a onClick={() => { setView('profile'); setMenuOpen(false) }} style={{ cursor: 'pointer' }}><i className="fas fa-user"></i> Profile</a>
          <a onClick={() => { setShowPayModal('extend'); setMenuOpen(false) }} style={{ cursor: 'pointer', color: '#2ecc71' }}><i className="fas fa-credit-card"></i> Subscription</a>
          <a href={`tel:${adminSettings.mobile}`} onClick={() => setMenuOpen(false)} style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: 'bold' }}>
            <i className="fas fa-headset"></i> Contact Admin
          </a>
          <a onClick={handleLogout} className="btn btn-outline" style={{ padding: '5px 15px', color: '#ff4444', borderColor: '#ff4444' }}>Logout</a>
        </div>
      </nav>

      <div className="dashboard-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 15 }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 28 }}>{sectionTitles[view]}</h2>
          {view !== 'profile' && (
            <div style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
              <input
                type="text"
                placeholder="Search by customer or location..."
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                style={{ width: '100%', padding: '10px 15px 10px 40px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 25, color: 'white', fontSize: 13 }}
              />
              <i className="fas fa-search" style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}></i>
            </div>
          )}
          <div style={{ display: 'flex', gap: 15 }}>
            <div className="glass-panel" style={{ padding: '10px 20px', textAlign: 'center', minWidth: 120 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Pending Tasks</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: 'var(--primary)' }}>{stats.pending}</div>
            </div>
            <div className="glass-panel" style={{ padding: '10px 20px', textAlign: 'center', minWidth: 120 }}>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Recent (7d)</div>
              <div style={{ fontSize: 24, fontWeight: 'bold', color: '#2ecc71' }}>{stats.recent}</div>
            </div>
          </div>
        </div>

        {/* Profile View */}
        {view === 'profile' && merchant && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="profile-card" style={{ maxWidth: 450, width: '100%' }}>
              <img src={imgSrc} alt="Profile" className="profile-img" />
              <h3 style={{ marginBottom: 2, wordBreak: 'break-word' }}>{merchant.owner_name}</h3>
              <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 15, wordBreak: 'break-word' }}>{merchant.vehicle_name}</p>
              <p style={{ color: '#aaa', wordBreak: 'break-word' }}>{merchant.location}</p>
              <div className="profile-detail">
                <div style={{ wordBreak: 'break-all' }}><i className="fas fa-phone"></i> <span>{merchant.mobile}</span></div>
                <div style={{ wordBreak: 'break-all' }}><i className="fas fa-envelope"></i> <span>{merchant.email}</span></div>
                <div style={{ wordBreak: 'break-word' }}><i className="fas fa-tools"></i> <span>{merchant.services}</span></div>
              </div>
              <div style={{ marginTop: 15, marginBottom: 20 }}>
                <div style={{ fontSize: 12, marginBottom: 5, display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ opacity: 0.7 }}>Subscription</span>
                  <span style={{ fontWeight: 'bold', color: subInfo.color }}>
                    {subInfo.daysLeft > 0 ? `${subInfo.daysLeft} Days Left` : 'Expired'}
                  </span>
                </div>
                <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', height: 6, borderRadius: 3 }}>
                  <div style={{ width: `${subInfo.pct}%`, height: '100%', background: subInfo.color, borderRadius: 3, transition: 'width 0.5s' }}></div>
                </div>
              </div>
              <button onClick={openEditModal} className="btn btn-primary" style={{ width: '100%', marginTop: 20 }}>Edit Profile</button>
            </div>
          </div>
        )}

        {/* Bookings View */}
        {view !== 'profile' && (
          loading ? (
            <p style={{ textAlign: 'center', padding: 20, color: '#aaa' }}>Loading...</p>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: 'center', padding: 20, color: '#aaa' }}>
              {view === 'pending' ? 'No new booking requests.' :
                view === 'confirmed' ? 'No confirmed bookings.' :
                  view === 'paid' ? 'No paid bookings found.' :
                    'No pending payments found.'}
            </p>
          ) : (view === 'pending' || view === 'confirmed') ? (
            Object.entries(grouped).map(([date, bks]) => (
              <div key={date}>
                <h3 style={{ margin: '20px 0 10px', color: 'var(--primary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 5 }}>
                  {getDayLabel(date)} <span style={{ fontSize: 12, color: '#aaa', fontWeight: 'normal' }}>({bks.length} bookings)</span>
                </h3>
                {bks.map(b => <BookingCard key={b.id} b={b} />)}
              </div>
            ))
          ) : (
            filtered.map(b => <BookingCard key={b.id} b={b} />)
          )
        )}
      </div>
    </>
  )
}
