import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'

export default function HomePage() {
  return (
    <>
      <Navbar />
      <section className="hero">
        {/* Abstract Background Elements */}
        <div style={{
          position: 'absolute', top: -100, left: -100, width: 400, height: 400,
          background: 'var(--primary)', opacity: 0.1, filter: 'blur(100px)', borderRadius: '50%'
        }} />
        <div style={{
          position: 'absolute', bottom: 0, right: 0, width: 500, height: 500,
          background: 'var(--secondary-light)', opacity: 0.2, filter: 'blur(120px)', borderRadius: '50%'
        }} />

        <div className="hero-content">
          <h1>Reliable Borewell <br /><span style={{ color: 'var(--primary)' }}>Solutions</span></h1>
          <p>Connect with top-rated borewell experts for domestic, agricultural, and industrial drilling. Secure, Fast, and Verified.</p>

          <div className="hero-cards">
            <div className="card glass-panel">
              <div className="card-icon"><i className="fas fa-briefcase"></i></div>
              <h3>For Merchants</h3>
              <p style={{ marginBottom: 20, fontSize: 14, color: '#ddd' }}>
                Join our network, manage bookings, and grow your business.
              </p>
              <Link to="/merchant-login" className="btn btn-outline">Merchant Access</Link>
            </div>

            <div className="card glass-panel" style={{ background: 'rgba(255,102,0,0.1)', borderColor: 'rgba(255,102,0,0.3)' }}>
              <div className="card-icon"><i className="fas fa-user-check"></i></div>
              <h3>For Customers</h3>
              <p style={{ marginBottom: 20, fontSize: 14, color: '#ddd' }}>
                Find verified drillers near you and book services instantly.
              </p>
              <Link to="/find-merchants" className="btn btn-primary">Find Merchants</Link>
            </div>
          </div>
        </div>
      </section>

      <footer>&copy; 2026 Borewell Master. All rights reserved.</footer>
    </>
  )
}
