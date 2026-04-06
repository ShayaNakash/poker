import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import { useToast } from '../lib/toast'
import { useTheme } from '../lib/useTheme'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { Plus, Lock, Play, ChevronLeft, BarChart2, LogOut, Trophy, Trash2, Share2, MessageCircle, Shield, Sun, Moon, Menu, X } from 'lucide-react'

const ADMIN_EMAILS = ['shayanakash1@gmail.com', 'idanakash@gmail.com']

export default function GamesList() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const showToast = useToast()
  const { isDark, toggleTheme } = useTheme()

  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { loadGames() }, [])

  async function loadGames() {
    setLoading(true)
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setGames(data || [])
    setLoading(false)
  }

  async function handleSignOut() {
    await signOut()
    showToast('יצאת בהצלחה', 'info')
  }

  async function shareApp() {
    const url = 'https://zugking.com'
    const text = 'ניהול משחקי פוקר מזומן — ZugKing 🃏'
    try { await navigator.share({ title: 'ZugKing', text, url }) }
    catch { await navigator.clipboard.writeText(url); showToast('קישור האפליקציה הועתק ✓', 'success') }
    setMenuOpen(false)
  }

  async function deleteGame(game) {
    setDeleting(true)
    try {
      const { data: gps } = await supabase.from('game_players').select('id').eq('game_id', game.id)
      const gpIds = gps?.map(g => g.id) || []
      if (gpIds.length > 0) await supabase.from('buyins').delete().in('game_player_id', gpIds)
      const { data: setts } = await supabase.from('settlements').select('id').eq('game_id', game.id)
      const settIds = setts?.map(s => s.id) || []
      if (settIds.length > 0) await supabase.from('settlement_payments').delete().in('settlement_id', settIds)
      await supabase.from('settlements').delete().eq('game_id', game.id)
      await supabase.from('game_players').delete().eq('game_id', game.id)
      await supabase.from('audit_logs').delete().eq('game_id', game.id)
      await supabase.from('games').delete().eq('id', game.id)
      setGames(prev => prev.filter(g => g.id !== game.id))
      setDeleteConfirm(null)
      showToast('המשחק נמחק ✓', 'success')
    } catch (err) {
      showToast('שגיאה במחיקה', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const statusLabel = {
    active: { label: 'פעיל', cls: 'badge-green' },
    ended: { label: 'הסתיים', cls: 'badge-blue' },
    locked: { label: 'נעול', cls: 'badge-gray' },
  }

  return (
    <div className="screen">
      <div className="header">
        <div>
          <div className="header-title">♠ ZugKing</div>
          <div className="header-sub" style={{ color: 'var(--text3)', fontSize: '0.72rem' }}>
            {user.email}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-ghost btn-sm" onClick={toggleTheme} title={isDark ? 'מצב בהיר' : 'מצב כהה'}>
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMenuOpen(prev => !prev)}>
            {menuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* Dropdown menu */}
      {menuOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 150,
        }} onClick={() => setMenuOpen(false)}>
          <div style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top) + 60px)',
            left: 12, right: 12,
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 151,
          }} onClick={e => e.stopPropagation()}>
            {[
              { icon: <BarChart2 size={16} />, label: 'היסטוריה וסטטיסטיקות', action: () => { navigate('/history'); setMenuOpen(false) } },
              { icon: <MessageCircle size={16} />, label: 'שלח פידבק', action: () => { navigate('/feedback'); setMenuOpen(false) } },
              { icon: <Share2 size={16} />, label: 'שתף את האפליקציה', action: shareApp },
              ...(ADMIN_EMAILS.includes(user?.email) ? [{ icon: <Shield size={16} color="var(--gold)" />, label: 'Admin Dashboard', action: () => { navigate('/admin-stats'); setMenuOpen(false) } }] : []),
              { icon: <LogOut size={16} />, label: 'התנתק', action: handleSignOut, danger: true },
            ].map((item, i) => (
              <button key={i} onClick={item.action} style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px',
                background: 'none', border: 'none',
                borderBottom: i < 3 ? '1px solid var(--border)' : 'none',
                color: item.danger ? 'var(--red)' : 'var(--text)',
                fontFamily: 'Heebo', fontSize: '0.95rem', fontWeight: 500,
                cursor: 'pointer', textAlign: 'right',
              }}>
                <span style={{ color: item.danger ? 'var(--red)' : 'var(--text2)' }}>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="content">
        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%', marginBottom: 20 }}
          onClick={() => navigate('/create-game')}
        >
          <Plus size={18} /> משחק חדש
        </button>

        <div className="section-title">המשחקים שלי</div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
        ) : games.length === 0 ? (
          <div className="empty-state">
            <Trophy />
            <p>אין משחקים עדיין</p>
            <p style={{ marginTop: 8, fontSize: '0.8rem' }}>לחץ "משחק חדש" כדי להתחיל</p>
          </div>
        ) : (
          games.map(game => {
            const s = statusLabel[game.status] || statusLabel.active
            return (
              <div key={game.id} className="card" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div
                    style={{ flex: 1, cursor: 'pointer' }}
                    onClick={() => navigate(
                      game.status === 'active'
                        ? `/game/${game.id}`
                        : `/game/${game.id}/settlements`
                    )}
                  >
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
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '6px 8px', color: 'var(--text3)' }}
                      onClick={() => setDeleteConfirm(game)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {game.status === 'active' && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ flex: 1 }}
                      onClick={() => navigate(`/game/${game.id}`)}
                    >
                      <Play size={14} /> ניהול משחק
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => navigate(`/view/${game.viewer_token}`)}
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
                      onClick={() => navigate(`/game/${game.id}/settlements`)}
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

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ color: 'var(--red)' }}>
              <Trash2 size={18} /> מחיקת משחק
            </div>
            <div style={{ color: 'var(--text2)', marginBottom: 20 }}>
              למחוק את <strong style={{ color: 'var(--text)' }}>{deleteConfirm.title}</strong>?
              <br />
              <span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>
                כל הנתונים של המשחק יימחקו לצמיתות.
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                className="btn btn-danger"
                style={{ flex: 1 }}
                onClick={() => deleteGame(deleteConfirm)}
                disabled={deleting}
              >
                {deleting ? 'מוחק...' : 'מחק משחק'}
              </button>
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
