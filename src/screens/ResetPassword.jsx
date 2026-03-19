import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'

export default function ResetPassword() {
  const navigate = useNavigate()
  const showToast = useToast()

  const [mode, setMode] = useState('request') // request | update
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  // If user arrived via reset link — switch to update mode
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery')) {
      setMode('update')
    }
  }, [])

  async function sendResetEmail() {
    if (!email) { showToast('יש להכניס אימייל', 'error'); return }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://poker-three-coral.vercel.app/reset-password',
    })
    if (error) { showToast('שגיאה בשליחת האימייל', 'error') }
    else { setSent(true) }
    setLoading(false)
  }

  async function updatePassword() {
    if (!password) { showToast('יש להכניס סיסמה', 'error'); return }
    if (password.length < 6) { showToast('סיסמה חייבת להיות לפחות 6 תווים', 'error'); return }
    if (password !== password2) { showToast('הסיסמאות לא תואמות', 'error'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { showToast('שגיאה בעדכון הסיסמה', 'error') }
    else {
      showToast('הסיסמה עודכנה בהצלחה ✓', 'success')
      setTimeout(() => navigate('/'), 1500)
    }
    setLoading(false)
  }

  // After sending email
  if (sent) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ padding: 32, textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>📧</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 12 }}>
            בדוק את האימייל שלך
          </div>
          <div style={{ color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
            שלחנו קישור לאיפוס סיסמה לכתובת
            <br />
            <strong style={{ color: 'var(--gold)' }}>{email}</strong>
          </div>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => navigate('/auth')}>
            חזור להתחברות
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <div style={{ padding: 24, maxWidth: 400, margin: '0 auto', width: '100%' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>♠</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--gold)' }}>
            פוקר עם החבר'ה
          </div>
        </div>

        {mode === 'request' ? (
          <>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>
              שכחת סיסמה?
            </div>
            <div style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: 24 }}>
              הכנס את האימייל שלך ונשלח לך קישור לאיפוס
            </div>
            <div className="form-group">
              <label className="form-label">אימייל</label>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendResetEmail()}
                style={{ direction: 'ltr', textAlign: 'right' }}
                autoFocus
              />
            </div>
            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginBottom: 16 }}
              onClick={sendResetEmail}
              disabled={loading}
            >
              {loading ? 'שולח...' : 'שלח קישור לאיפוס'}
            </button>
            <button
              className="btn btn-ghost"
              style={{ width: '100%' }}
              onClick={() => navigate('/auth')}
            >
              חזור להתחברות
            </button>
          </>
        ) : (
          <>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>
              הגדר סיסמה חדשה
            </div>
            <div className="form-group">
              <label className="form-label">סיסמה חדשה</label>
              <input
                type="password"
                placeholder="לפחות 6 תווים"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label">אימות סיסמה</label>
              <input
                type="password"
                placeholder="הכנס שוב את הסיסמה"
                value={password2}
                onChange={e => setPassword2(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && updatePassword()}
              />
            </div>
            <button
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
              onClick={updatePassword}
              disabled={loading}
            >
              {loading ? 'מעדכן...' : 'עדכן סיסמה'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
