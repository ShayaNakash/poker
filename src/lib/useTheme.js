import { useState, useEffect } from 'react'

export function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('zugking-theme')
    return saved ? saved === 'dark' : true // default dark
  })

  useEffect(() => {
    if (isDark) {
      document.body.classList.remove('light-mode')
    } else {
      document.body.classList.add('light-mode')
    }
    localStorage.setItem('zugking-theme', isDark ? 'dark' : 'light')
  }, [isDark])

  function toggleTheme() {
    setIsDark(prev => !prev)
  }

  return { isDark, toggleTheme }
}
