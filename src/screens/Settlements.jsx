import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { settlementStatus } from '../utils/settlement'
import { useToast } from '../lib/toast'
import { useAdmin } from '../lib/adminAuth'
import { format } from 'date-fns'
import { ChevronRight, Plus, CreditCard, Banknote, Smartphone, CheckCircle, Clock, AlertCircle } from 'lucide-react'

const METHOD_ICONS = {
  cash: <Banknote size={14} />,
  bit: <Smartphone size={14} />,
  paybox: <CreditCard size={14} />,
}

const METHOD_LABELS = {
  cash: 'מזומן',
  bit: 'ביט',
  paybox: 'פייבוקס',
}

export default function Settlements() {
  const { gameId } = useParams()
  const navigate = useNavigate()
  const showToast = useToast()
  const { isAdmin } = useAdmin()

  const [game, setGame] = useState(null)
  const [gamePlayers, setGamePlayers] = useState([])
  const [buyins, setBuyins] = useState([])
  const [settlements, setSettlements] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [paymentModal, setPaymentModal] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [payNote, setPayNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('settlements')

  useEffect(() => {
    loadData()
    const channel = supabase
      .channel(`settlements-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settlement_payments' }, loadData)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [gameId])

  async function loadData() {
    const [{ data: g }, { data: gp }, { data: b }, { data: s }, { data: p }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase.from('game_players').select('*').eq('game_id', gameId),
      supabase.from('buyins').select('*').eq('game_id', gameId),
      supabase.from('settlements').select('*').eq('game_id', gameId),
      supabase.from('settlement_payments').select('*'),
    ])
    setGame(g)
    setGamePlayers(gp || [])
    setBuyins(b || [])
    setSettlements(s || [])
    setPayments(p || [])
    setLoading(false)
  }

  const rate = game?.chips_per_20 || 20
  const chipsToIls = (chips) => Math.round(chips / rate * 20)

  function settlementPayments(sId) {
    return payments.filter(p => p.settlement_id === sId)
  }

  async function addPayment() {
    const amount = parseInt(payAmount)
    if (!amount || amount <= 0) return
    const { remaining } = settlementStatus(paymentModal, settlementPayments(paymentModal.id))
    if (amount > remaining) { showToast(`הסכום גדול מהיתרה (₪${remaining})`, 'error'); return }

    setSaving(true)
    const { data, error } = await supabase
      .from('settlement_payments')
      .insert({ settlement_id: paymentModal.id, amount, method: payMethod, note: payNote || null })
      .select().single()

    if (error) { showToast('שגיאה ברישום תשלום', 'error'); setSaving(false); return }

    setPayments(prev => [...prev, data])
    setPaymentModal(null); setPayAmount(''); setPayNote('')
    setSaving(false)
    showToast(`תשלום ₪${amount} נרשם ✓`, 'success')
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  return (
    <div className="screen">
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}><ChevronRight size={18} /></button>
        <div>
          <div className="header-title">סילוקים</div>
          <div className="header-sub">{game?.title}</div>
        </div>
        <div style={{ width: 60 }} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg2)' }}>
        {[
          { key: 'settlements', label: 'העברות' },
          { key: 'summary', label: 'סיכום' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            flex: 1, padding: '12px', border: 'none', background: 'none',
            color: activeTab === tab.key ? 'var(--gold)' : 'var(--text2)',
            fontFamily: 'Heebo', fontWeight: 600, fontSize: '0.9rem',
            borderBottom: `2px solid ${activeTab === tab.key ? 'var(--gold)' : 'transparent'}`,
            cursor: 'pointer',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="content" style={{ paddingBottom: 24 }}>
        {activeTab === 'settlements' && (
          <>
            <div className="section-title">העברות מומלצות</div>
            {settlements.length === 0 ? (
              <div className="empty-state">
                <CheckCircle />
                <p>אין העברות — כולם בפלוס!</p>
              </div>
            ) : (
              settlements.map(s => {
                const sPayments = settlementPayments(s.id)
                const { paid, remaining, status } = settlementStatus(s, sPayments)
                const statusConfig = {
                  unpaid: { label: 'לא שולם', cls: 'badge-red', icon: <AlertCircle size={12} /> },
                  partial: { label: 'חלקי', cls: 'badge-orange', icon: <Clock size={12} /> },
                  paid: { label: 'שולם', cls: 'badge-green', icon: <CheckCircle size={12} /> },
                }
                const sc = statusConfig[status]

                return (
                  <div key={s.id} className="settlement-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span className={`badge ${sc.cls}`}>{sc.icon} {sc.label}</span>
                    </div>
                    <div className="transfer-arrow">
                      <span style={{ color: 'var(--red)', fontWeight: 800 }}>{s.from_player_name}</span>
                      <span style={{ color: 'var(--text3)' }}>←</span>
                      <span style={{ color: 'var(--green)', fontWeight: 800 }}>{s.to_player_name}</span>
                    </div>
                    <div className="transfer-amount">₪{s.required_amount}</div>

                    {paid > 0 && (
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text2)', marginBottom: 4 }}>
                          <span>שולם: ₪{paid}</span>
                          <span>נותר: <strong style={{ color: remaining > 0 ? 'var(--orange)' : 'var(--green)' }}>₪{remaining}</strong></span>
                        </div>
                        <div style={{ height: 4, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, (paid / s.required_amount) * 100)}%`,
                            background: status === 'paid' ? 'var(--green)' : 'var(--gold)',
                            borderRadius: 4, transition: 'width 0.3s',
                          }} />
                        </div>
                      </div>
                    )}

                    {sPayments.map(p => (
                      <div key={p.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '6px 8px', background: 'var(--bg3)', borderRadius: 'var(--radius-sm)',
                        marginBottom: 4, fontSize: '0.82rem',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text2)' }}>
                          {METHOD_ICONS[p.method]} {METHOD_LABELS[p.method]}
                          {p.note && <span style={{ color: 'var(--text3)' }}>· {p.note}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ color: 'var(--text3)' }}>{format(new Date(p.paid_at), 'HH:mm')}</span>
                          <strong style={{ color: 'var(--green)' }}>₪{p.amount}</strong>
                        </div>
                      </div>
                    ))}

                    {status !== 'paid' && isAdmin && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ width: '100%', marginTop: 8 }}
                        onClick={() => { setPaymentModal(s); setPayAmount(String(remaining)); setPayMethod('cash'); setPayNote('') }}
                      >
                        <Plus size={14} /> רשום תשלום
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </>
        )}

        {activeTab === 'summary' && (
          <>
            <div className="section-title">סיכום שחקנים</div>
            {[...gamePlayers]
              .sort((a, b) => {
                const plA = chipsToIls(a.ending_chips ?? 0) - buyins.filter(x => x.game_player_id === a.id && !x.deleted_at).reduce((s, x) => s + x.amount_ils, 0)
                const plB = chipsToIls(b.ending_chips ?? 0) - buyins.filter(x => x.game_player_id === b.id && !x.deleted_at).reduce((s, x) => s + x.amount_ils, 0)
                return plB - plA
              })
              .map((gp, i) => {
                const activeBuyinsArr = buyins.filter(b => b.game_player_id === gp.id && !b.deleted_at)
                const totalBuyins = activeBuyinsArr.reduce((s, b) => s + b.amount_ils, 0)
                const ending = gp.ending_chips ?? 0
                const endingIls = chipsToIls(ending)
                const pl = endingIls - totalBuyins
                const medals = ['🥇', '🥈', '🥉']

                return (
                  <div key={gp.id} className="card" style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: '1.3rem' }}>{medals[i] || ''}</span>
                        <div>
                          <div style={{ fontWeight: 700 }}>{gp.player_name}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>
                            השקיע ₪{totalBuyins} · סיים {ending} צ'יפים
                            {rate !== 20 && ` (₪${endingIls})`}
                          </div>
                        </div>
                      </div>
                      <div className={pl > 0 ? 'amount-pos' : pl < 0 ? 'amount-neg' : 'amount-zero'}
                        style={{ fontSize: '1.3rem' }}>
                        {pl > 0 ? '+' : ''}₪{pl}
                      </div>
                    </div>
                  </div>
                )
              })}
          </>
        )}
      </div>

      {/* Payment modal */}
      {paymentModal && (
        <div className="modal-overlay" onClick={() => setPaymentModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">💸 רשום תשלום</div>
            <div style={{ marginBottom: 12, color: 'var(--text2)', fontSize: '0.9rem' }}>
              {paymentModal.from_player_name} → {paymentModal.to_player_name}
            </div>
            <div className="form-group">
              <label className="form-label">סכום (₪)</label>
              <input type="number" inputMode="numeric" value={payAmount}
                onChange={e => setPayAmount(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">אמצעי תשלום</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {['cash', 'bit', 'paybox'].map(m => (
                  <button key={m} onClick={() => setPayMethod(m)} style={{
                    flex: 1, padding: '10px',
                    border: `2px solid ${payMethod === m ? 'var(--gold)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    background: payMethod === m ? 'rgba(212,168,83,0.15)' : 'var(--bg3)',
                    color: payMethod === m ? 'var(--gold)' : 'var(--text2)',
                    fontFamily: 'Heebo', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                  }}>
                    {METHOD_ICONS[m]} {METHOD_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">הערה (אופציונלי)</label>
              <input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder="הערה..." />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={addPayment}
                disabled={saving || !payAmount}>
                {saving ? 'שומר...' : 'רשום תשלום'}
              </button>
              <button className="btn btn-ghost" onClick={() => setPaymentModal(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
