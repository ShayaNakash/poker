import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { ChevronRight, Plus, X, UserPlus } from 'lucide-react'

export default function CreateGame() {
  const navigate = useNavigate()
  const showToast = useToast()

  const [title, setTitle] = useState('')
  const [allPlayers, setAllPlayers] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [newPlayerName, setNewPlayerName] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadPlayers()
  }, [])

  async function loadPlayers() {
    const { data } = await supabase
      .from('players')
      .select('*')
      .order('name')
    setAllPlayers(data || [])
  }

  async function addNewPlayer() {
    const name = newPlayerName.trim()
    if (!name) return
    if (allPlayers.find(p => p.name === name)) {
      showToast('שחקן עם שם זה כבר קיים', 'error')
      return
    }

    const { data, error } = await supabase
      .from('players')
      .insert({ name })
      .select()
      .single()

    if (error) { showToast('שגיאה בהוספת שחקן', 'error'); return }

    setAllPlayers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedIds(prev => [...prev, data.id])
    setNewPlayerName('')
    showToast(`${name} נוסף ✓`, 'success')
  }

  function togglePlayer(id) {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(x => x !== id))
    } else {
      if (selectedIds.length >= 10) {
        showToast('מקסימום 10 שחקנים', 'error')
        return
      }
      setSelectedIds(prev => [...prev, id])
    }
  }

  async function createGame() {
    if (selectedIds.length < 2) {
      showToast('יש לבחור לפחות 2 שחקנים', 'error')
      return
    }

    setCreating(true)
    try {
      // Create game
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({ title: title.trim() || 'ערב פוקר' })
        .select()
        .single()

      if (gameError) throw gameError

      // Add players
      const gamePlayers = selectedIds.map(pid => {
        const p = allPlayers.find(x => x.id === pid)
        return {
          game_id: game.id,
          player_id: pid,
          player_name: p.name,
        }
      })

      const { error: gpError } = await supabase
        .from('game_players')
        .insert(gamePlayers)

      if (gpError) throw gpError

      // Audit log
      await supabase.from('audit_logs').insert({
        game_id: game.id,
        action: 'create_game',
        entity_type: 'game',
        entity_id: game.id,
        after_data: { title: game.title, players: gamePlayers.map(p => p.player_name) }
      })

      showToast('המשחק נוצר בהצלחה! ✓', 'success')
      navigate(`/game/${game.id}`)
    } catch (err) {
      showToast('שגיאה ביצירת משחק', 'error')
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="screen">
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          <ChevronRight size={18} />
        </button>
        <div className="header-title">משחק חדש</div>
        <div style={{ width: 60 }} />
      </div>

      <div className="content">
        <div className="form-group">
          <label className="form-label">שם המשחק (אופציונלי)</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="ערב פוקר"
          />
        </div>

        {/* Add new player */}
        <div className="form-group">
          <label className="form-label">הוסף שחקן חדש לרשימה</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newPlayerName}
              onChange={e => setNewPlayerName(e.target.value)}
              placeholder="שם השחקן"
              onKeyDown={e => e.key === 'Enter' && addNewPlayer()}
            />
            <button
              className="btn btn-ghost"
              style={{ flexShrink: 0, padding: '12px 14px' }}
              onClick={addNewPlayer}
            >
              <UserPlus size={18} />
            </button>
          </div>
        </div>

        {/* Player selection */}
        <div className="section-title">
          בחר שחקנים ({selectedIds.length}/10)
        </div>

        {allPlayers.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: '0.9rem', textAlign: 'center', padding: 24 }}>
            הוסף שחקנים ברשימה למעלה
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
            {allPlayers.map(p => {
              const selected = selectedIds.includes(p.id)
              return (
                <button
                  key={p.id}
                  onClick={() => togglePlayer(p.id)}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: `2px solid ${selected ? 'var(--gold)' : 'var(--border)'}`,
                    background: selected ? 'rgba(212,168,83,0.15)' : 'var(--bg3)',
                    color: selected ? 'var(--gold)' : 'var(--text)',
                    fontWeight: selected ? 700 : 400,
                    fontFamily: 'Heebo, sans-serif',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {selected && <span style={{ fontSize: '0.75rem' }}>✓</span>}
                  {p.name}
                </button>
              )
            })}
          </div>
        )}

        {/* Summary */}
        {selectedIds.length > 0 && (
          <div style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 12,
            marginBottom: 20,
          }}>
            <div style={{ color: 'var(--text2)', fontSize: '0.85rem', marginBottom: 6 }}>
              שחקנים שנבחרו:
            </div>
            <div style={{ color: 'var(--text)', fontWeight: 600 }}>
              {selectedIds.map(id => allPlayers.find(p => p.id === id)?.name).join(', ')}
            </div>
          </div>
        )}

        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
          onClick={createGame}
          disabled={creating || selectedIds.length < 2}
        >
          {creating ? 'יוצר...' : `🃏 התחל משחק עם ${selectedIds.length} שחקנים`}
        </button>
      </div>
    </div>
  )
}
