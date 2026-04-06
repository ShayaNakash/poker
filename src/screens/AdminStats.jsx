import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/authContext'
import { format } from 'date-fns'
import { he } from 'date-fns/locale'
import { ChevronRight, ChevronDown, Users, Gamepad2, TrendingUp, Wifi, RefreshCw, Circle } from 'lucide-react'

const ADMIN_EMAILS = ['shayanakash1@gmail.com', 'idanakash@gmail.com']
const ONLINE_THRESHOLD_MINUTES = 5

export default function AdminStats() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showUsers, setShowUsers] = useState(false)
  const [expandedUser, setExpandedUser] = useState(null)
  const [userGames, setUserGames] = useState({}) // { [userId]: games[] }
  const [loadingGames, setLoadingGames] = useState(null)

  const [stats, setStats] = useState({
    totalUsers: 0,
    newUsersWeek: 0,
    newUsersToday: 0,
    totalGames: 0,
    activeGames: 0,
    gamesThisWeek: 0,
    totalBuyins: 0,
    onlineUsers: 0,
    recentUsers: [],
    recentGames: [],
    allProfiles: [],
    onlineUserIds: [],
  })

  useEffect(() => {
    if (!user) return
    const updatePresence = async () => {
      await supabase.from('user_presence').upsert({
        user_id: user.id,
        last_seen: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    }
    updatePresence()
    const interval = setInterval(updatePresence, 60000)
    return () => clearInterval(interval)
  }, [user])

  const loadStats = useCallback(async () => {
    setRefreshing(true)
    try {
      const now = new Date()
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
      const todayStart = new Date(now.setHours(0,0,0,0)).toISOString()
      const onlineThreshold = new Date(Date.now() - ONLINE_THRESHOLD_MINUTES * 60 * 1000).toISOString()

      const [
        { count: totalUsers },
        { count: newUsersWeek },
        { count: newUsersToday },
        { count: totalGames },
        { count: activeGames },
        { count: gamesThisWeek },
        { count: totalBuyins },
        { count: onlineUsers },
        { data: recentGames },
        { data: recentUsers },
        { data: allProfiles },
        { data: onlinePresence },
      ] = await Promise.all([
        supabase.from('games').select('*', { count: 'exact', head: true }),
        supabase.from('games').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
        supabase.from('games').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
        supabase.from('games').select('*', { count: 'exact', head: true }),
        supabase.from('games').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('games').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
        supabase.from('buyins').select('*', { count: 'exact', head: true }).is('deleted_at', null),
        supabase.from('user_presence').select('*', { count: 'exact', head: true }).gte('last_seen', onlineThreshold),
        supabase.from('games').select('*').order('created_at', { ascending: false }).limit(8),
        supabase.from('players').select('*').order('created_at', { ascending: false }).limit(8),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('user_presence').select('user_id').gte('last_seen', onlineThreshold),
      ])

      const onlineUserIds = (onlinePresence || []).map(p => p.user_id)

      setStats({
        totalUsers: totalUsers || 0,
        newUsersWeek: newUsersWeek || 0,
        newUsersToday: newUsersToday || 0,
        totalGames: totalGames || 0,
        activeGames: activeGames || 0,
        gamesThisWeek: gamesThisWeek || 0,
        totalBuyins: totalBuyins || 0,
        onlineUsers: onlineUsers || 0,
        recentGames: recentGames || [],
        recentUsers: recentUsers || [],
        allProfiles: allProfiles || [],
        onlineUserIds,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [loadStats])

  async function toggleUserGames(profile) {
    if (expandedUser === profile.id) {
      setExpandedUser(null)
      return
    }
    setExpandedUser(profile.id)
    if (userGames[profile.id]) return // already loaded

    setLoadingGames(profile.id)
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
    setUserGames(prev => ({ ...prev, [profile.id]: data || [] }))
    setLoadingGames(null)
  }

  if (!ADMIN_EMAILS.includes(user?.email)) {
    return (
      <div className="loading-screen">
        <div style={{ textAlign: 'center', color: 'var(--text2)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🔒</div>
          <div>אין הרשאה</div>
        </div>
      </div>
    )
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>

  const statusLabel = {
    active: { label: 'פעיל', cls: 'badge-green' },
    ended: { label: 'הסתיים', cls: 'badge-blue' },
    locked: { label: 'נעול', cls: 'badge-gray' },
  }

  return (
    <div className="screen">
      <div className="header">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}><ChevronRight size={18} /></button>
        <div>
          <div className="header-title">📊 Admin Dashboard</div>
          <div className="header-sub">ZugKing Stats</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadStats} disabled={refreshing}>
          <RefreshCw size={16} style={{ animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }} />
        </button>
      </div>

      <div className="content" style={{ paddingBottom: 32 }}>

        {/* Online now */}
        <div style={{
          background: stats.onlineUsers > 0 ? 'rgba(46,204,113,0.1)' : 'var(--card)',
          border: `1px solid ${stats.onlineUsers > 0 ? 'var(--green)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ position: 'relative' }}>
            <Wifi size={22} color={stats.onlineUsers > 0 ? 'var(--green)' : 'var(--text3)'} />
            {stats.onlineUsers > 0 && (
              <span className="pulse" style={{
                position: 'absolute', top: -2, right: -2,
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--green)', display: 'block'
              }} />
            )}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.3rem', color: stats.onlineUsers > 0 ? 'var(--green)' : 'var(--text3)' }}>
              {stats.onlineUsers} משתמשים Online
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text3)' }}>
              פעילים ב-{ONLINE_THRESHOLD_MINUTES} דקות האחרונות
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { icon: <Users size={18} />, label: 'משתמשים רשומים', value: stats.allProfiles.length, sub: `+${stats.newUsersWeek} השבוע`, color: 'var(--blue)' },
            { icon: <Users size={18} />, label: 'הצטרפו היום', value: stats.newUsersToday, sub: `+${stats.newUsersWeek} השבוע`, color: 'var(--gold)' },
            { icon: <Gamepad2 size={18} />, label: 'סה"כ משחקים', value: stats.totalGames, sub: `${stats.gamesThisWeek} השבוע`, color: 'var(--purple)' },
            { icon: <Gamepad2 size={18} />, label: 'משחקים פעילים', value: stats.activeGames, sub: 'כרגע', color: 'var(--green)' },
            { icon: <TrendingUp size={18} />, label: 'סה"כ Buy-ins', value: stats.totalBuyins, sub: 'כל הזמנים', color: 'var(--orange)' },
            { icon: <TrendingUp size={18} />, label: 'משחקים השבוע', value: stats.gamesThisWeek, sub: '7 ימים אחרונים', color: 'var(--red)' },
          ].map((s, i) => (
            <div key={i} className="card" style={{ textAlign: 'center' }}>
              <div style={{ color: s.color, marginBottom: 6 }}>{s.icon}</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--text)' }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginTop: 2 }}>{s.label}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text3)', marginTop: 2 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Recent games */}
        <div className="section-title">משחקים אחרונים</div>
        {stats.recentGames.map(game => {
          const s = statusLabel[game.status] || statusLabel.active
          return (
            <div key={game.id} className="card" style={{ marginBottom: 8, cursor: 'pointer' }}
              onClick={() => navigate(game.status === 'active' ? `/view/${game.viewer_token}` : `/game/${game.id}/settlements`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{game.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text3)' }}>
                    {format(new Date(game.created_at), 'dd/MM/yy HH:mm', { locale: he })}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge ${s.cls}`}>{s.label}</span>
                  <ChevronRight size={14} color="var(--text3)" />
                </div>
              </div>
            </div>
          )
        })}

        {/* Users list — collapsible */}
        <button
          onClick={() => setShowUsers(prev => !prev)}
          style={{
            width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'none', border: 'none', padding: '16px 0 10px',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            משתמשים רשומים ({stats.allProfiles.length})
          </span>
          <ChevronDown size={16} color="var(--text3)"
            style={{ transform: showUsers ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
        </button>

        {showUsers && stats.allProfiles.map(profile => {
          const isOnline = stats.onlineUserIds.includes(profile.id)
          const isExpanded = expandedUser === profile.id
          const games = userGames[profile.id] || []
          const isLoadingThis = loadingGames === profile.id

          return (
            <div key={profile.id} className="card" style={{ marginBottom: 8 }}>
              {/* User row */}
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                onClick={() => toggleUserGames(profile)}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{profile.email}</div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text3)', marginTop: 2 }}>
                    נרשם: {format(new Date(profile.created_at), 'dd/MM/yy', { locale: he })}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Circle
                    size={10}
                    fill={isOnline ? 'var(--green)' : 'var(--border)'}
                    color={isOnline ? 'var(--green)' : 'var(--border)'}
                  />
                  <span style={{ fontSize: '0.72rem', color: isOnline ? 'var(--green)' : 'var(--text3)' }}>
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                  <ChevronDown size={14} color="var(--text3)"
                    style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                </div>
              </div>

              {/* Expanded games */}
              {isExpanded && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  {isLoadingThis ? (
                    <div style={{ textAlign: 'center', padding: 8 }}><div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /></div>
                  ) : games.length === 0 ? (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text3)', textAlign: 'center', padding: '8px 0' }}>אין משחקים</div>
                  ) : (
                    games.map(game => {
                      const s = statusLabel[game.status] || statusLabel.active
                      return (
                        <div
                          key={game.id}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                            background: 'var(--bg3)', marginBottom: 6, cursor: 'pointer',
                          }}
                          onClick={() => navigate(
                            game.status === 'active'
                              ? `/view/${game.viewer_token}`
                              : `/game/${game.id}/settlements`
                          )}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{game.title || 'ערב פוקר'}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text3)' }}>
                              {format(new Date(game.created_at), 'dd/MM/yy HH:mm', { locale: he })}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span className={`badge ${s.cls}`} style={{ fontSize: '0.68rem', padding: '2px 8px' }}>{s.label}</span>
                            <ChevronRight size={12} color="var(--text3)" />
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Recent players */}
        <div className="section-title">שחקנים אחרונים שנוספו</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {stats.recentUsers.map(p => (
            <div key={p.id} style={{
              background: 'var(--card)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '6px 12px',
              fontSize: '0.85rem', color: 'var(--text)',
            }}>
              {p.name}
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, color: 'var(--text3)', fontSize: '0.75rem' }}>
          מתרענן אוטומטית כל 30 שניות
        </div>
      </div>
    </div>
  )
}
