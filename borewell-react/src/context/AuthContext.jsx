import { createContext, useContext, useState, useCallback } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })

  const login = useCallback((userData) => {
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  const getToken = useCallback(() => user?.token || null, [user])

  const fetchWithAuth = useCallback(async (url, options = {}) => {
    const token = user?.token
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
    const response = await fetch(url, options)
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('user')
      setUser(null)
      window.location.href = '/'
      throw new Error('Unauthorized')
    }
    return response
  }, [user])

  return (
    <AuthContext.Provider value={{ user, login, logout, getToken, fetchWithAuth }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
