import { useNavigate } from 'react-router-dom'

const FEATURES = [
  {
    icon: '⚡',
    title: 'Buy-in בלחיצה אחת',
    desc: 'כפתורי +20, +40, +100 — הוספת buy-in תוך שנייה, בלי לבזבז זמן בזמן המשחק',
  },
  {
    icon: '👁️',
    title: 'צפייה חיה לכל השחקנים',
    desc: 'שתף קישור עם החברים — הם רואים את המצב בזמן אמת מהטלפון, בלי להירשם',
  },
  {
    icon: '🧮',
    title: 'סילוקים אוטומטיים',
    desc: 'בסוף המשחק האפליקציה מחשבת מי חייב למי ובכמה — בצורה הכי פשוטה אפשרית',
  },
  {
    icon: '💸',
    title: 'מעקב תשלומים',
    desc: 'רשום תשלומים במזומן, ביט או פייבוקס — דע מי שילם ומי עדיין חייב',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* Hero */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px 32px',
        textAlign: 'center',
        background: 'radial-gradient(ellipse at 50% 0%, rgba(212,168,83,0.08) 0%, transparent 70%)',
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 24 }}>
          <img src="/logo.png" alt="ZugKing" style={{
            width: 100, height: 100, borderRadius: 22,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          }} />
        </div>

        <h1 style={{
          fontSize: '2.2rem', fontWeight: 900,
          color: 'var(--text)', marginBottom: 12, lineHeight: 1.2,
        }}>
          ZugKing
        </h1>

        <p style={{
          fontSize: '1.05rem', color: 'var(--text2)',
          maxWidth: 320, lineHeight: 1.6, marginBottom: 32,
        }}>
          ניהול משחקי פוקר מזומן ביתיים — פשוט, מהיר, וכיף
        </p>

        {/* CTA buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
          <button
            className="btn btn-primary btn-lg"
            style={{ width: '100%', fontSize: '1.1rem' }}
            onClick={() => navigate('/auth')}
          >
            🃏 התחל בחינם
          </button>
          <button
            className="btn btn-ghost"
            style={{ width: '100%' }}
            onClick={() => navigate('/auth')}
          >
            יש לי חשבון — כניסה
          </button>
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: '32px 24px 48px', maxWidth: 480, margin: '0 auto', width: '100%' }}>
        <div style={{
          fontSize: '0.8rem', fontWeight: 700, color: 'var(--text3)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
          textAlign: 'center', marginBottom: 24,
        }}>
          למה ZugKing?
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {FEATURES.map((f, i) => (
            <div key={i} style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              padding: '16px',
              display: 'flex',
              gap: 14,
              alignItems: 'flex-start',
            }}>
              <div style={{
                fontSize: '1.6rem', flexShrink: 0,
                width: 44, height: 44,
                background: 'var(--bg3)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {f.icon}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>
                  {f.title}
                </div>
                <div style={{ color: 'var(--text2)', fontSize: '0.83rem', lineHeight: 1.5 }}>
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%', marginTop: 28 }}
          onClick={() => navigate('/auth')}
        >
          🃏 התחל בחינם עכשיו
        </button>

        <div style={{ textAlign: 'center', marginTop: 16, color: 'var(--text3)', fontSize: '0.8rem' }}>
          בחינם לתמיד · © IdaNakash · עובד מהטלפון
        </div>
      </div>
    </div>
  )
}
