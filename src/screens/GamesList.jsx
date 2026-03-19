import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import { useToast } from '../lib/toast'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { Plus, Lock, Play, ChevronLeft, BarChart2, LogOut, Trophy } from 'lucide-react'

export default function GamesList() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const showToast = useToast()

  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

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

  const statusLabel = {
    active: { label: 'פעיל', cls: 'badge-green' },
    ended: { label: 'הסתיים', cls: 'badge-blue' },
    locked: { label: 'נעול', cls: 'badge-gray' },
  }

  return (
    <div className="screen">
      <div className="header">
        <div>
          <div className="header-title">♠ פוקר כסף</div>
          <div className="header-sub" style={{ color: 'var(--text3)', fontSize: '0.72rem' }}>
            {user.email}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')}>
            <BarChart2 size={16} />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleSignOut}>
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="content">
        {/* New game button */}
        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%', marginBottom: 20 }}
          onClick={() => navigate('/create-game')}
        >
          <Plus size={18} /> משחק חדש
        </button>

        {/* Games list */}
        <div className="section-title">המשחקים שלי</div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="spinner" />
          </div>
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
              <div
                key={game.id}
                className="card"
                style={{ marginBottom: 10, cursor: 'pointer' }}
                onClick={() => navigate(
                  game.status === 'active'
                    ? `/game/${game.id}`
                    : `/game/${game.id}/settlements`
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
                {game.status === 'active' && (
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
                    <button className="btn btn-ghost btn-sm" style={{ width: '100%' }}>
                      <ChevronLeft size={14} /> פרטים וסילוקים
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
