import { useState, useEffect, useRef } from 'react'
import { supabase } from './config/supabase'
import { CATEGORIES, RATING_DIMS } from './config/categories'
import L from 'leaflet'

// Fix Leaflet's default marker icon path issue with bundlers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ─── Helpers ────────────────────────────────────────────────────
function avgRating(reviews) {
  if (!reviews.length) return null
  const total = reviews.reduce((sum, r) => {
    const vals = Object.values(r.ratings)
    return sum + vals.reduce((a, b) => a + b, 0) / vals.length
  }, 0)
  return total / reviews.length
}

function dimAvg(reviews, dimId) {
  if (!reviews.length) return null
  const vals = reviews.map(r => r.ratings[dimId]).filter(Boolean)
  if (!vals.length) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function scoreColor(n) {
  if (n === null) return 'var(--mut)'
  if (n >= 4)   return 'var(--sg)'
  if (n >= 2.5) return 'var(--am)'
  return 'var(--rd)'
}

function scoreClass(n) {
  if (n === null) return ''
  if (n >= 4)   return 'score-good'
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

// Auth uses email internally: username@caicircle.app
function toEmail(username) { return `${username.toLowerCase().replace(/\s+/g, '_')}@caicircle.app` }


// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [dark, setDark]           = useState(() => localStorage.getItem('cai-theme') === 'dark')
  const [session, setSession]     = useState(null)
  const [profile, setProfile]     = useState(null)
  const [vendors, setVendors]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState('list')  // 'list' | 'map' | 'detail'
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [filterCat, setFilterCat] = useState('all')
  const [filterReg, setFilterReg] = useState('all')
  const [showAddVendor, setShowAddVendor]   = useState(false)
  const [showAddReview, setShowAddReview]   = useState(false)
  const [reviews, setReviews]     = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(false)

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : '')
    localStorage.setItem('cai-theme', dark ? 'dark' : 'light')
  }, [dark])

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // Load profile when session changes
  useEffect(() => {
    if (!session) { setProfile(null); setLoading(false); return }
    supabase.from('profiles').select('*').eq('id', session.user.id).single()
      .then(({ data }) => setProfile(data))
  }, [session])

  // Load vendors
  useEffect(() => {
    if (!session) return
    setLoading(true)
    supabase.from('vendors').select('*').order('name')
      .then(({ data }) => { setVendors(data || []); setLoading(false) })
  }, [session])

  // Load reviews when a vendor is selected
  useEffect(() => {
    if (!selectedVendor) return
    setReviewsLoading(true)
    supabase.from('reviews').select('*, profiles(username, avatar_url), review_comments(*, profiles(username))')
      .eq('vendor_id', selectedVendor.id).order('created_at', { ascending: false })
      .then(({ data }) => { setReviews(data || []); setReviewsLoading(false) })
  }, [selectedVendor])

  function selectVendor(v) {
    setSelectedVendor(v)
    setView('detail')
    window.scrollTo(0, 0)
  }

  function goBack() {
    setSelectedVendor(null)
    setView('list')
  }

  async function deleteVendor(id) {
    if (!confirm('Delete this vendor and all their reviews? This cannot be undone.')) return
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
    if (!confirm('Delete this review?')) return
    await supabase.from('reviews').delete().eq('id', id)
    setReviews(r => r.filter(x => x.id !== id))
  }

  const filteredVendors = vendors.filter(v => {
    if (filterCat !== 'all' && v.category !== filterCat) return false
    if (filterReg !== 'all' && v.region !== filterReg) return false
    return true
  })

  const regions = [...new Set(vendors.map(v => v.region).filter(Boolean))]

  if (!session) return <AuthScreen dark={dark} setDark={setDark} />

  return (
    <div className="app">
      <Header
        dark={dark} setDark={setDark}
        view={view} setView={(v) => { setView(v); setSelectedVendor(null) }}
        showBack={!!selectedVendor} onBack={goBack}
        onAddVendor={() => setShowAddVendor(true)}
        profile={profile}
        onSignOut={() => supabase.auth.signOut()}
      />

      {view === 'detail' && selectedVendor ? (
        <DetailView
          vendor={selectedVendor}
          reviews={reviews}
          reviewsLoading={reviewsLoading}
          profile={profile}
          onAddReview={() => setShowAddReview(true)}
          onDeleteVendor={deleteVendor}
          onDeleteReview={deleteReview}
          onFlag={flagVendor}
          onUnflag={unflagVendor}
          onReviewCommentAdded={(reviewId, comment) =>
            setReviews(rs => rs.map(r => r.id === reviewId
              ? { ...r, review_comments: [...(r.review_comments||[]), comment] }
              : r
            ))
          }
          setReviews={setReviews}
        />
      ) : view === 'map' ? (
        <MapView vendors={filteredVendors} onSelect={selectVendor} dark={dark} />
      ) : (
        <ListView
          vendors={filteredVendors}
          loading={loading}
          filterCat={filterCat} setFilterCat={setFilterCat}
          filterReg={filterReg} setFilterReg={setFilterReg}
          regions={regions}
          onSelect={selectVendor}
        />
      )}

      {showAddVendor && (
        <AddVendorModal
          profile={profile}
          onClose={() => setShowAddVendor(false)}
          onSaved={(v) => { setVendors(vs => [...vs, v].sort((a,b) => a.name.localeCompare(b.name))); setShowAddVendor(false) }}
        />
      )}

      {showAddReview && selectedVendor && (
        <AddReviewModal
          vendor={selectedVendor}
          profile={profile}
          onClose={() => setShowAddReview(false)}
          onSaved={(r) => { setReviews(rs => [r, ...rs]); setShowAddReview(false) }}
        />
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// AUTH SCREEN
// ═══════════════════════════════════════════════════════════════
function AuthScreen({ dark, setDark }) {
  const [tab, setTab]       = useState('signin')
  const [username, setUser] = useState('')
  const [password, setPass] = useState('')
  const [error, setError]   = useState('')
  const [busy, setBusy]     = useState(false)

  async function handleSignIn(e) {
    e.preventDefault(); setError(''); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: toEmail(username), password })
    if (error) setError('Invalid username or password.')
    setBusy(false)
  }

  async function handleSignUp(e) {
    e.preventDefault(); setError(''); setBusy(true)
    if (username.length < 3) { setError('Username must be at least 3 characters.'); setBusy(false); return }
    const { error } = await supabase.auth.signUp({
      email: toEmail(username), password,
      options: { data: { username } }
    })
    if (error) setError(error.message)
    else setError('Account created! You can now sign in.')
    setBusy(false)
  }

  return (
    <div className="auth-screen" data-theme={dark ? 'dark' : ''}>
      <div className="auth-card">
        <div className="auth-logo">
          <span className="logo-sub">Friends of</span>
          <span className="logo-name">CAI Circle</span>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${tab==='signin'?'active':''}`} onClick={() => setTab('signin')}>Sign In</button>
          <button className={`auth-tab ${tab==='signup'?'active':''}`} onClick={() => setTab('signup')}>Create Account</button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <form onSubmit={tab === 'signin' ? handleSignIn : handleSignUp}>
          <div className="field">
            <label>Username</label>
            <input value={username} onChange={e => setUser(e.target.value)} placeholder="your_username" required autoFocus />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPass(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn btn-primary" style={{width:'100%',marginTop:4}} disabled={busy}>
            {busy ? 'Please wait…' : tab === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="auth-hint">
          CAI Circle is a private community tool.<br />
          Contact your CAI administrator if you need access.
        </p>

        <div style={{textAlign:'center', marginTop:16}}>
          <button className="btn btn-ghost btn-sm" onClick={() => setDark(d => !d)}>
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
function Header({ dark, setDark, view, setView, showBack, onBack, onAddVendor, profile, onSignOut }) {
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
          <button className={view==='list'?'active':''} onClick={() => setView('list')}>List</button>
          <button className={view==='map'?'active':''} onClick={() => setView('map')}>Map</button>
        </div>
      )}

      <div className="header-right">
        <button className="theme-btn" onClick={() => setDark(d => !d)} title="Toggle theme">
          {dark ? '☀' : '☽'}
        </button>
        <button className="btn btn-primary" onClick={onAddVendor}>+ Add Vendor</button>
        {profile && (
          <button className="btn btn-ghost btn-sm" onClick={onSignOut} title={`Signed in as ${profile.username}`}>
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
function ListView({ vendors, loading, filterCat, setFilterCat, filterReg, setFilterReg, regions, onSelect }) {
  return (
    <>
      <div className="filter-bar">
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select value={filterReg} onChange={e => setFilterReg(e.target.value)}>
          <option value="all">All Regions</option>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="result-count">{vendors.length} vendor{vendors.length !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="empty-state"><span className="spinner" /></div>
      ) : vendors.length === 0 ? (
        <div className="empty-state">No vendors match this filter.</div>
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
  // Cards don't have reviews loaded; we'll show a placeholder
  // Reviews are loaded when the detail view opens
  const cat = getCat(v.category)
  return (
    <div className={`vendor-card`} onClick={onClick}>
      {v.flagged && <div className="flag-banner">⚑ Flagged by member — {v.flagged_reason}</div>}
      <div className="card-top">
        <div>
          <div className="vendor-name">{v.name}</div>
          <div className="vendor-cat" style={{color: cat.color}}>{cat.label}</div>
          <div className="vendor-region">{v.region}</div>
        </div>
        <div className="score-block">
          <div className="score-empty">Tap to view<br/>reviews</div>
        </div>
      </div>
      <div className="card-foot">
        <span className="addr-sm">{v.address}</span>
        {v.contact_name && <span className="contact-sm">{v.contact_name}</span>}
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
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { attribution: '© OpenStreetMap contributors' }
    ).addTo(map)

    vendors.forEach(v => {
      if (!v.lat || !v.lng) return
      const cat = getCat(v.category)
      const color = cat.color

      const icon = L.divIcon({
        className: '',
        html: `<div style="width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35)"></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      })

      L.marker([v.lat, v.lng], { icon }).addTo(map)
        .bindPopup(`
          <div style="font-family:'Old Standard TT',Georgia,serif;min-width:160px;font-size:13px;line-height:1.5">
            <strong>${v.name}</strong><br>
            <span style="color:${color};font-size:11px;text-transform:uppercase;letter-spacing:.5px">${cat.label}</span><br>
            <span style="color:#888;font-size:11px">${v.address || ''}</span>
          </div>
        `)
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
              <div className="vendor-name">{v.name}</div>
              <div className="vendor-cat" style={{color: cat.color}}>{cat.label}</div>
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
function DetailView({ vendor: v, reviews, reviewsLoading, profile, onAddReview, onDeleteVendor, onDeleteReview, onFlag, onUnflag, onReviewCommentAdded, setReviews }) {
  const [aiSummary, setAiSummary]     = useState('')
  const [aiLoading, setAiLoading]     = useState(false)
  const cat = getCat(v.category)
  const avg = avgRating(reviews)

  async function loadAISummary() {
    if (!reviews.length) return
    setAiLoading(true)
    const summaryText = reviews.map(r =>
      `Reviewer: ${r.profiles?.username}. Ratings: ${RATING_DIMS.map(d => `${d.label} ${r.ratings[d.id]}/5`).join(', ')}. Comment: "${r.comment}". Would recommend: ${r.recommend ? 'Yes' : 'No'}.`
    ).join('\n')

    try {
      // This calls the Supabase Edge Function — see supabase/functions/ai-summary/index.ts
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ vendorName: v.name, reviews: summaryText })
      })
      const data = await res.json()
      setAiSummary(data.summary || 'Unable to generate summary.')
    } catch {
      setAiSummary('Unable to generate summary at this time.')
    }
    setAiLoading(false)
  }

  return (
    <div className="detail-container">
      <div className="detail-header">
        <div className="detail-cat" style={{color: cat.color}}>{cat.label}</div>
        <div className="detail-name">{v.name}</div>
        {v.flagged && <div className="detail-flag">⚑ {v.flagged_reason || 'Flagged by a member'}</div>}
        <div className="detail-meta">
          {v.contact_name && <span>Contact: {v.contact_name}</span>}
          {v.phone && <span>{v.phone}</span>}
          {v.website && <a href={`https://${v.website}`} target="_blank" rel="noreferrer">{v.website}</a>}
          {v.region && <span>{v.region}</span>}
          {v.years_active && <span>{v.years_active} yrs in business</span>}
          {v.payment_terms && <span>Terms: {v.payment_terms}</span>}
          {v.certifications && <span>{v.certifications}</span>}
        </div>
        {v.address && <div className="detail-addr">{v.address}</div>}
        {profile?.is_admin && (
          <div style={{display:'flex', gap:8, marginTop:12}}>
            <button className="btn btn-ghost btn-sm" onClick={() => v.flagged ? onUnflag(v) : onFlag(v)}>
              {v.flagged ? '✓ Remove Flag' : '⚑ Flag Vendor'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => onDeleteVendor(v.id)}>Delete Vendor</button>
          </div>
        )}
      </div>

      {/* Ratings Summary */}
      {avg !== null && (
        <div className="detail-section">
          <div className="section-title">Ratings by Dimension</div>
          <div className="dim-grid">
            {RATING_DIMS.map(d => {
              const da = dimAvg(reviews, d.id)
              if (da === null) return null
              return (
                <div key={d.id} className="dim-cell">
                  <div className="dim-cell-label">{d.label}</div>
                  <div className="dim-cell-val" style={{color: scoreColor(da)}}>{da.toFixed(1)}</div>
                  <div className="dim-cell-stars" style={{color: scoreColor(da)}}>{stars(da)}</div>
                </div>
              )
            })}
          </div>
          <div className="overall-row">
            <div className="overall-num" style={{color: scoreColor(avg)}}>{avg.toFixed(1)}</div>
            <div>
              <div className="overall-stars" style={{color: scoreColor(avg)}}>{stars(avg)}</div>
              <div className="overall-label">
                Overall · {reviews.length} review{reviews.length !== 1 ? 's' : ''} · {reviews.filter(r => r.recommend).length} would work with again
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Summary */}
      {reviews.length > 0 && (
        <div className="detail-section">
          <div className="section-title-row">
            <div className="section-title" style={{marginBottom:0}}>AI Summary</div>
            {!aiSummary && !aiLoading && (
              <button className="btn btn-ghost btn-sm" onClick={loadAISummary}>Generate</button>
            )}
          </div>
          {aiLoading && <div className="ai-loading">Summarizing reviews…</div>}
          {aiSummary && (
            <div className="ai-summary">
              <div className="ai-summary-label">AI · Review Summary</div>
              {aiSummary}
            </div>
          )}
        </div>
      )}

      {/* Reviews */}
      <div className="detail-section">
        <div className="section-title-row">
          <div className="section-title" style={{marginBottom:0}}>Reviews</div>
          <button className="btn btn-primary btn-sm" onClick={onAddReview}>+ Write a Review</button>
        </div>

        {reviewsLoading ? (
          <div className="flex-center mt-16"><span className="spinner" /></div>
        ) : reviews.length === 0 ? (
          <div className="empty-state" style={{padding:'24px 0'}}>
            No reviews yet. Be the first to share your experience.
          </div>
        ) : (
          reviews.map(r => (
            <ReviewCard
              key={r.id}
              review={r}
              profile={profile}
              onDelete={() => onDeleteReview(r.id)}
              onCommentAdded={(comment) => onReviewCommentAdded(r.id, comment)}
            />
          ))
        )}
      </div>

      {/* Internal Notes (admin only) */}
      {profile?.is_admin && v.notes && (
        <div className="detail-section">
          <div className="section-title">Internal Notes (Admin Only)</div>
          <div style={{fontSize:13, color:'var(--tx)', lineHeight:1.6}}>{v.notes}</div>
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// REVIEW CARD
// ═══════════════════════════════════════════════════════════════
function ReviewCard({ review: r, profile, onDelete, onCommentAdded }) {
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText]   = useState('')
  const avg = Object.values(r.ratings).reduce((a, b) => a + b, 0) / Object.values(r.ratings).length
  const isOwner = profile?.id === r.user_id

  async function submitComment(e) {
    e.preventDefault()
    if (!commentText.trim()) return
    const { data } = await supabase.from('review_comments').insert({
      review_id: r.id,
      user_id: profile.id,
      comment: commentText.trim(),
    }).select('*, profiles(username)').single()
    if (data) { onCommentAdded(data); setCommentText('') }
  }

  return (
    <div className="review-card">
      <div className="review-top">
        <div className="avatar">{initials(r.profiles?.username || '?')}</div>
        <div>
          <div className="reviewer-name">{r.profiles?.username || 'Anonymous'}</div>
          <div className="review-date">{r.created_at?.slice(0,10)}{r.transaction_date ? ` · Transaction: ${r.transaction_date}` : ''}</div>
        </div>
        <div className="review-avg" style={{color: scoreColor(avg)}}>{avg.toFixed(1)} ★</div>
      </div>

      <div className="review-dims">
        {RATING_DIMS.map(d => r.ratings[d.id] ? (
          <div key={d.id} className="dim-pill" style={{borderColor: scoreColor(r.ratings[d.id]), color: scoreColor(r.ratings[d.id])}}>
            {d.label.split('/')[0].split('&')[0].trim()}: {r.ratings[d.id]}/5
          </div>
        ) : null)}
      </div>

      {r.comment && <p className="review-comment">"{r.comment}"</p>}

      <div className={`rec-tag ${r.recommend ? 'rec-yes' : 'rec-no'}`}>
        {r.recommend ? '✓ Would work with again' : '✗ Would not recommend'}
      </div>

      <div className="review-actions">
        <button className="btn btn-ghost btn-sm" onClick={() => setShowComments(s => !s)}>
          {showComments ? 'Hide' : 'Comments'} {r.review_comments?.length ? `(${r.review_comments.length})` : ''}
        </button>
        {(isOwner || profile?.is_admin) && (
          <button className="btn btn-ghost btn-sm" style={{color:'var(--rd)'}} onClick={onDelete}>Delete</button>
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
            <input
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Add a comment…"
            />
            <button type="submit" className="btn btn-ghost btn-sm">Post</button>
          </form>
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// ADD VENDOR MODAL
// ═══════════════════════════════════════════════════════════════
function AddVendorModal({ profile, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '', category: CATEGORIES[0].id, address: '', lat: '', lng: '',
    phone: '', website: '', contact_name: '', years_active: '', region: 'Puerto Rico',
    payment_terms: '', certifications: '', notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setBusy(true)
    if (!form.name || !form.category) { setError('Name and category are required.'); setBusy(false); return }
    const payload = {
      ...form,
      lat: form.lat ? parseFloat(form.lat) : null,
      lng: form.lng ? parseFloat(form.lng) : null,
      years_active: form.years_active ? parseInt(form.years_active) : null,
      created_by: profile.id,
    }
    const { data, error: err } = await supabase.from('vendors').insert(payload).select().single()
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

            <div className="field">
              <label>Vendor Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Company or individual name" required />
            </div>

            <div className="field-row">
              <div className="field">
                <label>Category *</label>
                <select value={form.category} onChange={e => set('category', e.target.value)}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Region</label>
                <input value={form.region} onChange={e => set('region', e.target.value)} placeholder="Puerto Rico" />
              </div>
            </div>

            <div className="field">
              <label>Address</label>
              <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street, City, State" />
            </div>

            <div className="field-row">
              <div className="field">
                <label>Latitude (for map)</label>
                <input value={form.lat} onChange={e => set('lat', e.target.value)} placeholder="18.4655" type="number" step="any" />
              </div>
              <div className="field">
                <label>Longitude (for map)</label>
                <input value={form.lng} onChange={e => set('lng', e.target.value)} placeholder="-66.1057" type="number" step="any" />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label>Phone</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 787-555-0000" />
              </div>
              <div className="field">
                <label>Website</label>
                <input value={form.website} onChange={e => set('website', e.target.value)} placeholder="example.com" />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label>Primary Contact Name</label>
                <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="Who you deal with" />
              </div>
              <div className="field">
                <label>Years in Business</label>
                <input value={form.years_active} onChange={e => set('years_active', e.target.value)} type="number" placeholder="10" />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <label>Payment Terms</label>
                <input value={form.payment_terms} onChange={e => set('payment_terms', e.target.value)} placeholder="Net 30, COD…" />
              </div>
              <div className="field">
                <label>Certifications / Licenses</label>
                <input value={form.certifications} onChange={e => set('certifications', e.target.value)} placeholder="Bonded, Organic…" />
              </div>
            </div>

            <div className="field">
              <label>Internal Notes (not shown publicly)</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Anything the group should know before engaging this vendor…" />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Add Vendor'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════════════
// ADD REVIEW MODAL
// ═══════════════════════════════════════════════════════════════
function AddReviewModal({ vendor, profile, onClose, onSaved }) {
  const initRatings = () => Object.fromEntries(RATING_DIMS.map(d => [d.id, 0]))
  const [ratings, setRatings]       = useState(initRatings)
  const [comment, setComment]       = useState('')
  const [recommend, setRecommend]   = useState(true)
  const [txDate, setTxDate]         = useState('')
  const [txSize, setTxSize]         = useState('')
  const [busy, setBusy]             = useState(false)
  const [error, setError]           = useState('')

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setBusy(true)
    const unrated = RATING_DIMS.filter(d => !ratings[d.id])
    if (unrated.length) { setError(`Please rate all dimensions.`); setBusy(false); return }

    const { data, error: err } = await supabase.from('reviews').insert({
      vendor_id: vendor.id,
      user_id: profile.id,
      ratings,
      comment: comment.trim() || null,
      recommend,
      transaction_date: txDate || null,
      transaction_size: txSize || null,
    }).select('*, profiles(username, avatar_url), review_comments(*)').single()

    if (err) { setError(err.message); setBusy(false); return }
    onSaved(data)
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">Review: {vendor.name}</div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="error-msg">{error}</div>}

            <div className="field">
              <label>Rate Each Dimension</label>
              {RATING_DIMS.map(d => (
                <div key={d.id} className="dim-rating-row">
                  <div>
                    <div className="dim-rating-label">{d.label}</div>
                    <div className="dim-rating-hint">{d.hint}</div>
                  </div>
                  <div className="star-input">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} type="button" onClick={() => setRatings(r => ({...r, [d.id]: n}))}>
                        {n <= ratings[d.id] ? '★' : '☆'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="field">
              <label>Comments</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Share specifics — what went well, what didn't, anything the group should know…" />
            </div>

            <div className="field-row">
              <div className="field">
                <label>Transaction Date</label>
                <input type="date" value={txDate} onChange={e => setTxDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Transaction Size</label>
                <select value={txSize} onChange={e => setTxSize(e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label>Would you work with this vendor again?</label>
              <div style={{display:'flex', gap:12, marginTop:4}}>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:14,cursor:'pointer'}}>
                  <input type="radio" checked={recommend} onChange={() => setRecommend(true)} /> Yes
                </label>
                <label style={{display:'flex',alignItems:'center',gap:6,fontSize:14,cursor:'pointer'}}>
                  <input type="radio" checked={!recommend} onChange={() => setRecommend(false)} /> No
                </label>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit Review'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
