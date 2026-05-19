import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Modal, useModal } from '../components/Modal'

const STATUS_COLORS = {
  PENDING: 'orange', CONFIRMED: '#6af', COMPLETED: 'lime', CANCELLED: 'red'
}

const inputStyle = { width: '100%', padding: 10, background: '#333', border: '1px solid #444', color: 'white', borderRadius: 5, marginBottom: 0 }

export default function AdminDashboard() {
  const { user, logout, fetchWithAuth } = useAuth()
  const navigate = useNavigate()
  const { modal, handleClose, customAlert, customConfirm, customPrompt } = useModal()

  const [section, setSection] = useState('merchants')
  const [analytics, setAnalytics] = useState({ totalMerchants: 0, activeMerchants: 0, expiredMerchants: 0, totalBookings: 0 })
  const [merchants, setMerchants] = useState([])
  const [merchantFilter, setMerchantFilter] = useState('all') // 'all' | 'active' | 'expired'
  const [bookings, setBookings] = useState([])
  const [bookingFilter, setBookingFilter] = useState('PENDING')
  const [loading, setLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAddDays, setShowAddDays] = useState(false)
  const [settings, setSettings] = useState({ subscription_fee: '', admin_mobile: '' })
  const [menuOpen, setMenuOpen] = useState(false)
  const [bulkDays, setBulkDays] = useState('30')
  const [bulkNote, setBulkNote] = useState('Happy New Year Gift!')
  const [viewMerchantBookings, setViewMerchantBookings] = useState(null)
  const [merchantSearch, setMerchantSearch] = useState('')

  useEffect(() => {
    if (!user || user.role !== 'admin') navigate('/merchant-login')
  }, [user])

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/analytics/admin')
      const data = await res.json()
      setAnalytics(data)
    } catch { }
  }, [fetchWithAuth])

  const loadMerchants = useCallback(async () => {
    setLoading(true)
    try {
      // Add t parameter for cache-busting
      const res = await fetchWithAuth(`/api/admin/merchants?t=${Date.now()}`)
      const data = await res.json()
      setMerchants(Array.isArray(data) ? data : [])
    } catch { }
    setLoading(false)
  }, [fetchWithAuth])

  const loadBookings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchWithAuth('/api/bookings')
      const data = await res.json()
      setBookings(Array.isArray(data) ? data : [])
    } catch { }
    setLoading(false)
  }, [fetchWithAuth])

  useEffect(() => {
    loadAnalytics()
    loadMerchants()
    loadBookings()
  }, [loadAnalytics, loadMerchants, loadBookings])

  const handleLogout = async () => {
    const ok = await customConfirm('Are you sure you want to logout?')
    if (ok) { logout(); navigate('/') }
  }

  const renewMerchant = async (id) => {
    const days = await customPrompt('How many days to add for this subscription?', 'number', '30')
    if (!days || isNaN(days)) return

    try {
      const res = await fetchWithAuth(`/api/merchants/${id}/renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: parseInt(days) })
      })
      if (res.ok) {
        const result = await res.json()
        await customAlert(result.message || `Renewed successfully for ${days} days!`)
        // Add a slight delay to ensure DB propagation
        setTimeout(() => {
          loadMerchants()
          loadAnalytics()
        }, 500)
      } else {
        const d = await res.json()
        await customAlert(d.error || 'Failed to renew')
      }
    } catch (err) {
      await customAlert('Communication Error: ' + err.message)
    }
  }

  const deleteMerchant = async (id) => {
    const ok = await customConfirm('Are you sure you want to DELETE this merchant permanently?')
    if (!ok) return
    try {
      const res = await fetchWithAuth(`/api/merchants/${id}`, { method: 'DELETE' })
      if (res.ok) { 
        await customAlert('Merchant deleted.'); 
        setTimeout(() => {
          loadMerchants(); 
          loadAnalytics();
        }, 500);
      }
      else {
        const d = await res.json()
        await customAlert(d.error || 'Failed to delete merchant')
      }
    } catch (err) {
      await customAlert('Communication Error: ' + err.message)
    }
  }

  const deleteBooking = async (id) => {
    const ok = await customConfirm('Delete this booking permanently?')
    if (!ok) return
    try {
      const res = await fetchWithAuth(`/api/bookings/${id}`, { method: 'DELETE' })
      if (res.ok) { loadBookings(); loadAnalytics() }
    } catch { }
  }

  const deleteAllBookings = async () => {
    const ok = await customConfirm('DELETE ALL bookings from the system? This cannot be undone!')
    if (!ok) return
    try {
      const res = await fetchWithAuth('/api/admin/bookings/all', { method: 'DELETE' })
      if (res.ok) { await customAlert('All bookings deleted.'); loadBookings(); loadAnalytics() }
    } catch { }
  }

  const openSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      const data = await res.json()
      setSettings({ subscription_fee: data.subscription_fee || '', admin_mobile: data.admin_mobile || '' })
      setShowSettings(true)
    } catch { await customAlert('Failed to load settings') }
  }

  const saveSettings = async (e) => {
    e.preventDefault()
    try {
      const res = await fetchWithAuth('/api/settings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings)
      })
      if (res.ok) { await customAlert('Settings Saved!'); setShowSettings(false) }
      else await customAlert('Failed to save settings')
    } catch { }
  }

  const handleBulkRenew = async (e) => {
    e.preventDefault()
    if (!bulkDays || isNaN(bulkDays)) { await customAlert('Please enter a valid number of days.'); return }
    const ok = await customConfirm(`Add ${bulkDays} days to ALL merchants?`)
    if (!ok) return
    try {
      const res = await fetchWithAuth('/api/admin/renew-all', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: parseInt(bulkDays), note: bulkNote })
      })
      if (res.ok) { 
        const result = await res.json()
        await customAlert(result.message || `Added ${bulkDays} days to all merchants!`)
        setShowAddDays(false)
        setTimeout(() => {
          loadMerchants()
          loadAnalytics()
        }, 500)
      }
      else { 
        const d = await res.json()
        await customAlert(d.error || 'Failed') 
      }
    } catch (err) {
      await customAlert('Communication Error: ' + err.message)
    }
  }

  const getExpiryInfo = (m) => {
    if (!m.expiry_date) return { label: 'N/A', color: '#aaa' }
    const now = new Date();
    const exp = new Date(m.expiry_date);
    const diffMs = exp - now;
    if (diffMs <= 0 || m.status !== 'ACTIVE') return { label: 'Expired', color: 'red' }
    
    const days = Math.max(0, Math.ceil(diffMs / 86400000))
    if (days <= 5) return { label: `${days}d left`, color: 'orange' }
    return { label: `${days}d left`, color: 'lime' }
  }

  const filteredBookings = bookings.filter(b => b.status === bookingFilter)

  if (!user) return null

  return (
    <>
      <Modal modal={modal} onClose={handleClose} />

      {/* Merchant Bookings Modal */}
      {viewMerchantBookings && (
        <div className="modal-overlay" style={{ zIndex: 99999 }}>
          <div className="modal-box" style={{ maxWidth: 600, width: '95%', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 15, color: 'var(--primary)' }}>Bookings for {viewMerchantBookings.vehicle_name}</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: 8, textAlign: 'left' }}>Date</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Customer</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Bill</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Depth</th>
                    <th style={{ padding: 8, textAlign: 'left' }}>Status</th>
                    <th style={{ padding: 8, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.filter(b => String(b.merchant_id) === String(viewMerchantBookings.id)).map(b => (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: 8 }}>{b.date}</td>
                      <td style={{ padding: 8 }}>
                        {b.customer_name}<br />
                        <small style={{ opacity: 0.6 }}>{b.customer_mobile}</small>
                      </td>
                      <td style={{ padding: 8 }}>₹{b.total_amount || 0}</td>
                      <td style={{ padding: 8 }}>{b.drill_depth || '-'}</td>
                      <td style={{ padding: 8 }}>
                        <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: STATUS_COLORS[b.status], color: '#000', fontWeight: 'bold' }}>{b.status}</span>
                      </td>
                      <td style={{ padding: 8, textAlign: 'right' }}>
                        <button onClick={() => deleteBooking(b.id)} className="btn" style={{ padding: '2px 6px', background: 'red', color: 'white', fontSize: 10 }}><i className="fas fa-trash"></i></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={() => setViewMerchantBookings(null)} className="btn btn-primary" style={{ width: '100%', marginTop: 20 }}>Close</button>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1a1a', padding: 30, borderRadius: 12, width: '90%', maxWidth: 450, border: '1px solid rgba(255,255,255,0.1)' }}>
            <h2 style={{ marginBottom: 20 }}>Payment Settings</h2>
            <form onSubmit={saveSettings}>
              {[['subscription_fee', 'Subscription Fee (₹)', 'number'], ['admin_mobile', 'Admin Mobile Number', 'text']].map(([k, label, type]) => (
                <div key={k} style={{ marginBottom: 15 }}>
                  <label style={{ display: 'block', marginBottom: 5, fontSize: 13 }}>{label}</label>
                  <input type={type} value={settings[k]} onChange={e => setSettings(s => ({ ...s, [k]: e.target.value }))} style={inputStyle} required />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Save Settings</button>
                <button type="button" onClick={() => setShowSettings(false)} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Days Modal */}
      {showAddDays && (
        <div className="modal-overlay">
          <div style={{ background: '#1a1a1a', padding: 30, borderRadius: 12, width: '90%', maxWidth: 450, border: '1px solid rgba(46,204,113,0.5)' }}>
            <h2 style={{ marginBottom: 20, color: '#2ecc71' }}>Add Days to All Merchants</h2>
            <form onSubmit={handleBulkRenew}>
              <div style={{ marginBottom: 15 }}>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 13 }}>Number of Days</label>
                <input type="number" value={bulkDays} onChange={e => setBulkDays(e.target.value)} style={inputStyle} required />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 5, fontSize: 13 }}>Note / Message</label>
                <input type="text" value={bulkNote} onChange={e => setBulkNote(e.target.value)} style={inputStyle} required />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, background: '#2ecc71', borderColor: '#2ecc71' }}>Confirm & Add</button>
                <button type="button" onClick={() => setShowAddDays(false)} className="btn btn-outline" style={{ flex: 1 }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav>
        <div className="logo" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>Borewell<span>Master</span></div>
        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
          <i className={`fas ${menuOpen ? 'fa-times' : 'fa-bars'}`}></i>
        </button>
        <div className={`nav-links ${menuOpen ? 'active' : ''}`}>
          <span style={{ marginRight: 20, fontWeight: 'bold', opacity: 0.8 }} className="desktop-only">Admin Panel</span>
          <button onClick={handleLogout} className="btn btn-outline" style={{ padding: '5px 15px' }}>Logout</button>
        </div>
      </nav>

      <div className="dashboard-container">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30, flexWrap: 'wrap', gap: 10 }}>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 28 }}>System Overview</h1>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowAddDays(true)} className="btn btn-outline" style={{ background: 'rgba(46,204,113,0.2)', borderColor: '#2ecc71', color: '#27ae60' }}>
              <i className="fas fa-plus-circle"></i> Add Days
            </button>
            <button onClick={openSettings} className="btn btn-primary">
              <i className="fas fa-cog"></i> Settings
            </button>
          </div>
        </div>

        {/* Analytics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 40 }}>
          {[
            { label: 'Total Merchants', value: analytics.totalMerchants, color: 'var(--primary)', filter: 'all' },
            { label: 'Active Merchants', value: analytics.activeMerchants, color: 'var(--success)', filter: 'active' },
            { label: 'Expired Merchants', value: analytics.expiredMerchants || 0, color: 'var(--danger)', filter: 'expired' },
            { label: 'Total Bookings', value: analytics.totalBookings, color: '#3498db', filter: null },
          ].map(({ label, value, color, filter }) => (
            <div key={label} className="glass-panel" style={{ textAlign: 'center', position: 'relative', paddingBottom: filter ? 50 : 20 }}>
              <div style={{ fontSize: 14, opacity: 0.7 }}>{label}</div>
              <div style={{ fontSize: 32, fontWeight: 'bold', color }}>{value}</div>
              {filter && (
                <button
                  onClick={() => setMerchantFilter(filter)}
                  className="btn"
                  style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', padding: '4px 12px', fontSize: 10, background: merchantFilter === filter ? color : 'transparent', color: merchantFilter === filter ? '#000' : color, border: `1px solid ${color}`, borderRadius: 15 }}
                >
                  {merchantFilter === filter ? 'Active Filter' : 'Inspect'}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Merchants Section */}
        {section === 'merchants' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 15 }}>
              <h2 style={{ fontFamily: 'var(--font-heading)' }}>
                {merchantFilter === 'all' ? 'All Merchants' : merchantFilter === 'active' ? 'Active Merchants' : 'Expired Merchants'}
              </h2>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: 350 }}>
                  <input
                    type="text"
                    placeholder="Search by name or location..."
                    value={merchantSearch}
                    onChange={(e) => setMerchantSearch(e.target.value)}
                    style={{ width: '100%', padding: '10px 15px 10px 40px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 25, color: 'white', fontSize: 14 }}
                  />
                  <i className="fas fa-search" style={{ position: 'absolute', left: 15, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}></i>
                </div>
              </div>
            </div>
            {loading ? (
              <p style={{ textAlign: 'center', color: '#aaa' }}>Loading merchants...</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 320px), 1fr))', gap: 20 }}>
                {merchants.filter(m => {
                  // Text search
                  const s = merchantSearch.toLowerCase()
                  const matchesText = m.owner_name?.toLowerCase().includes(s) ||
                    m.vehicle_name?.toLowerCase().includes(s) ||
                    m.location?.toLowerCase().includes(s) ||
                    String(m.mobile || '').includes(s)

                  if (!matchesText) return false

                  // Status filter
                  if (merchantFilter === 'all') return true
                  const now = new Date();
                  const exp = new Date(m.expiry_date || 0);
                  const isExpired = exp <= now || m.status !== 'ACTIVE'

                  if (merchantFilter === 'active') return !isExpired
                  if (merchantFilter === 'expired') return isExpired
                  return true
                }).map(m => {
                  const now = new Date();
                  const exp = new Date(m.expiry_date || 0);
                  const isExpired = exp <= now || m.status !== 'ACTIVE';
                  const expInfo = getExpiryInfo(m);
                  const imgSrc = m.image_url
                    ? (m.image_url.startsWith('data:') ? m.image_url : `/${m.image_url}`)
                    : '/image.png'

                  return (
                    <div key={m.id} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, overflow: 'hidden', transition: 'all 0.3s' }}>
                      <img src={imgSrc} alt={m.vehicle_name} style={{ width: '100%', height: 180, objectFit: 'cover', background: '#000' }} />
                      <div style={{ padding: 15 }}>
                        <h3 style={{ marginBottom: 5, color: 'var(--primary)', wordBreak: 'break-word' }}>{m.vehicle_name}</h3>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4, wordBreak: 'break-word' }}>
                          <i className="fas fa-user" style={{ color: 'var(--primary)', width: 18 }}></i> {m.owner_name}
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                          <i className="fas fa-phone" style={{ color: 'var(--primary)', width: 18 }}></i> {m.mobile}
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
                          <i className="fas fa-map-marker-alt" style={{ color: 'var(--primary)', width: 18 }}></i> {m.location}
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4, wordBreak: 'break-word' }}>
                          <i className="fas fa-tools" style={{ color: 'var(--primary)', width: 18 }}></i> {m.services}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 12 }}>
                          <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: isExpired ? 'rgba(220,53,69,0.1)' : 'rgba(40,167,69,0.1)', color: isExpired ? 'var(--danger)' : 'var(--success)', border: `1px solid ${isExpired ? 'var(--danger)' : 'var(--success)'}` }}>
                            {isExpired ? 'EXPIRED' : m.status}
                          </span>
                          <span style={{ fontSize: 12, color: expInfo.color, fontWeight: 600 }}>
                            <i className="fas fa-clock"></i> {expInfo.label}
                          </span>
                        </div>
                        <div style={{ marginTop: 15, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', background: 'rgba(0,0,0,0.2)', borderRadius: 8 }}>
                          <div style={{ fontSize: 13, color: '#aaa' }}>
                            <i className="fas fa-book"></i>
                            {(() => {
                              const mBookings = bookings.filter(b => {
                                if (String(b.merchant_id) !== String(m.id)) return false
                                if (b.status === 'CANCELLED') {
                                  const bDate = new Date(b.date)
                                  const now = new Date()
                                  const diff = Math.ceil((now - bDate) / 86400000)
                                  if (diff > 7) return false
                                }
                                return true
                              })
                              return <span style={{ marginLeft: 8 }}><b>{mBookings.length}</b> Bookings</span>
                            })()}
                          </div>
                          <button onClick={() => setViewMerchantBookings(m)} className="btn" style={{ padding: '4px 10px', fontSize: 12, background: 'var(--primary)', color: 'white' }}>
                            <i className="fas fa-info-circle"></i> View
                          </button>
                        </div>

                        {/* Quick Comm Buttons */}
                        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                          <a href={`tel:${m.mobile}`} className="btn" style={{ background: '#222', border: '1px solid #444', color: 'white', fontSize: 11, flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                            <i className="fas fa-phone"></i> Call
                          </a>
                          <a href={`https://wa.me/91${m.mobile}`} target="_blank" rel="noreferrer" className="btn" style={{ background: '#25D366', color: 'white', fontSize: 11, flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                            <i className="fab fa-whatsapp"></i> WhatsApp
                          </a>
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 15 }}>
                          <button onClick={() => renewMerchant(m.id)} className="btn" style={{ background: 'var(--success)', color: 'white', padding: '5px 10px', fontSize: 12, flex: 1 }}>
                            <i className="fas fa-sync"></i> Renew
                          </button>
                          <button onClick={() => deleteMerchant(m.id)} className="btn" style={{ background: 'var(--danger)', color: 'white', padding: '5px 10px', fontSize: 12, flex: 1 }}>
                            <i className="fas fa-trash"></i> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

          </div>
        )}

        {/* Removed Bookings Section */}
      </div>
    </>
  )
}
