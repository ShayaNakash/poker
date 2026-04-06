import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { settlementStatus } from '../utils/settlement'
import { useTheme } from '../lib/useTheme'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { Eye, CheckCircle, Clock, AlertCircle, Trophy, RefreshCw, Sun, Moon } from 'lucide-react'

export default function ViewerPage() {
  const { token } = useParams()
  const { isDark, toggleTheme } = useTheme()
  const [game, setGame] = useState(null)
  const [gamePlayers, setGamePlayers] = useState([])
  const [buyins, setBuyins] = useState([])
  const [settlements, setSettlements] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('live')

  async function loadData(showRefresh = false) {
    if (showRefresh) setRefreshing(true)
    const { data: g } = await supabase
      .from('games')
      .select('*')
      .eq('viewer_token', token)
      .single()

    if (!g) { setLoading(false); setRefreshing(false); return }
    setGame(g)

    const [{ data: gp }, { data: b }, { data: s }, { data: p }] = await Promise.all([
      supabase.from('game_players').select('*').eq('game_id', g.id).order('player_name'),
      supabase.from('buyins').select('*').eq('game_id', g.id),
      supabase.from('settlements').select('*').eq('game_id', g.id),
      supabase.from('settlement_payments').select('*'),
    ])
    setGamePlayers(gp || [])
    setBuyins(b || [])
    setSettlements(s || [])
    setPayments(p || [])
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    loadData()

    let gameId
    supabase.from('games').select('id').eq('viewer_token', token).single().then(({ data }) => {
      if (!data) return
      gameId = data.id
      const channel = supabase
        .channel(`viewer-${token}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'buyins', filter: `game_id=eq.${gameId}` }, () => loadData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` }, () => loadData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements', filter: `game_id=eq.${gameId}` }, () => loadData())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settlement_payments' }, () => loadData())
        .subscribe()
    })
  }, [token])

  function activeBuyins(gpId) {
    return buyins.filter(b => b.game_player_id === gpId && !b.deleted_at)
  }

  function playerTotal(gpId) {
    return activeBuyins(gpId).reduce((s, b) => s + b.amount_ils, 0)
  }

  function totalPot() {
    return buyins.filter(b => !b.deleted_at).reduce((s, b) => s + b.amount_ils, 0)
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
      <span>טוען...</span>
    </div>
  )

  if (!game) return (
    <div className="loading-screen">
      <Trophy size={48} style={{ opacity: 0.3 }} />
      <span style={{ color: 'var(--text2)' }}>משחק לא נמצא</span>
    </div>
  )

  const isEnded = game.status !== 'active'

  return (
    <div className="screen">
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Eye size={18} color="var(--text3)" />
          <div>
            <div className="header-title">{game.title}</div>
            <div className="header-sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {game.status === 'active' ? (
                <>
                  <span className="pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                  צפייה בלבד — עדכון חי
                </>
              ) : (
                <span>📌 המשחק הסתיים</span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontWeight: 800, color: 'var(--gold)', fontSize: '1.1rem' }}>
            ₪{totalPot()}
          </div>
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: '8px' }}
            onClick={toggleTheme}
            title={isDark ? 'מצב בהיר' : 'מצב כהה'}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: '8px' }}
            onClick={() => loadData(true)}
            disabled={refreshing}
            title="רענן"
          >
            <RefreshCw size={16} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      {isEnded && (
        <div style={{ display: 'flex', background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
          {[
            { key: 'live', label: 'נתוני משחק' },
            { key: 'results', label: 'תוצאות' },
            { key: 'settlements', label: 'סילוקים' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                flex: 1, padding: '12px', border: 'none', background: 'none',
                color: activeTab === t.key ? 'var(--gold)' : 'var(--text2)',
                fontFamily: 'Heebo', fontWeight: 600, fontSize: '0.82rem',
                borderBottom: `2px solid ${activeTab === t.key ? 'var(--gold)' : 'transparent'}`,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="content" style={{ paddingBottom: 24 }}>
        {/* Live view */}
        {activeTab === 'live' && (
          <>
            <div style={{ color: 'var(--text2)', fontSize: '0.82rem', marginBottom: 14 }}>
              {gamePlayers.length} שחקנים · {format(new Date(game.created_at), "dd/MM/yyyy 'בשעה' HH:mm", { locale: he })}
            </div>
            {gamePlayers.map(gp => {
              const pBuyins = activeBuyins(gp.id)
              const total = playerTotal(gp.id)
              const last = pBuyins[pBuyins.length - 1]

              return (
                <div key={gp.id} className="player-card" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div className="player-name-big">{gp.player_name}</div>
                      <div className="player-stats-row">
                        <div className="stat-pill">₪<strong>{total}</strong></div>
                        <div className="stat-pill">{pBuyins.length} buy-ins</div>
                        {last && (
                          <div className="stat-pill" style={{ fontSize: '0.75rem' }}>
                            אחרון: {format(new Date(last.recorded_at), 'HH:mm')}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--gold)' }}>
                      ₪{total}
                    </div>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* Results */}
        {activeTab === 'results' && (
          <>
            <div className="section-title">תוצאות סופיות</div>
            {[...gamePlayers]
              .sort((a, b) => {
                const plA = (a.ending_chips ?? 0) - playerTotal(a.id)
                const plB = (b.ending_chips ?? 0) - playerTotal(b.id)
                return plB - plA
              })
              .map((gp, i) => {
                const total = playerTotal(gp.id)
                const ending = gp.ending_chips ?? 0
                const pl = ending - total
                const medals = ['🥇', '🥈', '🥉']

                return (
                  <div key={gp.id} className="card" style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '1.3rem' }}>{medals[i] || ''}</span>
                        <div>
                          <div style={{ fontWeight: 700 }}>{gp.player_name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>
                            השקיע ₪{total} · סיים {ending} צ'יפס
                          </div>
                        </div>
                      </div>
                      <div className={pl > 0 ? 'amount-pos' : pl < 0 ? 'amount-neg' : 'amount-zero'} style={{ fontSize: '1.3rem' }}>
                        {pl > 0 ? '+' : ''}₪{pl}
                      </div>
                    </div>
                  </div>
                )
              })}
          </>
        )}

        {/* Settlements */}
        {activeTab === 'settlements' && (
          <>
            <div className="section-title">העברות</div>
            {settlements.length === 0 ? (
              <div className="empty-state">
                <CheckCircle />
                <p>אין העברות</p>
              </div>
            ) : (
              settlements.map(s => {
                const sPayments = payments.filter(p => p.settlement_id === s.id)
                const { paid, remaining, status } = settlementStatus(s, sPayments)
                const statusConfig = {
                  unpaid: { label: 'לא שולם', cls: 'badge-red' },
                  partial: { label: 'חלקי', cls: 'badge-orange' },
                  paid: { label: 'שולם', cls: 'badge-green' },
                }
                const sc = statusConfig[status]

                return (
                  <div key={s.id} className="settlement-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span className={`badge ${sc.cls}`}>{sc.label}</span>
                      <strong style={{ color: 'var(--gold)', fontSize: '1.1rem' }}>₪{s.required_amount}</strong>
                    </div>
                    <div className="transfer-arrow">
                      <span style={{ color: 'var(--red)', fontWeight: 800 }}>{s.from_player_name}</span>
                      <span style={{ color: 'var(--text3)' }}>←</span>
                      <span style={{ color: 'var(--green)', fontWeight: 800 }}>{s.to_player_name}</span>
                    </div>
                    {paid > 0 && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text2)' }}>
                        שולם: ₪{paid} · נותר: ₪{remaining}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </>
        )}
      </div>
    </div>
  )
}
