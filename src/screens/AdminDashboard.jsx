import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useToast } from '../lib/toast'
import { useAuth } from '../lib/authContext'
import { computeSettlements, computeBalances } from '../utils/settlement'
import { format } from 'date-fns'
import {
  ChevronRight, Flag, Share2, ChevronDown, Plus, Clock,
  Edit2, Trash2, Lock, Eye, UserPlus, ShoppingCart, Trophy, AlertTriangle
} from 'lucide-react'

const QUICK_AMOUNTS = [20, 40, 60, 100, 200]

export default function AdminDashboard() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()
  const { user } = useAuth()

  const [game, setGame] = useState(null)
  const [gamePlayers, setGamePlayers] = useState([])
  const [buyins, setBuyins] = useState([])
  const [expenses, setExpenses] = useState([])
  const [allPlayers, setAllPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEndGame, setShowEndGame] = useState(false)
  const [expandedPlayer, setExpandedPlayer] = useState(null)

  // Modals
  const [buyinModal, setBuyinModal] = useState(null)
  const [customAmount, setCustomAmount] = useState('')
  const [editModal, setEditModal] = useState(null)
  const [editAmount, setEditAmount] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleteReason, setDeleteReason] = useState('')

  // Add player mid-game modal
  const [addPlayerModal, setAddPlayerModal] = useState(false)
  const [newPlayerName, setNewPlayerName] = useState('')
  const [selectedExistingPlayer, setSelectedExistingPlayer] = useState(null)

  // Expense modal
  const [expenseModal, setExpenseModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState(null)
  const [expensePaidBy, setExpensePaidBy] = useState('')
  const [expenseDesc, setExpenseDesc] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseSplitAmong, setExpenseSplitAmong] = useState([])

  const loadData = useCallback(async () => {
    const [{ data: g }, { data: gp }, { data: b }, { data: e }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase.from('game_players').select('*').eq('game_id', gameId).order('player_name'),
      supabase.from('buyins').select('*').eq('game_id', gameId).order('recorded_at'),
      supabase.from('expenses').select('*').eq('game_id', gameId).order('created_at'),
    ])
    setGame(g)
    setGamePlayers(gp || [])
    setBuyins(b || [])
    setExpenses(e || [])
    setLoading(false)
  }, [gameId])

  const channelRef = React.useRef(null)

  useEffect(() => {
    loadData()
    if (user) {
      supabase.from('players').select('*').eq('user_id', user.id).order('name')
        .then(({ data }) => setAllPlayers(data || []))
    }
    const channel = supabase
      .channel(`admin-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buyins', filter: `game_id=eq.${gameId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `game_id=eq.${gameId}` }, loadData)
      .subscribe()
    channelRef.current = channel
    return () => supabase.removeChannel(channel)
  }, [gameId, loadData, user])

  function goToEndGame() {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    setShowEndGame(true)
  }

  const rate = game?.chips_per_20 || 20
  const ilsToChips = (ils) => Math.round(ils / 20 * rate)
  const activeBuyins = (gpId) => buyins.filter(b => b.game_player_id === gpId && !b.deleted_at)
  const playerTotal = (gpId) => activeBuyins(gpId).reduce((s, b) => s + b.amount_ils, 0)
  const playerTotalChips = (gpId) => activeBuyins(gpId).reduce((s, b) => s + b.chips, 0)
  const totalPot = () => buyins.filter(b => !b.deleted_at).reduce((s, b) => s + b.amount_ils, 0)
  const totalExpenses = () => expenses.reduce((s, e) => s + e.amount, 0)

  // Players not yet in this game
  const availableToAdd = allPlayers.filter(p =>
    !gamePlayers.find(gp => gp.player_id === p.id)
  )

  async function addBuyin(gpId, amount) {
    if (!amount || amount <= 0) return
    const gp = gamePlayers.find(p => p.id === gpId)
    const chips = ilsToChips(amount)
    const { data: buyin, error } = await supabase
      .from('buyins')
      .insert({ game_id: gameId, game_player_id: gpId, amount_ils: amount, chips })
      .select().single()
    if (error) { showToast('שגיאה בהוספת buy-in', 'error'); return }
    await supabase.from('audit_logs').insert({
      game_id: gameId, action: 'add_buyin', entity_type: 'buyin',
      entity_id: buyin.id, after_data: { player: gp?.player_name, amount_ils: amount, chips }
    })
    setBuyins(prev => [...prev, buyin])
    setBuyinModal(null); setCustomAmount('')
    showToast(`✓ +₪${amount} ל${gp?.player_name}`, 'success')
  }

  async function confirmEdit() {
    const amount = parseInt(editAmount)
    if (!amount || amount <= 0) return
    const before = { ...editModal }
    const chips = ilsToChips(amount)
    const { error } = await supabase
      .from('buyins').update({ amount_ils: amount, chips }).eq('id', editModal.id)
    if (error) { showToast('שגיאה בעריכה', 'error'); return }
    await supabase.from('audit_logs').insert({
      game_id: gameId, action: 'edit_buyin', entity_type: 'buyin',
      entity_id: editModal.id, before_data: before,
      after_data: { ...before, amount_ils: amount, chips }
    })
    setBuyins(prev => prev.map(b => b.id === editModal.id ? { ...b, amount_ils: amount, chips } : b))
    setEditModal(null); setEditAmount('')
    showToast('עדכון בוצע ✓', 'success')
  }

  async function confirmDelete() {
    const before = { ...deleteConfirm }
    const { error } = await supabase.from('buyins')
      .update({ deleted_at: new Date().toISOString(), delete_reason: deleteReason || 'הוזן בטעות' })
      .eq('id', deleteConfirm.id)
    if (error) { showToast('שגיאה במחיקה', 'error'); return }
    await supabase.from('audit_logs').insert({
      game_id: gameId, action: 'delete_buyin', entity_type: 'buyin',
      entity_id: deleteConfirm.id, before_data: before,
      after_data: { deleted_at: new Date().toISOString(), reason: deleteReason }
    })
    setBuyins(prev => prev.map(b =>
      b.id === deleteConfirm.id ? { ...b, deleted_at: new Date().toISOString() } : b
    ))
    setDeleteConfirm(null); setDeleteReason('')
    showToast('Buy-in נמחק ✓', 'success')
  }

  async function shareViewerLink() {
    if (!game) return
    const url = `${window.location.origin}/view/${game.viewer_token}`
    try { await navigator.share({ title: game.title, url }) }
    catch { await navigator.clipboard.writeText(url); showToast('קישור הועתק ✓', 'success') }
  }

  async function lockGame() {
    if (!window.confirm('לנעול את המשחק?')) return
    await supabase.from('games').update({ status: 'locked' }).eq('id', gameId)
    showToast('המשחק ננעל ✓', 'info')
    loadData()
  }

  // Add player mid-game
  async function addPlayerMidGame() {
    let playerName = ''
    let playerId = null

    if (selectedExistingPlayer) {
      playerName = selectedExistingPlayer.name
      playerId = selectedExistingPlayer.id
    } else if (newPlayerName.trim()) {
      // Create new player
      const { data: newP, error } = await supabase
        .from('players')
        .insert({ name: newPlayerName.trim(), user_id: user.id })
        .select().single()
      if (error) { showToast('שגיאה בהוספת שחקן', 'error'); return }
      playerName = newP.name
      playerId = newP.id
      setAllPlayers(prev => [...prev, newP])
    } else {
      showToast('בחר שחקן או הכנס שם חדש', 'error')
      return
    }

    // Add to game
    const { data: gp, error: gpError } = await supabase
      .from('game_players')
      .insert({ game_id: gameId, player_id: playerId, player_name: playerName })
      .select().single()

    if (gpError) { showToast('שגיאה בהוספת שחקן למשחק', 'error'); return }

    setGamePlayers(prev => [...prev, gp].sort((a, b) => a.player_name.localeCompare(b.player_name)))
    setAddPlayerModal(false)
    setNewPlayerName('')
    setSelectedExistingPlayer(null)
    showToast(`${playerName} נוסף למשחק ✓`, 'success')
  }

  // Add or edit expense
  async function addExpense() {
    const amount = parseInt(expenseAmount)
    if (!expensePaidBy) { showToast('בחר מי שילם', 'error'); return }
    if (!amount || amount <= 0) { showToast('הכנס סכום תקין', 'error'); return }
    if (expenseSplitAmong.length === 0) { showToast('בחר מי חולק בהוצאה', 'error'); return }

    if (editingExpense) {
      // Edit existing
      const { error } = await supabase.from('expenses').update({
        paid_by_name: expensePaidBy,
        description: expenseDesc || 'קניות',
        amount,
        split_among: expenseSplitAmong,
      }).eq('id', editingExpense.id)
      if (error) { showToast('שגיאה בעדכון', 'error'); return }
      showToast('הוצאה עודכנה ✓', 'success')
    } else {
      // New expense
      const { error } = await supabase.from('expenses').insert({
        game_id: gameId,
        paid_by_name: expensePaidBy,
        description: expenseDesc || 'קניות',
        amount,
        split_among: expenseSplitAmong,
      })
      if (error) { showToast('שגיאה בהוספת הוצאה', 'error'); return }
      showToast(`הוצאה ₪${amount} נרשמה ✓`, 'success')
    }

    setExpenseModal(false)
    setEditingExpense(null)
    setExpensePaidBy('')
    setExpenseDesc('')
    setExpenseAmount('')
    setExpenseSplitAmong([])
    loadData()
  }

  async function deleteExpense(expense) {
    if (!window.confirm(`למחוק הוצאה של ₪${expense.amount}?`)) return
    const { error } = await supabase.from('expenses').delete().eq('id', expense.id)
    if (error) { showToast('שגיאה במחיקה', 'error'); return }
    setExpenses(prev => prev.filter(e => e.id !== expense.id))
    showToast('הוצאה נמחקה ✓', 'success')
  }

  // Early exit
  const [earlyExitModal, setEarlyExitModal] = useState(null)
  const [earlyExitChips, setEarlyExitChips] = useState('')

  async function confirmEarlyExit() {
    const chips = parseInt(earlyExitChips)
    if (isNaN(chips) || chips < 0) { showToast('הכנס מספר צ\'יפים תקין', 'error'); return }
    const { error } = await supabase
      .from('game_players')
      .update({ ending_chips: chips, exited_at: new Date().toISOString() })
      .eq('id', earlyExitModal.id)
    if (error) { showToast('שגיאה', 'error'); return }
    await supabase.from('audit_logs').insert({
      game_id: gameId, action: 'early_exit', entity_type: 'game_player',
      entity_id: earlyExitModal.id,
      after_data: { player: earlyExitModal.player_name, ending_chips: chips }
    })
    setEarlyExitModal(null); setEarlyExitChips('')
    showToast(`${earlyExitModal.player_name} יצא עם ${chips} צ'יפים ✓`, 'success')
    loadData()
  }

  function toggleSplitPlayer(name) {
    setExpenseSplitAmong(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /><span>טוען...</span></div>
  if (!game) return <div className="loading-screen"><span>משחק לא נמצא</span></div>

  // ── Inline EndGame ──
  if (showEndGame) {
    return <InlineEndGame
      game={game}
      gamePlayers={gamePlayers}
      buyins={buyins}
      expenses={expenses}
      onBack={() => setShowEndGame(false)}
      onDone={() => navigate(`/game/${gameId}/settlements`)}
      gameId={gameId}
    />
  }

  if (game.status !== 'active') {
    return (
      <div className="screen">
        <div className="header">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}><ChevronRight size={18} /></button>
          <div className="header-title">{game.title}</div>
          <div style={{ width: 60 }} />
        </div>
        <div className="content" style={{ textAlign: 'center', paddingTop: 60 }}>
          <Lock size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
          <div style={{ color: 'var(--text2)', marginBottom: 24 }}>המשחק {game.status === 'locked' ? 'ננעל' : 'הסתיים'}</div>
          <button className="btn btn-primary btn-lg" onClick={() => navigate(`/game/${gameId}/settlements`)}>
            צפה בסילוקים
          </button>
        </div>
      </div>
    )
  }

  const rateLabel = rate !== 20 ? `₪20 = ${rate} צ'יפים` : null

  return (
    <div className="screen">
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}><ChevronRight size={18} /></button>
        <div>
          <div className="header-title">{game.title}</div>
          <div className="header-sub">
            קופה: <strong style={{ color: 'var(--gold)' }}>₪{totalPot()}</strong>
            {totalExpenses() > 0 && <span style={{ color: 'var(--text3)', marginRight: 6 }}>· הוצאות: ₪{totalExpenses()}</span>}
            {rateLabel && <span style={{ color: 'var(--text3)', marginRight: 6 }}>· {rateLabel}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-ghost btn-sm" style={{ padding: '8px' }} onClick={shareViewerLink}><Share2 size={15} /></button>
          <button className="btn btn-ghost btn-sm" style={{ padding: '8px' }} onClick={() => navigate(`/view/${game.viewer_token}`)}><Eye size={15} /></button>
          <button className="btn btn-primary btn-sm" style={{ padding: '8px 12px', fontSize: '0.85rem' }} onClick={goToEndGame}>
            <Flag size={13} /> סיום
          </button>
        </div>
      </div>

      <div className="content">
        {/* Live indicator + action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <span className="pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: 'var(--green)', fontSize: '0.82rem', fontWeight: 600 }}>פעיל</span>
          <div style={{ marginRight: 'auto', display: 'flex', gap: 6 }}>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.78rem', color: 'var(--gold)', border: '1px solid rgba(212,168,83,0.3)' }}
              onClick={() => {
                setExpenseSplitAmong(gamePlayers.map(p => p.player_name))
                setExpenseModal(true)
              }}
            >
              <ShoppingCart size={13} /> הוצאה
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.78rem' }}
              onClick={() => setAddPlayerModal(true)}
            >
              <UserPlus size={13} /> שחקן
            </button>
            <button
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '0.75rem', color: 'var(--text3)', padding: '4px 8px' }}
              onClick={lockGame}
            >
              <Lock size={12} />
            </button>
          </div>
        </div>

        {/* Expenses summary */}
        {expenses.length > 0 && (
          <div style={{
            background: 'rgba(212,168,83,0.06)',
            border: '1px solid rgba(212,168,83,0.2)',
            borderRadius: 'var(--radius)',
            padding: '10px 14px',
            marginBottom: 14,
          }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--gold)', fontWeight: 700, marginBottom: 6 }}>
              🛒 הוצאות משותפות
            </div>
            {expenses.map((e, i) => (
              <div key={e.id || i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: '0.82rem', color: 'var(--text2)', padding: '5px 0',
                borderBottom: '1px solid rgba(212,168,83,0.1)',
              }}>
                <span>{e.paid_by_name} · {e.description || 'קניות'} ({e.split_among?.length || 0} משתתפים)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ color: 'var(--gold)' }}>₪{e.amount}</strong>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '3px 6px' }}
                    onClick={() => {
                      setExpensePaidBy(e.paid_by_name)
                      setExpenseDesc(e.description || '')
                      setExpenseAmount(String(e.amount))
                      setExpenseSplitAmong(e.split_among || [])
                      setEditingExpense(e)
                      setExpenseModal(true)
                    }}
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '3px 6px', color: 'var(--red)' }}
                    onClick={() => deleteExpense(e)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 6, paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text3)' }}>סה"כ הוצאות</span>
              <strong style={{ color: 'var(--gold)' }}>₪{totalExpenses()}</strong>
            </div>
          </div>
        )}

        {/* Player cards */}
        {gamePlayers.map(gp => {
          const pBuyins = activeBuyins(gp.id)
          const deletedBuyins = buyins.filter(b => b.game_player_id === gp.id && b.deleted_at)
          const total = playerTotal(gp.id)
          const totalChips = playerTotalChips(gp.id)
          const count = pBuyins.length
          const last = pBuyins[pBuyins.length - 1]
          const isExpanded = expandedPlayer === gp.id
          const hasExited = !!gp.exited_at

          // If player exited early
          if (hasExited) {
            const endingIls = Math.round((gp.ending_chips || 0) / rate * 20)
            const pl = endingIls - total
            return (
              <div key={gp.id} className="player-card" style={{ opacity: 0.7, border: '1px solid var(--border2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div className="player-name-big" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {gp.player_name}
                      <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>יצא</span>
                    </div>
                    <div className="player-stats-row">
                      <div className="stat-pill">השקיע: ₪<strong>{total}</strong></div>
                      <div className="stat-pill">סיים: <strong>{gp.ending_chips}</strong> צ'יפים</div>
                    </div>
                  </div>
                  <div className={pl > 0 ? 'amount-pos' : pl < 0 ? 'amount-neg' : 'amount-zero'} style={{ fontSize: '1.2rem' }}>
                    {pl > 0 ? '+' : ''}₪{pl}
                  </div>
                </div>
              </div>
            )
          }

          return (
            <div key={gp.id} className={`player-card ${count > 0 ? 'active-player' : ''}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="player-name-big">{gp.player_name}</div>
                  <div className="player-stats-row">
                    <div className="stat-pill">₪<strong>{total}</strong></div>
                    {rate !== 20 && <div className="stat-pill"><strong>{totalChips}</strong> צ'יפים</div>}
                    <div className="stat-pill">{count} buys</div>
                    {last && (
                      <div className="stat-pill" style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={11} />{format(new Date(last.recorded_at), 'HH:mm')}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setExpandedPlayer(isExpanded ? null : gp.id)}
                  style={{ padding: '8px 10px', flexShrink: 0 }}
                >
                  <ChevronDown size={16} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                </button>
              </div>

              <div className="quick-buy-grid">
                {QUICK_AMOUNTS.map(amt => (
                  <button key={amt} className="buy-btn" onClick={() => addBuyin(gp.id, amt)}>
                    +{amt}
                    {rate !== 20 && <div style={{ fontSize: '0.65rem', color: 'var(--text3)' }}>{ilsToChips(amt)}🪙</div>}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', marginTop: 6, fontSize: '0.82rem' }}
                onClick={() => { setBuyinModal(gp.id); setCustomAmount('') }}
              >
                <Plus size={13} /> סכום מותאם
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ width: '100%', marginTop: 4, fontSize: '0.78rem', color: 'var(--orange)' }}
                onClick={() => { setEarlyExitModal(gp); setEarlyExitChips('') }}
              >
                🚪 יציאה מוקדמת
              </button>

              {isExpanded && (
                <div style={{ marginTop: 12 }}>
                  <div className="divider" />
                  <div style={{ fontSize: '0.8rem', color: 'var(--text2)', fontWeight: 600, marginBottom: 8 }}>
                    היסטוריה ({count} buy-ins)
                  </div>
                  {pBuyins.length === 0 && (
                    <div style={{ color: 'var(--text3)', fontSize: '0.85rem', padding: '4px 0' }}>אין buy-ins</div>
                  )}
                  {pBuyins.map(b => (
                    <div key={b.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 0', borderBottom: '1px solid var(--border)',
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--gold)' }}>
                          ₪{b.amount_ils}
                          {rate !== 20 && <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: '0.82rem', marginRight: 4 }}>({b.chips} צ'יפים)</span>}
                        </div>
                        <div style={{ fontSize: '0.73rem', color: 'var(--text3)' }}>
                          {format(new Date(b.recorded_at), 'HH:mm, dd/MM/yy')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '6px 8px' }}
                          onClick={() => { setEditModal(b); setEditAmount(String(b.amount_ils)) }}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ padding: '6px 8px', color: 'var(--red)' }}
                          onClick={() => { setDeleteConfirm(b); setDeleteReason('') }}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {deletedBuyins.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginBottom: 4 }}>נמחקו:</div>
                      {deletedBuyins.map(b => (
                        <div key={b.id} style={{ fontSize: '0.78rem', color: 'var(--text3)', opacity: 0.6, textDecoration: 'line-through', padding: '2px 0' }}>
                          ₪{b.amount_ils} — {format(new Date(b.recorded_at), 'HH:mm')}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        <div style={{
          background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0',
        }}>
          <span style={{ color: 'var(--text2)' }}>סה"כ בקופה</span>
          <span style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--gold)' }}>₪{totalPot()}</span>
        </div>

        <button className="btn btn-primary btn-lg" style={{ width: '100%' }}
          onClick={goToEndGame}>
          <Flag size={18} /> סיים משחק
        </button>
      </div>

      {/* Custom buy-in modal */}
      {buyinModal && (
        <div className="modal-overlay" onClick={() => setBuyinModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">💰 Buy-in — {gamePlayers.find(p => p.id === buyinModal)?.player_name}</div>
            {rate !== 20 && <div style={{ color: 'var(--text3)', fontSize: '0.82rem', marginBottom: 12 }}>יחס: ₪20 = {rate} צ'יפים</div>}
            <div className="form-group">
              <label className="form-label">סכום (₪)</label>
              <input type="number" inputMode="numeric" placeholder="0"
                value={customAmount} onChange={e => setCustomAmount(e.target.value)} autoFocus
                onKeyDown={e => e.key === 'Enter' && addBuyin(buyinModal, parseInt(customAmount))} />
              {customAmount && parseInt(customAmount) > 0 && rate !== 20 && (
                <div style={{ marginTop: 6, fontSize: '0.82rem', color: 'var(--gold)' }}>= {ilsToChips(parseInt(customAmount))} צ'יפים</div>
              )}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 14 }}>
              {QUICK_AMOUNTS.map(amt => (
                <button key={amt} className="buy-btn" style={{ padding: '12px' }} onClick={() => addBuyin(buyinModal, amt)}>
                  ₪{amt}{rate !== 20 && <div style={{ fontSize: '0.65rem' }}>{ilsToChips(amt)}🪙</div>}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }}
                onClick={() => addBuyin(buyinModal, parseInt(customAmount))}
                disabled={!customAmount || parseInt(customAmount) <= 0}>הוסף</button>
              <button className="btn btn-ghost" onClick={() => setBuyinModal(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <div className="modal-overlay" onClick={() => setEditModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title"><Edit2 size={18} /> עריכת Buy-in</div>
            <div style={{ color: 'var(--text2)', fontSize: '0.85rem', marginBottom: 12 }}>
              מקורי: ₪{editModal.amount_ils} · {format(new Date(editModal.recorded_at), 'HH:mm, dd/MM')}
            </div>
            <div className="form-group">
              <label className="form-label">סכום חדש (₪)</label>
              <input type="number" inputMode="numeric" value={editAmount}
                onChange={e => setEditAmount(e.target.value)} autoFocus
                onKeyDown={e => e.key === 'Enter' && confirmEdit()} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmEdit}>שמור</button>
              <button className="btn btn-ghost" onClick={() => setEditModal(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title" style={{ color: 'var(--red)' }}><Trash2 size={18} /> מחיקת Buy-in</div>
            <div style={{ color: 'var(--text2)', marginBottom: 14 }}>
              מחק buy-in של <strong style={{ color: 'var(--gold)' }}>₪{deleteConfirm.amount_ils}</strong>?
            </div>
            <div className="form-group">
              <label className="form-label">סיבה</label>
              <input value={deleteReason} onChange={e => setDeleteReason(e.target.value)}
                placeholder="הוזן בטעות" autoFocus onKeyDown={e => e.key === 'Enter' && confirmDelete()} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={confirmDelete}>מחק</button>
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* Add player mid-game modal */}
      {addPlayerModal && (
        <div className="modal-overlay" onClick={() => setAddPlayerModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title"><UserPlus size={18} /> הוסף שחקן למשחק</div>

            {availableToAdd.length > 0 && (
              <>
                <div className="form-label" style={{ marginBottom: 8 }}>בחר מהרשימה:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  {availableToAdd.map(p => (
                    <button key={p.id}
                      onClick={() => setSelectedExistingPlayer(selectedExistingPlayer?.id === p.id ? null : p)}
                      style={{
                        padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                        border: `2px solid ${selectedExistingPlayer?.id === p.id ? 'var(--gold)' : 'var(--border)'}`,
                        background: selectedExistingPlayer?.id === p.id ? 'rgba(212,168,83,0.15)' : 'var(--bg3)',
                        color: selectedExistingPlayer?.id === p.id ? 'var(--gold)' : 'var(--text)',
                        fontFamily: 'Heebo', cursor: 'pointer', fontSize: '0.9rem',
                      }}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
                <div style={{ color: 'var(--text3)', fontSize: '0.82rem', textAlign: 'center', marginBottom: 12 }}>— או —</div>
              </>
            )}

            <div className="form-group">
              <label className="form-label">שם שחקן חדש</label>
              <input
                value={newPlayerName}
                onChange={e => { setNewPlayerName(e.target.value); setSelectedExistingPlayer(null) }}
                placeholder="הכנס שם..."
                autoFocus={availableToAdd.length === 0}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={addPlayerMidGame}>
                הוסף למשחק
              </button>
              <button className="btn btn-ghost" onClick={() => { setAddPlayerModal(false); setNewPlayerName(''); setSelectedExistingPlayer(null) }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense modal */}
      {expenseModal && (
        <div className="modal-overlay" onClick={() => { setExpenseModal(false); setEditingExpense(null) }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">
              <ShoppingCart size={18} /> {editingExpense ? 'עריכת הוצאה' : 'הוצאה משותפת'}
            </div>

            <div className="form-group">
              <label className="form-label">מי שילם?</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {gamePlayers.map(p => (
                  <button key={p.id}
                    onClick={() => setExpensePaidBy(p.player_name)}
                    style={{
                      padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                      border: `2px solid ${expensePaidBy === p.player_name ? 'var(--gold)' : 'var(--border)'}`,
                      background: expensePaidBy === p.player_name ? 'rgba(212,168,83,0.15)' : 'var(--bg3)',
                      color: expensePaidBy === p.player_name ? 'var(--gold)' : 'var(--text)',
                      fontFamily: 'Heebo', cursor: 'pointer', fontSize: '0.9rem',
                    }}
                  >
                    {p.player_name}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">סכום (₪)</label>
              <input type="number" inputMode="numeric" placeholder="0"
                value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="form-label">תיאור (אופציונלי)</label>
              <input value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} placeholder="נשנושים, שתייה..." />
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>מי חולק? ({expenseSplitAmong.length}/{gamePlayers.length})</span>
                <button
                  onClick={() => setExpenseSplitAmong(
                    expenseSplitAmong.length === gamePlayers.length
                      ? [] : gamePlayers.map(p => p.player_name)
                  )}
                  style={{ background: 'none', border: 'none', color: 'var(--gold)', fontFamily: 'Heebo', fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  {expenseSplitAmong.length === gamePlayers.length ? 'בטל הכל' : 'בחר הכל'}
                </button>
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {gamePlayers.map(p => (
                  <button key={p.id}
                    onClick={() => toggleSplitPlayer(p.player_name)}
                    style={{
                      padding: '8px 14px', borderRadius: 'var(--radius-sm)',
                      border: `2px solid ${expenseSplitAmong.includes(p.player_name) ? 'var(--green)' : 'var(--border)'}`,
                      background: expenseSplitAmong.includes(p.player_name) ? 'rgba(46,204,113,0.12)' : 'var(--bg3)',
                      color: expenseSplitAmong.includes(p.player_name) ? 'var(--green)' : 'var(--text)',
                      fontFamily: 'Heebo', cursor: 'pointer', fontSize: '0.9rem',
                    }}
                  >
                    {expenseSplitAmong.includes(p.player_name) ? '✓ ' : ''}{p.player_name}
                  </button>
                ))}
              </div>
              {expenseSplitAmong.length > 0 && expenseAmount && (
                <div style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--text2)' }}>
                  ₪{Math.round(parseInt(expenseAmount) / expenseSplitAmong.length)} לכל אחד
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={addExpense}>
                שמור הוצאה
              </button>
              <button className="btn btn-ghost" onClick={() => { setExpenseModal(false); setEditingExpense(null) }}>ביטול</button>
            </div>
          </div>
        </div>
      )}
      {/* Early exit modal */}
      {earlyExitModal && (
        <div className="modal-overlay" onClick={() => setEarlyExitModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">🚪 יציאה מוקדמת — {earlyExitModal.player_name}</div>
            <div style={{ color: 'var(--text2)', fontSize: '0.9rem', marginBottom: 16 }}>
              השקיע: ₪{playerTotal(earlyExitModal.id)} · {activeBuyins(earlyExitModal.id).length} buy-ins
            </div>
            <div className="form-group">
              <label className="form-label">כמה צ'יפים הוא מחזיר לקופה?</label>
              <input
                type="number" inputMode="numeric" placeholder="0"
                value={earlyExitChips}
                onChange={e => setEarlyExitChips(e.target.value)}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && confirmEarlyExit()}
              />
              {earlyExitChips !== '' && (
                <div style={{ marginTop: 8, fontSize: '0.85rem' }}>
                  {(() => {
                    const chips = parseInt(earlyExitChips) || 0
                    const endingIls = Math.round(chips / rate * 20)
                    const pl = endingIls - playerTotal(earlyExitModal.id)
                    return (
                      <span className={pl > 0 ? 'amount-pos' : pl < 0 ? 'amount-neg' : 'amount-zero'}>
                        תוצאה: {pl > 0 ? '+' : ''}₪{pl}
                      </span>
                    )
                  })()}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={confirmEarlyExit}>
                אשר יציאה
              </button>
              <button className="btn btn-ghost" onClick={() => setEarlyExitModal(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
function InlineEndGame({ game, gamePlayers, buyins, expenses, onBack, onDone, gameId }) {
  const showToast = useToast()
  const rate = game?.chips_per_20 || 20
  const [chips, setChips] = useState({})
  const [saving, setSaving] = useState(false)

  // Pre-fill existing
  useEffect(() => {
    const initial = {}
    gamePlayers.forEach(p => { if (p.ending_chips != null) initial[p.id] = String(p.ending_chips) })
    setChips(initial)
  }, [gamePlayers])

  const chipsToIls = (c) => Math.round(c / rate * 20)
  const activeBuyins = (gpId) => buyins.filter(b => b.game_player_id === gpId && !b.deleted_at)
  const playerTotal = (gpId) => activeBuyins(gpId).reduce((s, b) => s + b.amount_ils, 0)
  const totalPot = () => buyins.filter(b => !b.deleted_at).reduce((s, b) => s + b.amount_ils, 0)
  const totalChipsInGame = () => buyins.filter(b => !b.deleted_at).reduce((s, b) => s + b.chips, 0)

  // Chips entered = manually entered + early exited players' chips
  const totalChipsEntered = () => {
    const manual = Object.values(chips).reduce((s, v) => s + (parseInt(v) || 0), 0)
    const exited = gamePlayers.filter(gp => gp.exited_at).reduce((s, gp) => s + (gp.ending_chips || 0), 0)
    return manual + exited
  }

  const chipsBalanced = () => totalChipsEntered() === totalChipsInGame()
  const profitLoss = (gpId) => chipsToIls(parseInt(chips[gpId]) || 0) - playerTotal(gpId)

  async function endGame() {
    const missing = gamePlayers.filter(gp => !chips[gp.id] && chips[gp.id] !== '0')
    if (missing.length > 0) { showToast(`חסרים צ'יפים עבור: ${missing.map(p => p.player_name).join(', ')}`, 'error'); return }

    setSaving(true)
    try {
      for (const gp of gamePlayers) {
        await supabase.from('game_players').update({ ending_chips: parseInt(chips[gp.id]) || 0 }).eq('id', gp.id)
      }

      const updatedPlayers = gamePlayers.map(gp => ({ ...gp, ending_chips: parseInt(chips[gp.id]) || 0 }))
      const balances = computeBalances(updatedPlayers, buyins, rate, expenses)
      const transfers = computeSettlements(balances)

      if (transfers.length > 0) {
        await supabase.from('settlements').insert(transfers.map(t => ({
          game_id: gameId,
          from_player_id: t.from_player_id, to_player_id: t.to_player_id,
          from_player_name: t.from_player_name, to_player_name: t.to_player_name,
          required_amount: t.required_amount,
        })))
      }

      await supabase.from('games').update({ status: 'ended', ended_at: new Date().toISOString() }).eq('id', gameId)
      showToast('המשחק הסתיים ✓', 'success')
      onDone()
    } catch (err) {
      showToast('שגיאה בסיום המשחק', 'error')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  const pot = totalPot()
  const totalChipsGame = totalChipsInGame()
  const chipsEntered = totalChipsEntered()
  const balanced = chipsBalanced()

  return (
    <div className="screen">
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={onBack}><ChevronRight size={18} /></button>
        <div><div className="header-title">סיום משחק</div><div className="header-sub">הכנס צ'יפים סיום</div></div>
        <div style={{ width: 60 }} />
      </div>
      <div className="content">
        <div className="card" style={{ marginBottom: 16, textAlign: 'center' }}>
          <div style={{ color: 'var(--text2)', fontSize: '0.85rem', marginBottom: 4 }}>סה"כ קופה</div>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--gold)' }}>₪{pot}</div>
          {rate !== 20 && <div style={{ color: 'var(--text3)', fontSize: '0.8rem', marginTop: 4 }}>= {totalChipsGame} צ'יפים · יחס: ₪20 = {rate} צ'יפים</div>}
        </div>

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--orange)', fontSize: '0.85rem', marginBottom: 12, padding: '8px 12px', background: 'rgba(230,126,34,0.1)', borderRadius: 'var(--radius-sm)' }}>
            <AlertTriangle size={16} />
            <span>{chipsEntered > totalChipsGame ? `יש ${chipsEntered - totalChipsGame} צ'יפים יותר` : `חסרים ${totalChipsGame - chipsEntered} צ'יפים`}</span>
          </div>
        )}

        <div className="section-title">צ'יפים לפי שחקן</div>
        {gamePlayers.map(gp => {
          // Skip players who already exited early
          if (gp.exited_at) {
            const endingIls = Math.round((gp.ending_chips || 0) / rate * 20)
            const pl = endingIls - playerTotal(gp.id)
            return (
              <div key={gp.id} className="card" style={{ marginBottom: 10, opacity: 0.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {gp.player_name}
                      <span className="badge badge-gray" style={{ fontSize: '0.7rem' }}>יצא מוקדם</span>
                    </div>
                    <div style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>סיים עם {gp.ending_chips} צ'יפים</div>
                  </div>
                  <div className={pl > 0 ? 'amount-pos' : pl < 0 ? 'amount-neg' : 'amount-zero'}>
                    {pl > 0 ? '+' : ''}₪{pl}
                  </div>
                </div>
              </div>
            )
          }

          const total = playerTotal(gp.id)
          const hasValue = chips[gp.id] !== undefined && chips[gp.id] !== ''
          const pl = hasValue ? profitLoss(gp.id) : null

          return (
            <div key={gp.id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{gp.player_name}</div>
                  <div style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>השקיע: ₪{total}</div>
                </div>
                {pl !== null && (
                  <div className={pl > 0 ? 'amount-pos' : pl < 0 ? 'amount-neg' : 'amount-zero'}>
                    {pl > 0 ? '+' : ''}₪{pl}
                  </div>
                )}
              </div>
              <input
                type="number" inputMode="numeric" placeholder="מספר צ'יפים..."
                value={chips[gp.id] ?? ''}
                onChange={e => setChips(prev => ({ ...prev, [gp.id]: e.target.value }))}
              />
            </div>
          )
        })}

        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%', marginTop: 20 }}
          onClick={endGame}
          disabled={saving || !balanced}
        >
          {saving ? 'שומר...' : <><Trophy size={18} /> סיים וצור סילוקים</>}
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
