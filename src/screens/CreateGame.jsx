import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/authContext'
import { ChevronRight, UserPlus, Trash2, AlertTriangle, Info } from 'lucide-react'

export default function CreateGame() {
  const navigate = useNavigate()
  const showToast = useToast()
  const { user } = useAuth()

  const [title, setTitle] = useState('')
  const [chipsPer20, setChipsPer20] = useState('20')
  const [allPlayers, setAllPlayers] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [newPlayerName, setNewPlayerName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => { loadPlayers() }, [])

  async function loadPlayers() {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('user_id', user.id)
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
      .insert({ name, user_id: user.id })
      .select().single()
    if (error) { showToast('שגיאה בהוספת שחקן', 'error'); return }
    setAllPlayers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setSelectedIds(prev => [...prev, data.id])
    setNewPlayerName('')
    showToast(`${name} נוסף ✓`, 'success')
  }

  async function deletePlayer(player) {
    const { data: gp } = await supabase
      .from('game_players').select('id').eq('player_id', player.id).limit(1)
    if (gp && gp.length > 0) {
      showToast('לא ניתן למחוק שחקן שמשתתף במשחקים', 'error')
      setDeleteConfirm(null)
      return
    }
    const { error } = await supabase.from('players').delete().eq('id', player.id)
    if (error) { showToast('שגיאה במחיקה', 'error'); return }
    setAllPlayers(prev => prev.filter(p => p.id !== player.id))
    setSelectedIds(prev => prev.filter(id => id !== player.id))
    setDeleteConfirm(null)
    showToast(`${player.name} נמחק ✓`, 'success')
  }

  async function resetAllData() {
    setResetting(true)
    try {
      await supabase.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('settlement_payments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('settlements').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('buyins').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('game_players').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('games').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      setAllPlayers([])
      setSelectedIds([])
      setResetConfirm(false)
      showToast('כל הנתונים נמחקו ✓', 'success')
      navigate('/')
    } catch (err) {
      showToast('שגיאה באיפוס', 'error')
    } finally {
      setResetting(false)
    }
  }

  function togglePlayer(id) {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(x => x !== id))
    } else {
      if (selectedIds.length >= 10) { showToast('מקסימום 10 שחקנים', 'error'); return }
      setSelectedIds(prev => [...prev, id])
    }
  }

  // Preview: how many chips for ₪20
  const rate = parseInt(chipsPer20) || 20
  const chipsFor100 = Math.round(100 / 20 * rate)

  async function createGame() {
    if (selectedIds.length < 2) { showToast('יש לבחור לפחות 2 שחקנים', 'error'); return }
    const rate = parseInt(chipsPer20)
    if (!rate || rate <= 0) { showToast('יחס צ\'יפים לא תקין', 'error'); return }

    setCreating(true)
    try {
      const { data: game, error: gameError } = await supabase
        .from('games')
        .insert({ title: title.trim() || 'ערב פוקר', user_id: user.id, chips_per_20: rate })
        .select().single()
      if (gameError) throw gameError

      const gamePlayers = selectedIds.map(pid => {
        const p = allPlayers.find(x => x.id === pid)
        return { game_id: game.id, player_id: pid, player_name: p.name }
      })
      const { error: gpError } = await supabase.from('game_players').insert(gamePlayers)
      if (gpError) throw gpError

      await supabase.from('audit_logs').insert({
        game_id: game.id, action: 'create_game', entity_type: 'game', entity_id: game.id,
        after_data: { title: game.title, chips_per_20: rate, players: gamePlayers.map(p => p.player_name) }
      })

      showToast('המשחק נוצר! ✓', 'success')
      navigate(`/game/${game.id}`)
    } catch (err) {
      showToast('שגיאה ביצירת משחק', 'error')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="screen">
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}><ChevronRight size={18} /></button>
        <div className="header-title">משחק חדש</div>
        <div style={{ width: 60 }} />
      </div>

      <div className="content">
        {/* Game title */}
        <div className="form-group">
          <label className="form-label">שם המשחק (אופציונלי)</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="ערב פוקר" />
        </div>

        {/* Chips rate */}
        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            כמה צ'יפים נותנים על ₪20?
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={chipsPer20}
            onChange={e => setChipsPer20(e.target.value)}
            placeholder="20"
            min="1"
          />
          {/* Preview */}
          {rate > 0 && (
            <div style={{
              marginTop: 8,
              padding: '8px 12px',
              background: 'rgba(212,168,83,0.08)',
              border: '1px solid rgba(212,168,83,0.2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              color: 'var(--text2)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <Info size={13} color="var(--gold)" style={{ flexShrink: 0 }} />
              <span>
                ₪20 = <strong style={{ color: 'var(--gold)' }}>{rate} צ'יפים</strong>
                {' · '}
                ₪100 = <strong style={{ color: 'var(--gold)' }}>{chipsFor100} צ'יפים</strong>
                {' · '}
                צ'יפ אחד = <strong style={{ color: 'var(--gold)' }}>₪{(20 / rate).toFixed(2).replace(/\.?0+$/, '')}</strong>
              </span>
            </div>
          )}
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
            <button className="btn btn-ghost" style={{ flexShrink: 0, padding: '12px 14px' }} onClick={addNewPlayer}>
              <UserPlus size={18} />
            </button>
          </div>
        </div>

        {/* Player selection */}
        <div className="section-title">בחר שחקנים ({selectedIds.length}/10)</div>

        {allPlayers.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: '0.9rem', textAlign: 'center', padding: 24 }}>
            הוסף שחקנים ברשימה למעלה
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {allPlayers.map(p => {
              const selected = selectedIds.includes(p.id)
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => togglePlayer(p.id)}
                    style={{
                      flex: 1, padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: `2px solid ${selected ? 'var(--gold)' : 'var(--border)'}`,
                      background: selected ? 'rgba(212,168,83,0.15)' : 'var(--bg3)',
                      color: selected ? 'var(--gold)' : 'var(--text)',
                      fontWeight: selected ? 700 : 400,
                      fontFamily: 'Heebo, sans-serif', fontSize: '0.95rem',
                      cursor: 'pointer', transition: 'all 0.15s',
                      textAlign: 'right', display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    {selected && <span style={{ fontSize: '0.75rem' }}>✓</span>}
                    {p.name}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '10px', color: 'var(--text3)', flexShrink: 0 }}
                    onClick={() => setDeleteConfirm(p)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Selected summary */}
        {selectedIds.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={{ color: 'var(--text2)', fontSize: '0.85rem', marginBottom: 6 }}>שחקנים שנבחרו:</div>
            <div style={{ color: 'var(--text)', fontWeight: 600 }}>
              {selectedIds.map(id => allPlayers.find(p => p.id === id)?.name).join(', ')}
            </div>
          </div>
        )}

        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%', marginBottom: 16 }}
          onClick={createGame}
          disabled={creating || selectedIds.length < 2}
        >
          {creating ? 'יוצר...' : `🃏 התחל משחק עם ${selectedIds.length} שחקנים`}
        </button>

        <button
          className="btn btn-ghost btn-sm"
          style={{ width: '100%', color: 'var(--text3)', fontSize: '0.8rem' }}
          onClick={() => setResetConfirm(true)}
        >
          <Trash2 size={13} /> איפוס כל הנתונים
        </button>
      </div>

      {/* Delete player modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ color: 'var(--red)' }}><Trash2 size={18} /> מחיקת שחקן</div>
            <div style={{ color: 'var(--text2)', marginBottom: 20 }}>
              למחוק את <strong style={{ color: 'var(--text)' }}>{deleteConfirm.name}</strong> מהרשימה?
              <br /><span style={{ fontSize: '0.82rem', color: 'var(--text3)' }}>ניתן למחוק רק שחקנים שלא השתתפו במשחקים.</span>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={() => deletePlayer(deleteConfirm)}>מחק</button>
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* Reset modal */}
      {resetConfirm && (
        <div className="modal-overlay" onClick={() => setResetConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ color: 'var(--red)' }}><AlertTriangle size={18} /> איפוס כל הנתונים</div>
            <div style={{
              background: 'rgba(231,76,60,0.1)', border: '1px solid var(--red)',
              borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: 16,
              fontSize: '0.9rem', color: 'var(--text2)'
            }}>
              ⚠️ פעולה זו תמחק <strong style={{ color: 'var(--red)' }}>את כל המשחקים, השחקנים, והנתונים</strong> לצמיתות!
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={resetAllData} disabled={resetting}>
                {resetting ? 'מאפס...' : 'כן, מחק הכל'}
              </button>
              <button className="btn btn-ghost" onClick={() => setResetConfirm(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
