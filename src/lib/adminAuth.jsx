import { createContext, useContext, useState, useEffect } from 'react'

const AdminContext = createContext(null)

const ADMIN_PIN = '1234' // Default PIN — user should change this
const ADMIN_KEY = 'poker_admin_authed'

export function AdminProvider({ children }) {
  const [isAdmin, setIsAdmin] = useState(() => {
    return sessionStorage.getItem(ADMIN_KEY) === 'true'
  })

  const login = (pin) => {
    if (pin === ADMIN_PIN) {
      sessionStorage.setItem(ADMIN_KEY, 'true')
      setIsAdmin(true)
      return true
    }
    return false
  }

  const logout = () => {
    sessionStorage.removeItem(ADMIN_KEY)
    setIsAdmin(false)
  }

  return (
    <AdminContext.Provider value={{ isAdmin, login, logout }}>
      {children}
    </AdminContext.Provider>
  )
}

export const useAdmin = () => useContext(AdminContext)
