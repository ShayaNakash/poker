import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/authContext'
import { useToast } from '../lib/toast'
import { Eye, EyeOff } from 'lucide-react'

export default function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const showToast = useToast()
  const navigate = useNavigate()

  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [signupDone, setSignupDone] = useState(false)

  async function handleSubmit() {
    if (!email || !password) { showToast('יש למלא אימייל וסיסמה', 'error'); return }
    if (password.length < 6) { showToast('סיסמה חייבת להיות לפחות 6 תווים', 'error'); return }

    setLoading(true)

    if (mode === 'login') {
      const error = await signIn(email, password)
      if (error) {
        if (error.message.includes('Invalid login')) showToast('אימייל או סיסמה שגויים', 'error')
        else if (error.message.includes('Email not confirmed')) showToast('יש לאשר את האימייל תחילה', 'error')
        else showToast('שגיאה בהתחברות', 'error')
      }
    } else {
      const error = await signUp(email, password)
      if (error) {
        if (error.message.includes('already registered')) showToast('אימייל זה כבר רשום', 'error')
        else showToast('שגיאה בהרשמה', 'error')
      } else {
        setSignupDone(true)
      }
    }

    setLoading(false)
  }

  if (signupDone) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ padding: 32, textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>📧</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 12 }}>
            בדוק את האימייל שלך
          </div>
          <div style={{ color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
            שלחנו לך קישור אישור לכתובת
            <br />
            <strong style={{ color: 'var(--gold)' }}>{email}</strong>
            <br /><br />
            לחץ על הקישור כדי לאשר את החשבון ואז התחבר.
          </div>
          <button
            className="btn btn-ghost"
            style={{ width: '100%' }}
            onClick={() => { setSignupDone(false); setMode('login') }}
          >
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
            ZugKing
          </div>
          <div style={{ color: 'var(--text3)', fontSize: '0.9rem', marginTop: 4 }}>
            ניהול משחקי פוקר מזומן
          </div>
        </div>

        {/* Mode tabs */}
        <div style={{
          display: 'flex',
          background: 'var(--bg3)',
          borderRadius: 'var(--radius)',
          padding: 4,
          marginBottom: 24,
        }}>
          {[
            { key: 'login', label: 'התחברות' },
            { key: 'signup', label: 'הרשמה' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setMode(tab.key)}
              style={{
                flex: 1, padding: '10px', border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: mode === tab.key ? 'var(--card2)' : 'transparent',
                color: mode === tab.key ? 'var(--gold)' : 'var(--text3)',
                fontFamily: 'Heebo', fontWeight: 700, fontSize: '0.95rem',
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <div className="form-group">
          <label className="form-label">אימייל</label>
          <input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            style={{ direction: 'ltr', textAlign: 'right' }}
            autoComplete="email"
          />
        </div>

        <div className="form-group">
          <label className="form-label">סיסמה</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="לפחות 6 תווים"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              style={{ paddingLeft: 44 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text3)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%', marginTop: 8 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'רגע...' : mode === 'login' ? '🃏 כניסה' : '✨ צור חשבון'}
        </button>

        {/* Switch mode */}
        <div style={{ textAlign: 'center', marginTop: 20, color: 'var(--text3)', fontSize: '0.9rem' }}>
          {mode === 'login' ? (
            <>
              אין לך חשבון?{' '}
              <button
                onClick={() => setMode('signup')}
                style={{ background: 'none', border: 'none', color: 'var(--gold)', fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo', fontSize: '0.9rem' }}
              >
                הירשם בחינם
              </button>
              <div style={{ marginTop: 12 }}>
                <button
                  onClick={() => navigate('/reset-password')}
                  style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontFamily: 'Heebo', fontSize: '0.85rem' }}
                >
                  שכחתי סיסמה
                </button>
              </div>
            </>
          ) : (
            <>
              כבר יש לך חשבון?{' '}
              <button
                onClick={() => setMode('login')}
                style={{ background: 'none', border: 'none', color: 'var(--gold)', fontWeight: 700, cursor: 'pointer', fontFamily: 'Heebo', fontSize: '0.9rem' }}
              >
                התחבר
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
