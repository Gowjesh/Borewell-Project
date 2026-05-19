import { useState, useCallback, useEffect } from 'react'

// Modal component
export function Modal({ modal, onClose }) {
  const [inputVal, setInputVal] = useState(modal?.defaultVal || '')

  useEffect(() => {
    if (modal) setInputVal(modal.defaultVal || '')
  }, [modal])

  if (!modal) return null

  return (
    <div className="modal-overlay" style={{ zIndex: 1000000 }} onClick={(e) => e.target === e.currentTarget && modal.type === 'alert' && onClose(null)}>
      <div className="modal-box">
        {modal.type === 'confirm' && <h3>{modal.message}</h3>}
        {modal.type === 'alert' && <p>{modal.message}</p>}
        {modal.type === 'prompt' && (
          <>
            <h3>{modal.message}</h3>
            <div className="form-group" style={{ textAlign: 'left' }}>
              <input
                type={modal.inputType || 'text'}
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                style={{ marginBottom: 0 }}
                autoFocus
              />
            </div>
          </>
        )}
        <div className="modal-actions" style={{ marginTop: modal.type === 'prompt' ? 15 : 0 }}>
          {modal.type === 'confirm' && (
            <>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onClose(true)}>Yes</button>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => onClose(false)}>No</button>
            </>
          )}
          {modal.type === 'alert' && (
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onClose(null)}>OK</button>
          )}
          {modal.type === 'prompt' && (
            <>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => onClose(inputVal)}>OK</button>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => onClose(null)}>Cancel</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Hook to use modals
export function useModal() {
  const [modal, setModal] = useState(null)
  const [resolver, setResolver] = useState(null)

  const showModal = useCallback((type, message, opts = {}) => {
    return new Promise((resolve) => {
      setResolver(() => resolve)
      setModal({ type, message, ...opts })
    })
  }, [])

  const handleClose = useCallback((result) => {
    setModal(null)
    if (resolver) resolver(result)
    setResolver(null)
  }, [resolver])

  const customAlert = useCallback((msg) => showModal('alert', msg), [showModal])
  const customConfirm = useCallback((msg) => showModal('confirm', msg), [showModal])
  const customPrompt = useCallback((msg, inputType = 'text', defaultVal = '') =>
    showModal('prompt', msg, { inputType, defaultVal }), [showModal])

  return { modal, handleClose, customAlert, customConfirm, customPrompt }
}
