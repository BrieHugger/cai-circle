import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from './config/supabase'
import { CATEGORIES, RATING_DIMS } from './config/categories'
import L from 'leaflet'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY

// ─── Helpers ────────────────────────────────────────────────────
function avgRating(reviews) {
  if (!reviews?.length) return null
  const total = reviews.reduce((sum, r) => {
    const vals = Object.values(r.ratings || {})
    return sum + (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0)
  }, 0)
  return total / reviews.length
}

function dimAvg(reviews, dimId) {
  if (!reviews?.length) return null
  const vals = reviews.map(r => r.ratings?.[dimId]).filter(Boolean)
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
}

function scoreColor(n) {
  if (n === null) return 'var(--mut)'
  if (n >= 4) return 'var(--sg)'
  if (n >= 2.5) return 'var(--am)'
  return 'var(--rd)'
}

function scoreClass(n) {
  if (n === null) return ''
  if (n >= 4) return 'score-good'
  if (n >= 2.5) return 'score-mid'
  return 'score-bad'
}

function stars(n) {
  const r = Math.round(n)
  return '★'.repeat(r) + '☆'.repeat(5 - r)
}

function initials(name) {
  return (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
}

function getCat(id) {
  return CATEGORIES.find(c => c.id === id) || { label: id, color: '#888' }
}

function toEmail(username) {
  return `${username.toLowerCase().replace(/\s+/g, '_')}@caicircle.app`
}

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [dark, setDark]       = useState(() => localStorage.getItem('cai-theme') === 'dark')
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [vendors, setVendors] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView]       = useState('list')
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [filterCat, setFilterCat] = useState('all')
  const [showAddVendor, setShowAddVendor]     = useState(false)
  const [showFieldReport, setShowFieldReport] = useState(false)
  const [showAdminPanel, setShowAdminPanel]   = useState(false)
  const [reviews, setReviews]         = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '')
    localStorage.setItem('cai-theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setProfile(null); setLoading(false); return }
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data))
  }, [session])

  useEffect(() => {
    if (!session) return
    setLoading(true)
    supabase.from('vendors').select('*').order('name')
      .then(({ data }) => { setVendors(data || []); setLoading(false) })
  }, [session])

  useEffect(() => {
    if (!selectedVendor) return
    setReviewsLoading(true)
    supabase.from('reviews')
      .select('*, profiles(username, avatar_url), review_comments(*, profiles(username))')
      .eq('vendor_id', selectedVendor.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setReviews(data || []); setReviewsLoading(false) })
  }, [selectedVendor])

  function selectVendor(v) { setSelectedVendor(v); setView('detail'); window.scrollTo(0, 0) }
  function goBack() { setSelectedVendor(null); setView('list') }

  async function deleteVendor(id) {
    if (!confirm('Delete this vendor and all their field reports? This cannot be undone.')) return
    await supabase.from('vendors').delete().eq('id', id)
    setVendors(v => v.filter(x => x.id !== id))
    goBack()
  }

  async function flagVendor(v) {
    const reason = prompt('Briefly describe the issue:')
    if (!reason) return
    await supabase.from('vendors').update({ flagged: true, flagged_reason: reason }).eq('id', v.id)
    setVendors(vs => vs.map(x => x.id === v.id ? { ...x, flagged: true, flagged_reason: reason } : x))
    setSelectedVendor(sv => sv ? { ...sv, flagged: true, flagged_reason: reason } : sv)
  }

  async function unflagVendor(v) {
    await supabase.from('vendors').update({ flagged: false, flagged_reason: null }).eq('id', v.id)
    setVendors(vs => vs.map(x => x.id === v.id ? { ...x, flagged: false, flagged_reason: null } : x))
    setSelectedVendor(sv => sv ? { ...sv, flagged: false, flagged_reason: null } : sv)
  }

  async function deleteReview(id) {
    if (!confirm('Delete this field report?')) return
    await supabase.from('reviews').delete().eq('id', id)
    setReviews(r => r.filter(x => x.id !== id))
  }

  const filteredVendors = vendors.filter(v => filterCat === 'all' || v.category === filterCat)

  if (!session) return <AuthScreen dark={dark} setDark={setDark} />

  return (
    <div className="app">
      <Header
        dark={dark} setDark={setDark}
        view={view} setView={v => { setView(v); setSelectedVendor(null) }}
        showBack={!!selectedVendor} onBack={goBack}
        onAddVendor={() => setShowAddVendor(true)}
        onFieldReport={() => setShowFieldReport(true)}
        profile={profile}
        onSignOut={() => supabase.auth.signOut()}
        onAdmin={() => setShowAdminPanel(true)}
      />

      {view === 'detail' && selectedVendor ? (
        <DetailView
          vendor={selectedVendor} reviews={reviews} reviewsLoading={reviewsLoading}
          profile={profile}
          onFieldReport={() => setShowFieldReport(true)}
          onDeleteVendor={deleteVendor}
          onDeleteReview={deleteReview}
          onFlag={flagVendor} onUnflag={unflagVendor}
          onCommentAdded={(reviewId, comment) =>
            setReviews(rs => rs.map(r => r.id === reviewId
              ? { ...r, review_comments: [...(r.review_comments || []), comment] } : r))
          }
        />
      ) : view === 'map' ? (
        <MapView vendors={filteredVendors} onSelect={selectVendor} dark={dark} />
      ) : (
        <ListView
          vendors={filteredVendors} loading={loading}
          filterCat={filterCat} setFilterCat={setFilterCat}
          onSelect={selectVendor}
        />
      )}

      {showAddVendor && (
        <AddVendorModal profile={profile}
          onClose={() => setShowAddVendor(false)}
          onSaved={v => { setVendors(vs => [...vs, v].sort((a, b) => a.name.localeCompare(b.name))); setShowAddVendor(false) }}
        />
      )}

      {showFieldReport && (
        <FieldReportModal
          vendors={vendors} profile={profile}
          preselectedVendor={selectedVendor}
          onClose={() => setShowFieldReport(false)}
          onSaved={r => {
            setReviews(rs => [r, ...rs])
            setShowFieldReport(false)
          }}
        />
      )}

      {showAdminPanel && profile?.is_admin && (
        <AdminPanel profile={profile} onClose={() => setShowAdminPanel(false)} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// AUTH SCREEN — Sign in only, no self-signup
// ═══════════════════════════════════════════════════════════════
function AuthScreen({ dark, setDark }) {
  const [username, setUser] = useState('')
  const [password, setPass] = useState('')
  const [error, setError]   = useState('')
  const [busy, setBusy]     = useState(false)

  async function handleSignIn(e) {
    e.preventDefault(); setError(''); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(username), password })
    if (error) setError('Invalid username or password. Contact your CAI administrator if you need access.')
    setBusy(false)
  }

  return (
    <div className="auth-screen" data-theme={dark ? 'dark' : ''}>
      <div className="auth-card">
        <div className="auth-logo">
          <span className="logo-sub">Friends of</span>
          <span className="logo-name">CAI Circle</span>
        </div>
        {error && <div className="error-msg">{error}</div>}
        <form onSubmit={handleSignIn}>
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={e => setUser(e.target.value)} placeholder="your_username" required autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPass(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={busy}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="auth-hint">
          CAI Circle is a private community tool.<br />
          Contact your CAI administrator to get access.
        </p>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => setDark(d => !d)}>
            {dark ? '☀ Light mode' : '☽ Dark mode'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════
function Header({ dark, setDark, view, setView, showBack, onBack, onAddVendor, onFieldReport, profile, onSignOut, onAdmin }) {
  return (
    <header className="header">
      <div className="header-left">
        {showBack && <button className="back-btn" onClick={onBack}>← Back</button>}
        <div className="logo">
          <span className="logo-sub">Friends of</span>
          <span className="logo-name">CAI Circle</span>
        </div>
      </div>

      {!showBack && (
        <div className="view-toggle">
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>List</button>
          <button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}>Map</button>
        </div>
      )}

      <div className="header-right">
        <button className="theme-btn" onClick={() => setDark(d => !d)}>{dark ? '☀' : '☽'}</button>
        {/* Primary action: File a Field Report */}
        <button className="btn btn-primary" onClick={onFieldReport}>Field Report</button>
        {/* Secondary action: Add Vendor */}
        <button className="btn btn-secondary" onClick={onAddVendor}>+ Add Vendor</button>
        {profile?.is_admin && (
          <button className="btn btn-secondary" onClick={onAdmin}>Admin</button>
        )}
        {profile && (
          <button className="btn btn-secondary" onClick={onSignOut}>
            {profile.username} · Sign Out
          </button>
        )}
      </div>
    </header>
  )
}

// ═══════════════════════════════════════════════════════════════
// LIST VIEW
// ═══════════════════════════════════════════════════════════════
function ListView({ vendors, loading, filterCat, setFilterCat, onSelect }) {
  return (
    <>
      <div className="filter-bar">
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <span className="result-count">{vendors.length} vendor{vendors.length !== 1 ? 's' : ''}</span>
      </div>
      {loading ? (
        <div className="empty-state"><span className="spinner" /></div>
      ) : vendors.length === 0 ? (
        <div className="empty-state">No vendors yet. Add the first one!</div>
      ) : (
        <div className="vendor-grid">
          {vendors.map(v => <VendorCard key={v.id} vendor={v} onClick={() => onSelect(v)} />)}
        </div>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// VENDOR CARD
// ═══════════════════════════════════════════════════════════════
function VendorCard({ vendor: v, onClick }) {
  const cat = getCat(v.category)
  return (
    <div className="vendor-card" onClick={onClick}>
      {v.flagged && <div className="flag-banner">⚑ Flagged — {v.flagged_reason}</div>}
      <div className="card-top">
        <div>
          <div className="vendor-name">{v.name}</div>
          <div className="vendor-cat" style={{ color: cat.color }}>{cat.label}</div>
          {v.region && <div className="vendor-region">{v.region}</div>}
        </div>
        <div className="score-block">
          <div className="score-empty">Tap to view<br />field reports</div>
        </div>
      </div>
      <div className="card-foot">
        <span className="addr-sm">{v.address}</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAP VIEW
// ═══════════════════════════════════════════════════════════════
function MapView({ vendors, onSelect, dark }) {
  const mapRef = useRef(null)
  const instanceRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current) return
    if (instanceRef.current) { instanceRef.current.remove(); instanceRef.current = null }

    const map = L.map(mapRef.current).setView([18.2208, -66.5901], 9)
    L.tileLayer(
      dark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { attribution: '© OpenStreetMap contributors' }
    ).addTo(map)

    vendors.forEach(v => {
      if (!v.lat || !v.lng) return
      const cat = getCat(v.category)
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${cat.color};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.3)"></div>`,
        iconSize: [28, 28], iconAnchor: [14, 28],
      })
      L.marker([v.lat, v.lng], { icon }).addTo(map)
        .bindPopup(`<div style="font-family:'Old Standard TT',Georgia,serif;min-width:140px">
          <strong>${v.name}</strong><br>
          <span style="color:${cat.color};font-size:11px;text-transform:uppercase">${cat.label}</span>
        </div>`)
        .on('click', () => onSelect(v))
    })

    instanceRef.current = map
    return () => { if (instanceRef.current) { instanceRef.current.remove(); instanceRef.current = null } }
  }, [vendors, dark])

  return (
    <div className="map-container">
      <div id="vendor-map" ref={mapRef} />
      <div className="map-sidebar">
        <div className="map-sidebar-head">Vendors ({vendors.length})</div>
        {vendors.map(v => {
          const cat = getCat(v.category)
          return (
            <div key={v.id} className="map-sidebar-item" onClick={() => onSelect(v)}>
              <div className="vendor-name" style={{ fontSize: 15 }}>{v.name}</div>
              <div className="vendor-cat" style={{ color: cat.color, fontSize: 10 }}>{cat.label}</div>
              {v.flagged && <div className="map-item-flag">⚑ Flagged</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DETAIL VIEW
// ═══════════════════════════════════════════════════════════════
function DetailView({ vendor: v, reviews, reviewsLoading, profile, onFieldReport, onDeleteVendor, onDeleteReview, onFlag, onUnflag, onCommentAdded }) {
  const [aiSummary, setAiSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const cat = getCat(v.category)
  const avg = avgRating(reviews)

  async function loadAISummary() {
    if (!reviews.length) return
    setAiLoading(true)
    const summaryText = reviews.map(r =>
      `Reviewer: ${r.profiles?.username}. Ratings: ${RATING_DIMS.map(d => `${d.label} ${r.ratings?.[d.id]}/5`).join(', ')}. Comment: "${r.comment}". Would recommend: ${r.recommend ? 'Yes' : 'No'}.`
    ).join('\n')
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ vendorName: v.name, reviews: summaryText })
      })
      const data = await res.json()
      setAiSummary(data.summary || 'Unable to generate summary.')
    } catch { setAiSummary('Unable to generate summary at this time.') }
    setAiLoading(false)
  }

  return (
    <div className="detail-container">
      <div className="detail-header">
        <div className="detail-cat" style={{ color: cat.color }}>{cat.label}</div>
        <div className="detail-name">{v.name}</div>
        {v.flagged && <div className="detail-flag">⚑ {v.flagged_reason || 'Flagged by a member'}</div>}
        <div className="detail-meta">
          {v.phone && <span>{v.phone}</span>}
          {v.website && <a href={`https://${v.website}`} target="_blank" rel="noreferrer">{v.website}</a>}
          {v.region && <span>{v.region}</span>}
        </div>
        {v.address && <div className="detail-addr">{v.address}</div>}
        {profile?.is_admin && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => v.flagged ? onUnflag(v) : onFlag(v)}>
              {v.flagged ? '✓ Remove Flag' : '⚑ Flag Vendor'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => onDeleteVendor(v.id)}>Delete Vendor</button>
          </div>
        )}
      </div>

      {avg !== null && (
        <div className="detail-section">
          <div className="section-title">Ratings by Dimension</div>
          <div className="dim-grid">
            {RATING_DIMS.map(d => {
              const da = dimAvg(reviews, d.id)
              return da !== null ? (
                <div key={d.id} className="dim-cell">
                  <div className="dim-cell-label">{d.label}</div>
                  <div className="dim-cell-val" style={{ color: scoreColor(da) }}>{da.toFixed(1)}</div>
                  <div className="dim-cell-stars" style={{ color: scoreColor(da) }}>{stars(da)}</div>
                </div>
              ) : null
            })}
          </div>
          <div className="overall-row">
            <div className="overall-num" style={{ color: scoreColor(avg) }}>{avg.toFixed(1)}</div>
            <div>
              <div className="overall-stars" style={{ color: scoreColor(avg) }}>{stars(avg)}</div>
              <div className="overall-label">
                Overall · {reviews.length} field report{reviews.length !== 1 ? 's' : ''} · {reviews.filter(r => r.recommend).length} would work with again
              </div>
            </div>
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="detail-section">
          <div className="section-title-row">
            <div className="section-title" style={{ marginBottom: 0 }}>AI Summary</div>
            {!aiSummary && !aiLoading && (
              <button className="btn btn-secondary btn-sm" onClick={loadAISummary}>Generate</button>
            )}
          </div>
          {aiLoading && <div className="ai-loading">Summarizing field reports…</div>}
          {aiSummary && <div className="ai-summary"><div className="ai-summary-label">AI · Summary</div>{aiSummary}</div>}
        </div>
      )}

      <div className="detail-section">
        <div className="section-title-row">
          <div className="section-title" style={{ marginBottom: 0 }}>Field Reports</div>
          <button className="btn btn-primary btn-sm" onClick={onFieldReport}>+ File a Report</button>
        </div>
        {reviewsLoading ? (
          <div className="flex-center mt-16"><span className="spinner" /></div>
        ) : reviews.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            No field reports yet. Be the first to share your experience.
          </div>
        ) : (
          reviews.map(r => (
            <ReportCard key={r.id} report={r} profile={profile}
              onDelete={() => onDeleteReview(r.id)}
              onCommentAdded={comment => onCommentAdded(r.id, comment)}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// REPORT CARD
// ═══════════════════════════════════════════════════════════════
function ReportCard({ report: r, profile, onDelete, onCommentAdded }) {
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText]   = useState('')
  const vals = Object.values(r.ratings || {})
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  const isOwner = profile?.id === r.user_id

  async function submitComment(e) {
    e.preventDefault()
    if (!commentText.trim()) return
    const { data } = await supabase.from('review_comments').insert({
      review_id: r.id, user_id: profile.id, comment: commentText.trim(),
    }).select('*, profiles(username)').single()
    if (data) { onCommentAdded(data); setCommentText('') }
  }

  return (
    <div className="report-card">
      <div className="report-top">
        <div className="avatar">{initials(r.profiles?.username || '?')}</div>
        <div>
          <div className="reporter-name">{r.profiles?.username || 'Anonymous'}</div>
          <div className="report-date">{r.created_at?.slice(0, 10)}{r.transaction_date ? ` · ${r.transaction_date}` : ''}</div>
        </div>
        <div className="report-avg" style={{ color: scoreColor(avg) }}>{avg.toFixed(1)} ★</div>
      </div>

      <div className="report-dims">
        {RATING_DIMS.map(d => r.ratings?.[d.id] ? (
          <div key={d.id} className="dim-pill" style={{ borderColor: scoreColor(r.ratings[d.id]), color: scoreColor(r.ratings[d.id]) }}>
            {d.label.split('/')[0].split('&')[0].trim()}: {r.ratings[d.id]}/5
          </div>
        ) : null)}
      </div>

      {r.comment && <p className="report-comment">"{r.comment}"</p>}

      <div className={`rec-tag ${r.recommend ? 'rec-yes' : 'rec-no'}`}>
        {r.recommend ? '✓ Would work with again' : '✗ Would not recommend'}
      </div>

      <div className="report-actions">
        <button className="btn btn-secondary btn-sm" onClick={() => setShowComments(s => !s)}>
          {showComments ? 'Hide' : 'Comments'}{r.review_comments?.length ? ` (${r.review_comments.length})` : ''}
        </button>
        {(isOwner || profile?.is_admin) && (
          <button className="btn btn-secondary btn-sm" style={{ color: 'var(--rd)' }} onClick={onDelete}>Delete</button>
        )}
      </div>

      {showComments && (
        <div className="comment-section">
          {(r.review_comments || []).map(c => (
            <div key={c.id} className="comment-item">
              <span className="comment-who">{c.profiles?.username}:</span>
              <span className="comment-text">{c.comment}</span>
            </div>
          ))}
          <form className="comment-form" onSubmit={submitComment}>
            <input value={commentText} onChange={e => setCommentText(e.target.value)} placeholder="Add a comment…" />
            <button type="submit" className="btn btn-secondary btn-sm">Post</button>
          </form>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ADD VENDOR MODAL — with Google Places search + pin drop map
// ═══════════════════════════════════════════════════════════════
function AddVendorModal({ profile, onClose, onSaved }) {
  const [searchQuery, setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching]       = useState(false)
  const [form, setForm] = useState({
    name: '', category: CATEGORIES[0].id, address: '',
    lat: null, lng: null, phone: '', website: '',
  })
  const [busy, setBusy]   = useState(false)
  const [error, setError] = useState('')
  const [pinMode, setPinMode] = useState(false)
  const mapRef   = useRef(null)
  const mapInst  = useRef(null)
  const markerRef = useRef(null)
  const searchTimer = useRef(null)

  // Google Places search
  async function doSearch(q) {
    if (!q || q.length < 3) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(q)}&key=${GOOGLE_KEY}`
      )
      const data = await res.json()
      setSearchResults(data.results?.slice(0, 6) || [])
    } catch { setSearchResults([]) }
    setSearching(false)
  }

  function onSearchChange(e) {
    const q = e.target.value
    setSearchQuery(q)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => doSearch(q), 500)
  }

  async function selectPlace(place) {
    setSearchResults([])
    setSearchQuery(place.name)
    const loc = place.geometry?.location
    setForm(f => ({
      ...f,
      name: place.name || '',
      address: place.formatted_address || '',
      lat: loc?.lat || null,
      lng: loc?.lng || null,
      phone: place.formatted_phone_number || '',
      website: (place.website || '').replace(/^https?:\/\//, '').replace(/\/$/, ''),
    }))
  }

  // Pin drop map
  useEffect(() => {
    if (!pinMode || !mapRef.current) return
    if (mapInst.current) return
    const m = L.map(mapRef.current).setView([18.2208, -66.5901], 9)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
      { attribution: '© OpenStreetMap' }).addTo(m)
    m.on('click', e => {
      if (markerRef.current) markerRef.current.remove()
      markerRef.current = L.marker([e.latlng.lat, e.latlng.lng]).addTo(m)
      setForm(f => ({ ...f, lat: e.latlng.lat, lng: e.latlng.lng }))
    })
    mapInst.current = m
    return () => { if (mapInst.current) { mapInst.current.remove(); mapInst.current = null } }
  }, [pinMode])

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setBusy(true)
    if (!form.name || !form.category) { setError('Name and category are required.'); setBusy(false); return }
    const { data, error: err } = await supabase.from('vendors').insert({
      ...form, created_by: profile.id,
    }).select().single()
    if (err) { setError(err.message); setBusy(false); return }
    onSaved(data)
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Add Vendor</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-msg">{error}</div>}

            {/* Google Places Search */}
            <div className="field">
              <label>Search Google (optional — auto-fills details)</label>
              <div className="places-search-wrap">
                <input value={searchQuery} onChange={onSearchChange} placeholder="Search by business name…" autoComplete="off" />
                {(searchResults.length > 0 || searching) && (
                  <div className="places-results">
                    {searching && <div className="places-searching">Searching…</div>}
                    {searchResults.map(p => (
                      <div key={p.place_id} className="places-item" onClick={() => selectPlace(p)}>
                        <div className="places-item-name">{p.name}</div>
                        <div className="places-item-addr">{p.formatted_address}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="field">
              <label>Vendor Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Company or individual name" required />
            </div>

            <div className="field">
              <label>Category *</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>

            <div className="field-row">
              <div className="field">
                <label>Phone (optional)</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 787-555-0000" />
              </div>
              <div className="field">
                <label>Website (optional)</label>
                <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="example.com" />
              </div>
            </div>

            <div className="field">
              <label>Address</label>
              <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Auto-filled from Google, or type manually" />
            </div>

            {/* Map location */}
            <div className="field">
              <label>Map Location</label>
              {form.lat && form.lng
                ? <div className="success-msg">📍 Location set: {form.lat.toFixed(4)}, {form.lng.toFixed(4)}</div>
                : <div className="pin-hint">Drop a pin on the map to set the location</div>
              }
              <button type="button" className="btn btn-secondary btn-sm" style={{ marginBottom: 8 }}
                onClick={() => setPinMode(p => !p)}>
                {pinMode ? 'Hide Map' : '📍 Drop a Pin'}
              </button>
              {pinMode && (
                <div className="pin-map-wrap">
                  <div id="pin-map" ref={mapRef} />
                </div>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add Vendor'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// FIELD REPORT MODAL
// ═══════════════════════════════════════════════════════════════
function FieldReportModal({ vendors, profile, preselectedVendor, onClose, onSaved }) {
  const [selectedVendor, setSelectedVendor] = useState(preselectedVendor)
  const [step, setStep]         = useState(preselectedVendor ? 2 : 1)
  const [ratings, setRatings]   = useState(() => Object.fromEntries(RATING_DIMS.map(d => [d.id, 0])))
  const [comment, setComment]   = useState('')
  const [recommend, setRecommend] = useState(true)
  const [txDate, setTxDate]     = useState('')
  const [busy, setBusy]         = useState(false)
  const [error, setError]       = useState('')
  const [search, setSearch]     = useState('')

  const filteredVendors = vendors.filter(v =>
    !search || v.name.toLowerCase().includes(search.toLowerCase())
  )

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setBusy(true)
    const unrated = RATING_DIMS.filter(d => !ratings[d.id])
    if (unrated.length) { setError('Please rate all dimensions.'); setBusy(false); return }
    const { data, error: err } = await supabase.from('reviews').insert({
      vendor_id: selectedVendor.id, user_id: profile.id,
      ratings, comment: comment.trim() || null,
      recommend, transaction_date: txDate || null,
    }).select('*, profiles(username, avatar_url), review_comments(*)').single()
    if (err) { setError(err.message); setBusy(false); return }
    onSaved(data)
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">
            {step === 1 ? 'Field Report — Select Vendor' : `Field Report: ${selectedVendor?.name}`}
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {step === 1 ? (
          <div className="modal-body">
            <div className="field">
              <label>Search vendors</label>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Type to filter…" autoFocus />
            </div>
            <div className="vendor-select-list">
              {filteredVendors.map(v => {
                const cat = getCat(v.category)
                return (
                  <div key={v.id} className="vendor-select-item" onClick={() => { setSelectedVendor(v); setStep(2) }}>
                    <div>
                      <div className="vendor-select-name">{v.name}</div>
                      <div className="vendor-select-cat" style={{ color: cat.color }}>{cat.label}</div>
                    </div>
                    <span style={{ color: 'var(--mut)', fontSize: 18 }}>→</span>
                  </div>
                )
              })}
              {filteredVendors.length === 0 && <div className="empty-state" style={{ padding: 20 }}>No vendors found.</div>}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {error && <div className="error-msg">{error}</div>}
              {!preselectedVendor && (
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginBottom: 16 }}
                  onClick={() => setStep(1)}>← Change Vendor</button>
              )}

              <div className="field">
                <label>Rate Each Dimension</label>
                {RATING_DIMS.map(d => (
                  <div key={d.id} className="dim-rating-row">
                    <div>
                      <div className="dim-rating-label">{d.label}</div>
                      <div className="dim-rating-hint">{d.hint}</div>
                    </div>
                    <div className="star-input">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} type="button" onClick={() => setRatings(r => ({ ...r, [d.id]: n }))}>
                          {n <= ratings[d.id] ? '★' : '☆'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="field">
                <label>Comments</label>
                <textarea value={comment} onChange={e => setComment(e.target.value)}
                  placeholder="Share specifics — what went well, what didn't, anything the group should know…" />
              </div>

              <div className="field">
                <label>Transaction Date (optional)</label>
                <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} />
              </div>

              <div className="field">
                <label>Would you work with this vendor again?</label>
                <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                    <input type="radio" checked={recommend} onChange={() => setRecommend(true)} /> Yes
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                    <input type="radio" checked={!recommend} onChange={() => setRecommend(false)} /> No
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit Field Report'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ADMIN PANEL — Create accounts for new members
// ═══════════════════════════════════════════════════════════════
function AdminPanel({ profile, onClose }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy]         = useState(false)
  const [msg, setMsg]           = useState('')
  const [error, setError]       = useState('')
  const [users, setUsers]       = useState([])

  useEffect(() => {
    supabase.from('profiles').select('*').order('username')
      .then(({ data }) => setUsers(data || []))
  }, [])

  async function createAccount(e) {
    e.preventDefault(); setMsg(''); setError(''); setBusy(true)
    if (username.length < 3) { setError('Username must be at least 3 characters.'); setBusy(false); return }
    const { error: err } = await supabase.auth.signUp({
      email: toEmail(username), password,
      options: { data: { username } }
    })
    if (err) { setError(err.message); setBusy(false); return }
    setMsg(`Account created for "${username}". Share the username and password with them.`)
    setUsername(''); setPassword('')
    supabase.from('profiles').select('*').order('username').then(({ data }) => setUsers(data || []))
    setBusy(false)
  }

  async function toggleAdmin(user) {
    await supabase.from('profiles').update({ is_admin: !user.is_admin }).eq('id', user.id)
    setUsers(us => us.map(u => u.id === user.id ? { ...u, is_admin: !u.is_admin } : u))
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Admin Panel</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="section-title" style={{ marginBottom: 14 }}>Create New Member Account</div>
          {error && <div className="error-msg">{error}</div>}
          {msg && <div className="success-msg">{msg}</div>}
          <form onSubmit={createAccount}>
            <div className="field-row">
              <div className="field">
                <label>Username</label>
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="new_member" required />
              </div>
              <div className="field">
                <label>Temporary Password</label>
                <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Share with them" required />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Creating…' : 'Create Account'}</button>
          </form>

          <div className="section-title" style={{ marginTop: 24, marginBottom: 12 }}>Members ({users.length})</div>
          {users.map(u => (
            <div key={u.id} className="admin-user-row">
              <span>{u.username} {u.is_admin ? '(admin)' : ''}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => toggleAdmin(u)}>
                {u.is_admin ? 'Remove Admin' : 'Make Admin'}
              </button>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
