import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import { useToast } from '../lib/toast'
import { ChevronRight, Bug, Lightbulb, MessageCircle, Send } from 'lucide-react'

const TYPES = [
  { key: 'bug', label: 'דיווח על תקלה', icon: <Bug size={18} />, color: 'var(--red)' },
  { key: 'idea', label: 'רעיון לשיפור', icon: <Lightbulb size={18} />, color: 'var(--gold)' },
  { key: 'other', label: 'אחר', icon: <MessageCircle size={18} />, color: 'var(--blue)' },
]

export default function FeedbackScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const showToast = useToast()

  const [type, setType] = useState('idea')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function sendFeedback() {
    if (!message.trim()) { showToast('יש לכתוב הודעה', 'error'); return }

    setSending(true)
    try {
      // Save to DB
      await supabase.from('feedback').insert({
        user_id: user.id,
        user_email: user.email,
        type,
        message: message.trim(),
      })

      // Send email via Edge Function
      const { data, error } = await supabase.functions.invoke('send-feedback', {
        body: { type, message: message.trim(), user_email: user.email },
      })

      if (error) {
        console.error('Edge function error:', error)
        showToast(`שגיאה בשליחת מייל: ${error.message}`, 'error')
      } else {
        console.log('Edge function response:', data)
      }

      setSent(true)
    } catch (err) {
      showToast('שגיאה בשליחה, נסה שוב', 'error')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🙏</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: 12 }}>תודה רבה!</div>
          <div style={{ color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
            הפידבק שלך התקבל ויעזור לנו לשפר את האפליקציה
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            חזור לדף הבית
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          <ChevronRight size={18} />
        </button>
        <div className="header-title">פידבק</div>
        <div style={{ width: 60 }} />
      </div>

      <div className="content">
        <div style={{ color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
          יש לך רעיון לשיפור או נתקלת בתקלה? נשמח לשמוע 🃏
        </div>

        {/* Type selection */}
        <div className="section-title">סוג פנייה</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {TYPES.map(t => (
            <button
              key={t.key}
              onClick={() => setType(t.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px',
                borderRadius: 'var(--radius)',
                border: `2px solid ${type === t.key ? t.color : 'var(--border)'}`,
                background: type === t.key ? `${t.color}15` : 'var(--card)',
                color: type === t.key ? t.color : 'var(--text)',
                fontFamily: 'Heebo', fontWeight: type === t.key ? 700 : 400,
                fontSize: '0.95rem', cursor: 'pointer', transition: 'all 0.15s',
                textAlign: 'right',
              }}
            >
              <span style={{ color: t.color }}>{t.icon}</span>
              {t.label}
              {type === t.key && <span style={{ marginRight: 'auto', fontSize: '0.8rem' }}>✓</span>}
            </button>
          ))}
        </div>

        {/* Message */}
        <div className="form-group">
          <label className="form-label">
            {type === 'bug' ? 'תאר את התקלה' : type === 'idea' ? 'תאר את הרעיון' : 'הודעה'}
          </label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder={
              type === 'bug'
                ? 'מה קרה? באיזה מסך? מה ציפית שיקרה?'
                : type === 'idea'
                ? 'מה תרצה לראות באפליקציה?'
                : 'כתוב כאן...'
            }
            rows={5}
            style={{ resize: 'none' }}
          />
        </div>

        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
          onClick={sendFeedback}
          disabled={sending || !message.trim()}
        >
          {sending ? 'שולח...' : <><Send size={16} /> שלח פידבק</>}
        </button>
      </div>
    </div>
  )
}
