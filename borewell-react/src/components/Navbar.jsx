import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useModal } from './Modal'
import { Modal } from './Modal'

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { modal, handleClose, customConfirm } = useModal()



  const closeMenu = () => setMenuOpen(false)

  return (
    <>
      <Modal modal={modal} onClose={handleClose} />
      <nav>
        <Link to="/" className="logo" onClick={closeMenu}>Borewell<span>Master</span></Link>

        <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
          <i className="fas fa-bars"></i>
        </button>

        <div className={`nav-links ${menuOpen ? 'active' : ''}`}>
          <Link to="/" onClick={closeMenu}>Home</Link>
          <Link to="/merchant-login" onClick={closeMenu}>Merchant Access</Link>
          <Link to="/find-merchants" onClick={closeMenu}>Find Merchants</Link>

        </div>
      </nav>
    </>
  )
}
