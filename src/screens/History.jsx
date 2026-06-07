import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths } from 'date-fns'
import { he } from 'date-fns/locale'
import { ChevronRight, TrendingUp, TrendingDown, Minus, Calendar, ChevronDown } from 'lucide-react'

const PERIODS = [
  { key: 'all', label: 'כל הזמנים' },
  { key: 'week', label: 'השבוע' },
  { key: 'month', label: 'החודש' },
  { key: 'last_month', label: 'חודש שעבר' },
  { key: 'custom', label: 'מותאם אישית' },
]

function getPeriodDates(key) {
  const now = new Date()
  switch (key) {
    case 'week':
      return { from: startOfWeek(now, { weekStartsOn: 0 }), to: now }
    case 'month':
      return { from: startOfMonth(now), to: now }
    case 'last_month': {
      const last = subMonths(now, 1)
      return { from: startOfMonth(last), to: endOfMonth(last) }
    }
    default:
      return { from: null, to: null }
  }
}

export default function History() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState([])
  const [allGamePlayers, setAllGamePlayers] = useState([])
  const [allBuyins, setAllBuyins] = useState([])
  const [allGames, setAllGames] = useState([])
  const [allSettlements, setAllSettlements] = useState([])
  const [allPayments, setAllPayments] = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState(null)

  const [period, setPeriod] = useState('all')
  const [showPeriodPicker, setShowPeriodPicker] = useState(false)
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: g } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    const gameIds = (g || []).map(x => x.id)

    if (gameIds.length === 0) {
      setAllGames([])
      setLoading(false)
      return
    }

    const [{ data: pl }, { data: gp }, { data: b }, { data: s }] = await Promise.all([
      supabase.from('players').select('*').eq('user_id', user.id).order('name'),
      supabase.from('game_players').select('*').in('game_id', gameIds),
      supabase.from('buyins').select('*').in('game_id', gameIds),
      supabase.from('settlements').select('*').in('game_id', gameIds),
    ])

    const sIds = (s || []).map(x => x.id)
    const { data: p } = sIds.length > 0
      ? await supabase.from('settlement_payments').select('*').in('settlement_id', sIds)
      : { data: [] }

    setPlayers(pl || [])
    setAllGamePlayers(gp || [])
    setAllBuyins(b || [])
    setAllGames(g || [])
    setAllSettlements(s || [])
    setAllPayments(p || [])
    setLoading(false)
  }

  const filteredGames = useMemo(() => {
    if (period === 'all') return allGames
    let from, to
    if (period === 'custom') {
      from = customFrom ? new Date(customFrom) : null
      to = customTo ? new Date(customTo + 'T23:59:59') : null
    } else {
      const dates = getPeriodDates(period)
      from = dates.from
      to = dates.to
    }
    return allGames.filter(g => {
      const d = new Date(g.created_at)
      if (from && d < from) return false
      if (to && d > to) return false
      return true
    })
  }, [allGames, period, customFrom, customTo])

  const filteredGameIds = useMemo(() => filteredGames.map(g => g.id), [filteredGames])

  function playerStats(player) {
    const gpRecords = allGamePlayers.filter(gp =>
      gp.player_id === player.id && filteredGameIds.includes(gp.game_id)
    )
    const endedGpRecords = gpRecords.filter(gp => {
      const game = allGames.find(g => g.id === gp.game_id)
      return game && game.status !== 'active' && gp.ending_chips !== null
    })

    let totalPL = 0
    let gamesPlayed = endedGpRecords.length

    endedGpRecords.forEach(gp => {
      const pBuyins = allBuyins.filter(b => b.game_player_id === gp.id && !b.deleted_at)
      const totalBuyins = pBuyins.reduce((s, b) => s + b.amount_ils, 0)
      totalPL += (gp.ending_chips ?? 0) - totalBuyins
    })

    const owedToPlayer = allSettlements
      .filter(s => s.to_player_name === player.name && filteredGameIds.includes(s.game_id))
      .reduce((sum, s) => {
        const paid = allPayments.filter(p => p.settlement_id === s.id).reduce((a, p) => a + p.amount, 0)
        return sum + Math.max(0, s.required_amount - paid)
      }, 0)

    const owedByPlayer = allSettlements
      .filter(s => s.from_player_name === player.name && filteredGameIds.includes(s.game_id))
      .reduce((sum, s) => {
        const paid = allPayments.filter(p => p.settlement_id === s.id).reduce((a, p) => a + p.amount, 0)
        return sum + Math.max(0, s.required_amount - paid)
      }, 0)

    return { gamesPlayed, totalPL, avgPL: gamesPlayed > 0 ? Math.round(totalPL / gamesPlayed) : 0, owedToPlayer, owedByPlayer }
  }

  function playerGameHistory(player) {
    const gpRecords = allGamePlayers.filter(gp =>
      gp.player_id === player.id && filteredGameIds.includes(gp.game_id)
    )
    return gpRecords.map(gp => {
      const game = allGames.find(g => g.id === gp.game_id)
      const pBuyins = allBuyins.filter(b => b.game_player_id === gp.id && !b.deleted_at)
      const totalBuyins = pBuyins.reduce((s, b) => s + b.amount_ils, 0)
      const pl = game?.status !== 'active' && gp.ending_chips !== null
        ? (gp.ending_chips ?? 0) - totalBuyins
        : null
      return { game, gp, totalBuyins, pl }
    }).filter(x => x.game).sort((a, b) =>
      new Date(b.game.created_at) - new Date(a.game.created_at)
    )
  }

  const periodLabel = PERIODS.find(p => p.key === period)?.label || 'כל הזמנים'

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  const selected = selectedPlayer ? players.find(p => p.id === selectedPlayer) : null
  const stats = selected ? playerStats(selected) : null
  const history = selected ? playerGameHistory(selected) : []

  return (
    <div className="screen">
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => {
          if (selectedPlayer) setSelectedPlayer(null)
          else navigate('/')
        }}>
          <ChevronRight size={18} />
        </button>
        <div className="header-title">
          {selected ? selected.name : 'היסטוריה וסטטיסטיקות'}
        </div>
        <div style={{ width: 60 }} />
      </div>

      <div className="content" style={{ paddingBottom: 24 }}>

        <div style={{ marginBottom: 16, position: 'relative' }}>
          <button
            onClick={() => setShowPeriodPicker(prev => !prev)}
            style={{
              width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 14px', borderRadius: 'var(--radius)',
              background: 'var(--card)', border: '1px solid var(--border)',
              color: 'var(--text)', fontFamily: 'Heebo', fontSize: '0.9rem',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={16} color="var(--gold)" />
              <span>{periodLabel}</span>
            </div>
            <ChevronDown size={16} color="var(--text3)"
              style={{ transform: showPeriodPicker ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
          </button>

          {showPeriodPicker && (
            <div style={{
              position: 'absolute', top: '100%', right: 0, left: 0, zIndex: 50,
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius)', overflow: 'hidden',
              boxShadow: 'var(--shadow-lg)', marginTop: 4,
            }}>
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => { setPeriod(p.key); if (p.key !== 'custom') setShowPeriodPicker(false) }}
                  style={{
                    width: '100%', padding: '12px 16px', display: 'flex', justifyContent: 'space-between',
                    background: period === p.key ? 'rgba(212,168,83,0.1)' : 'none',
                    border: 'none', borderBottom: '1px solid var(--border)',
                    color: period === p.key ? 'var(--gold)' : 'var(--text)',
                    fontFamily: 'Heebo', fontSize: '0.9rem', fontWeight: period === p.key ? 700 : 400,
                    cursor: 'pointer', textAlign: 'right',
                  }}
                >
                  {p.label}
                  {period === p.key && <span>✓</span>}
                </button>
              ))}

              {period === 'custom' && (
                <div style={{ padding: '12px 16px', display: 'flex', gap: 8, flexDirection: 'column' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: 4 }}>מתאריך</div>
                      <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                        style={{ fontSize: '0.85rem', padding: '8px 10px' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text3)', marginBottom: 4 }}>עד תאריך</div>
                      <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                        style={{ fontSize: '0.85rem', padding: '8px 10px' }} />
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowPeriodPicker(false)}>
                    החל
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {period !== 'all' && (
          <div style={{
            background: 'rgba(212,168,83,0.08)', border: '1px solid rgba(212,168,83,0.2)',
            borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: '0.82rem',
          }}>
            <span style={{ color: 'var(--text2)' }}>{filteredGames.length} משחקים בתקופה</span>
            <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{periodLabel}</span>
          </div>
        )}

        {!selected ? (
          <>
            <div className="section-title">שחקנים</div>
            {players.length === 0 ? (
              <div className="empty-state">
                <Calendar />
                <p>אין שחקנים עדיין</p>
              </div>
            ) : (
              [...players]
                .sort((a, b) => playerStats(b).totalPL - playerStats(a).totalPL)
                .map((p, i) => {
                  const st = playerStats(p)
                  const medals = ['🥇', '🥈', '🥉']
                  const medal = st.gamesPlayed > 0 ? medals[i] : null
                  return (
                    <div key={p.id} className="card" style={{ marginBottom: 10, cursor: 'pointer' }}
                      onClick={() => setSelectedPlayer(p.id)}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {medal && <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{medal}</span>}
                          <div>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.name}</div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <span className="stat-pill">{st.gamesPlayed} משחקים</span>
                              {st.owedByPlayer > 0 && <span className="badge badge-red">חייב ₪{st.owedByPlayer}</span>}
                              {st.owedToPlayer > 0 && <span className="badge badge-green">מגיע ₪{st.owedToPlayer}</span>}
                            </div>
                          </div>
                        </div>
                        <div>
                          {st.gamesPlayed > 0 ? (
                            <div className={st.totalPL > 0 ? 'amount-pos' : st.totalPL < 0 ? 'amount-neg' : 'amount-zero'}
                              style={{ fontSize: '1.2rem', textAlign: 'left' }}>
                              {st.totalPL > 0 ? '+' : ''}₪{st.totalPL}
                            </div>
                          ) : (
                            <div style={{ color: 'var(--text3)' }}>—</div>
                          )}
                          {st.gamesPlayed > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text3)', textAlign: 'left' }}>
                              ממוצע: {st.avgPL > 0 ? '+' : ''}₪{st.avgPL}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
            )}

            <div className="section-title">משחקים ({filteredGames.length})</div>
            {filteredGames.slice(0, 15).map(game => {
              const gpCount = allGamePlayers.filter(gp => gp.game_id === game.id).length
              const pot = allBuyins
                .filter(b => b.game_id === game.id && !b.deleted_at)
                .reduce((s, b) => s + b.amount_ils, 0)
              return (
                <div key={game.id} className="card" style={{ marginBottom: 8, cursor: 'pointer' }}
                  onClick={() => navigate(game.status !== 'active' ? `/game/${game.id}/settlements` : `/view/${game.viewer_token}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{game.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>
                        {format(new Date(game.created_at), 'dd/MM/yyyy', { locale: he })} · {gpCount} שחקנים
                      </div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ color: 'var(--gold)', fontWeight: 700 }}>₪{pot}</div>
                      <span className={`badge ${game.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                        {game.status === 'active' ? 'פעיל' : 'הסתיים'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        ) : (
          <>
            {stats && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                  {[
                    { label: 'משחקים', value: stats.gamesPlayed },
                    { label: 'ממוצע למשחק', value: (stats.avgPL > 0 ? '+' : '') + '₪' + stats.avgPL },
                    { label: 'רווח/הפסד כולל', value: (stats.totalPL > 0 ? '+' : '') + '₪' + stats.totalPL, big: true },
                    { label: 'חובות פתוחים', value: stats.owedByPlayer > 0 ? '-₪' + stats.owedByPlayer : stats.owedToPlayer > 0 ? '+₪' + stats.owedToPlayer : '✓' },
                  ].map(item => (
                    <div key={item.label} className="card" style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginBottom: 4 }}>{item.label}</div>
                      <div style={{
                        fontSize: item.big ? '1.4rem' : '1.1rem', fontWeight: 800,
                        color: String(item.value).startsWith('+') ? 'var(--green)'
                          : String(item.value).startsWith('-') ? 'var(--red)'
                          : 'var(--text)'
                      }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="section-title">היסטוריית משחקים</div>
                {history.length === 0 ? (
                  <div style={{ color: 'var(--text3)', textAlign: 'center', padding: 24 }}>
                    אין משחקים בתקופה זו
                  </div>
                ) : (
                  history.map(({ game, totalBuyins, pl }) => (
                    <div key={game.id} className="card" style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{game.title}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>
                            {format(new Date(game.created_at), 'dd/MM/yyyy', { locale: he })} · השקיע ₪{totalBuyins}
                          </div>
                        </div>
                        <div>
                          {pl !== null ? (
                            <div className={pl > 0 ? 'amount-pos' : pl < 0 ? 'amount-neg' : 'amount-zero'}
                              style={{ fontSize: '1.1rem' }}>
                              {pl > 0 ? <TrendingUp size={14} style={{ display: 'inline', marginLeft: 4 }} /> : pl < 0 ? <TrendingDown size={14} style={{ display: 'inline', marginLeft: 4 }} /> : <Minus size={14} style={{ display: 'inline' }} />}
                              {pl > 0 ? '+' : ''}₪{pl}
                            </div>
                          ) : (
                            <span className="badge badge-green">פעיל</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
