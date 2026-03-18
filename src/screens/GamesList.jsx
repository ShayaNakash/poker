import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAdmin } from '../lib/adminAuth'
import { useToast } from '../lib/toast'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import {
  Plus, Lock, Play, ChevronLeft, BarChart2, LogIn, LogOut, Trophy
} from 'lucide-react'

export default function GamesList() {
  const navigate = useNavigate()
  const { isAdmin, login, logout } = useAdmin()
  const showToast = useToast()

  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [showPinModal, setShowPinModal] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)

  useEffect(() => {
    loadGames()
  }, [])

  async function loadGames() {
    setLoading(true)
    const { data } = await supabase
      .from('games')
      .select('*')
      .order('created_at', { ascending: false })
    setGames(data || [])
    setLoading(false)
  }

  function handlePinSubmit() {
    if (login(pin)) {
      setShowPinModal(false)
      setPin('')
      setPinError(false)
      showToast('כניסת אדמין מוצלחת ✓', 'success')
    } else {
      setPinError(true)
      setPin('')
    }
  }

  const statusLabel = {
    active: { label: 'פעיל', cls: 'badge-green' },
    ended: { label: 'הסתיים', cls: 'badge-blue' },
    locked: { label: 'נעול', cls: 'badge-gray' },
  }

  return (
    <div className="screen">
      {/* Header */}
      <div className="header">
        <div>
          <div className="header-title">♠ פוקר כסף</div>
          <div className="header-sub">ניהול משחקי מזומן</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/history')}
          >
            <BarChart2 size={16} />
          </button>
          {isAdmin ? (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { logout(); showToast('יצאת ממצב אדמין', 'info') }}
            >
              <LogOut size={16} />
              <span>יציאה</span>
            </button>
          ) : (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowPinModal(true)}
            >
              <LogIn size={16} />
              <span>אדמין</span>
            </button>
          )}
        </div>
      </div>

      <div className="content">
        {/* Admin header */}
        {isAdmin && (
          <div style={{
            background: 'linear-gradient(135deg, rgba(212,168,83,0.12), rgba(240,200,122,0.06))',
            border: '1px solid rgba(212,168,83,0.3)',
            borderRadius: 'var(--radius)',
            padding: '12px 14px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.9rem' }}>
                🔑 מצב אדמין פעיל
              </div>
              <div style={{ color: 'var(--text2)', fontSize: '0.75rem' }}>
                ניתן ליצור ולנהל משחקים
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/create-game')}
            >
              <Plus size={16} />
              משחק חדש
            </button>
          </div>
        )}

        {/* Games list */}
        <div className="section-title">משחקים</div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="spinner" />
          </div>
        ) : games.length === 0 ? (
          <div className="empty-state">
            <Trophy />
            <p>אין משחקים עדיין</p>
            {!isAdmin && <p style={{ marginTop: 8, fontSize: '0.8rem' }}>התחבר כאדמין כדי ליצור משחק</p>}
          </div>
        ) : (
          games.map(game => {
            const s = statusLabel[game.status] || statusLabel.active
            return (
              <div
                key={game.id}
                className="card"
                style={{ marginBottom: 10, cursor: 'pointer' }}
                onClick={() => navigate(
                  game.status === 'active' && isAdmin
                    ? `/game/${game.id}`
                    : `/view/${game.viewer_token}`
                )}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4 }}>
                      {game.title || 'ערב פוקר'}
                    </div>
                    <div style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>
                      {format(new Date(game.created_at), 'dd/MM/yyyy, HH:mm', { locale: he })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span className={`badge ${s.cls}`}>{s.label}</span>
                    {game.status === 'locked' && <Lock size={14} color="var(--text3)" />}
                  </div>
                </div>
                {isAdmin && game.status === 'active' && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1 }}
                      onClick={e => { e.stopPropagation(); navigate(`/game/${game.id}`) }}
                    >
                      <Play size={14} /> ניהול משחק
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={e => { e.stopPropagation(); navigate(`/view/${game.viewer_token}`) }}
                    >
                      צפייה
                    </button>
                  </div>
                )}
                {game.status !== 'active' && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ width: '100%' }}
                    >
                      <ChevronLeft size={14} /> פרטים וסילוקים
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* PIN Modal */}
      {showPinModal && (
        <div className="modal-overlay" onClick={() => setShowPinModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🔑 כניסת אדמין</div>
            <div className="form-group">
              <label className="form-label">קוד PIN</label>
              <input
                type="password"
                inputMode="numeric"
                placeholder="הכנס PIN"
                value={pin}
                onChange={e => { setPin(e.target.value); setPinError(false) }}
                onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
                autoFocus
                style={pinError ? { borderColor: 'var(--red)' } : {}}
              />
              {pinError && (
                <div style={{ color: 'var(--red)', fontSize: '0.85rem', marginTop: 6 }}>
                  קוד שגוי, נסה שוב
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={handlePinSubmit}>
                כניסה
              </button>
              <button className="btn btn-ghost" onClick={() => setShowPinModal(false)}>
                ביטול
              </button>
            </div>
            <div style={{ marginTop: 12, color: 'var(--text3)', fontSize: '0.8rem', textAlign: 'center' }}>
              ברירת מחדל: 1234
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
