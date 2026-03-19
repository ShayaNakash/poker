import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { computeSettlements, computeBalances } from '../utils/settlement'
import { useToast } from '../lib/toast'
import { ChevronRight, Trophy, AlertTriangle } from 'lucide-react'

export default function EndGame() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()

  const [game, setGame] = useState(null)
  const [gamePlayers, setGamePlayers] = useState([])
  const [buyins, setBuyins] = useState([])
  const [chips, setChips] = useState({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [gameId])

  async function loadData() {
    const [{ data: g }, { data: gp }, { data: b }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase.from('game_players').select('*').eq('game_id', gameId).order('player_name'),
      supabase.from('buyins').select('*').eq('game_id', gameId),
    ])
    setGame(g)
    setGamePlayers(gp || [])
    setBuyins(b || [])
    const initialChips = {}
    gp?.forEach(p => { if (p.ending_chips != null) initialChips[p.id] = String(p.ending_chips) })
    setChips(initialChips)
    setLoading(false)
  }

  const rate = game?.chips_per_20 || 20
  // Convert chips to ILS: chips / rate * 20
  const chipsToIls = (chipsCount) => Math.round(chipsCount / rate * 20)

  const activeBuyins = (gpId) => buyins.filter(b => b.game_player_id === gpId && !b.deleted_at)
  const playerTotal = (gpId) => activeBuyins(gpId).reduce((s, b) => s + b.amount_ils, 0)
  const totalPot = () => buyins.filter(b => !b.deleted_at).reduce((s, b) => s + b.amount_ils, 0)

  function totalChipsEntered() {
    return Object.values(chips).reduce((s, v) => s + (parseInt(v) || 0), 0)
  }

  // Total chips that should be on the table
  function totalChipsInGame() {
    return buyins.filter(b => !b.deleted_at).reduce((s, b) => s + b.chips, 0)
  }

  function chipsBalanced() {
    return totalChipsEntered() === totalChipsInGame()
  }

  function profitLoss(gpId) {
    const endingChipsCount = parseInt(chips[gpId]) || 0
    const endingIls = chipsToIls(endingChipsCount)
    return endingIls - playerTotal(gpId)
  }

  async function endGame() {
    const missing = gamePlayers.filter(gp => chips[gp.id] === undefined || chips[gp.id] === '')
    if (missing.length > 0) {
      showToast(`חסרים צ'יפים עבור: ${missing.map(p => p.player_name).join(', ')}`, 'error')
      return
    }

    setSaving(true)
    try {
      for (const gp of gamePlayers) {
        await supabase.from('game_players')
          .update({ ending_chips: parseInt(chips[gp.id]) || 0 })
          .eq('id', gp.id)
      }

      const updatedPlayers = gamePlayers.map(gp => ({
        ...gp, ending_chips: parseInt(chips[gp.id]) || 0,
      }))

      // Pass rate to computeBalances
      const balances = computeBalances(updatedPlayers, buyins, rate)
      const transfers = computeSettlements(balances)

      if (transfers.length > 0) {
        await supabase.from('settlements').insert(
          transfers.map(t => ({
            game_id: gameId,
            from_player_id: t.from_player_id,
            to_player_id: t.to_player_id,
            from_player_name: t.from_player_name,
            to_player_name: t.to_player_name,
            required_amount: t.required_amount,
          }))
        )
      }

      await supabase.from('games').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', gameId)

      await supabase.from('audit_logs').insert({
        game_id: gameId, action: 'end_game', entity_type: 'game', entity_id: gameId,
        after_data: { chips, transfers, rate }
      })

      showToast('המשחק הסתיים ✓', 'success')
      navigate(`/game/${gameId}/settlements`)
    } catch (err) {
      showToast('שגיאה בסיום המשחק', 'error')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  const pot = totalPot()
  const totalChipsGame = totalChipsInGame()
  const chipsEntered = totalChipsEntered()
  const balanced = chipsBalanced()

  return (
    <div className="screen">
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/game/${gameId}`)}><ChevronRight size={18} /></button>
        <div>
          <div className="header-title">סיום משחק</div>
          <div className="header-sub">הכנס צ'יפים סיום</div>
        </div>
        <div style={{ width: 60 }} />
      </div>

      <div className="content">
        {/* Pot summary */}
        <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
          <div style={{ color: 'var(--text2)', fontSize: '0.85rem', marginBottom: 4 }}>סה"כ קופה</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--gold)' }}>₪{pot}</div>
          {rate !== 20 && (
            <div style={{ color: 'var(--text3)', fontSize: '0.8rem', marginTop: 4 }}>
              = {totalChipsGame} צ'יפים בסה"כ · יחס: ₪20 = {rate} צ'יפים
            </div>
          )}
        </div>

        {/* Validation */}
        <div style={{
          background: balanced ? 'rgba(46,204,113,0.1)' : chipsEntered > 0 ? 'rgba(231,76,60,0.1)' : 'var(--card)',
          border: `1px solid ${balanced ? 'var(--green)' : chipsEntered > 0 ? 'var(--red)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text2)' }}>סה"כ צ'יפים שהוכנסו</div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', color: balanced ? 'var(--green)' : chipsEntered > 0 ? 'var(--red)' : 'var(--text3)' }}>
            {chipsEntered} / {totalChipsGame} {balanced && '✓'}
          </div>
        </div>

        {!balanced && chipsEntered > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, color: 'var(--orange)',
            fontSize: '0.85rem', marginBottom: 12, padding: '8px 12px',
            background: 'rgba(230,126,34,0.1)', borderRadius: 'var(--radius-sm)',
          }}>
            <AlertTriangle size={16} />
            <span>
              {chipsEntered > totalChipsGame
                ? `יש ${chipsEntered - totalChipsGame} צ'יפים יותר מהצפוי`
                : `חסרים ${totalChipsGame - chipsEntered} צ'יפים`}
            </span>
          </div>
        )}

        {/* Player chip entry */}
        <div className="section-title">צ'יפים לפי שחקן</div>

        {gamePlayers.map(gp => {
          const total = playerTotal(gp.id)
          const endingChipsCount = parseInt(chips[gp.id]) || 0
          const endingIls = chipsToIls(endingChipsCount)
          const pl = endingIls - total
          const hasValue = chips[gp.id] !== undefined && chips[gp.id] !== ''

          return (
            <div key={gp.id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{gp.player_name}</div>
                  <div style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>
                    השקיע: ₪{total} ({activeBuyins(gp.id).length} buy-ins)
                  </div>
                </div>
                {hasValue && (
                  <div style={{ textAlign: 'left' }}>
                    <div className={pl > 0 ? 'amount-pos' : pl < 0 ? 'amount-neg' : 'amount-zero'}>
                      {pl > 0 ? '+' : ''}₪{pl}
                    </div>
                    {rate !== 20 && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                        ={endingIls} ₪
                      </div>
                    )}
                  </div>
                )}
              </div>
              <input
                type="number" inputMode="numeric"
                placeholder={`מספר צ'יפים...`}
                value={chips[gp.id] ?? ''}
                onChange={e => setChips(prev => ({ ...prev, [gp.id]: e.target.value }))}
              />
            </div>
          )
        })}

        {/* Preview */}
        {gamePlayers.every(gp => chips[gp.id] !== undefined && chips[gp.id] !== '') && (
          <div className="card" style={{ marginTop: 8 }}>
            <div className="section-title" style={{ marginTop: 0 }}>תצוגה מקדימה</div>
            {[...gamePlayers].sort((a, b) => profitLoss(b.id) - profitLoss(a.id)).map(gp => {
              const pl = profitLoss(gp.id)
              return (
                <div key={gp.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span>{gp.player_name}</span>
                  <span className={pl > 0 ? 'amount-pos' : pl < 0 ? 'amount-neg' : 'amount-zero'}>
                    {pl > 0 ? '+' : ''}₪{pl}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%', marginTop: 20 }}
          onClick={endGame}
          disabled={saving || !balanced}
        >
          {saving ? 'שומר...' : <><Trophy size={18} /> סיים משחק וצור סילוקים</>}
        </button>

        {!balanced && chipsEntered > 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: '0.8rem', marginTop: 8 }}>
            סה"כ הצ'יפים חייב להיות {totalChipsGame}
          </div>
        )}
      </div>
    </div>
  )
}
