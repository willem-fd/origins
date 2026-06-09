import { useState, useEffect } from 'react'
import { supabase } from './supabase'

// Display labels for actions in the thread
const ACTION_LABEL = {
  ask:     'Ask',
  confirm: 'Confirmed',
  cancel:  'Cancelled',
  counter: 'Counter offer',
}
const ACTION_ICON = {
  ask:     'send',
  confirm: 'check',
  cancel:  'x',
  counter: 'arrows-exchange',
}
const ACTION_COLOR = {
  ask:     'var(--text-2)',
  confirm: '#15803d',
  cancel:  '#b91c1c',
  counter: 'var(--brown-dark)',
}

const STATE_LABEL = { pending: 'Pending', active: 'Confirmed', cancelled: 'Cancelled' }
const STATE_BADGE = { pending: 'badge-pending', active: 'badge-active', cancelled: 'badge-completed' }

// Format a price-or-similar value from fields_json
const fmtPrice = (v) => v == null ? '—' : `$${Number(v).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtInt   = (v) => v == null ? '—' : Number(v).toLocaleString('de-DE')
const fmtDate  = (s) => new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// LineDrawer — slides in from the right; shows current values + the
// immutable thread of asks / counters / confirms / cancels for one line.
// Read-only in Chunk 1. Action buttons live on the row itself for now;
// they'll move into the drawer in Chunk 2 when we add Counter.
export default function LineDrawer({ poId, onClose }) {
  const [line, setLine] = useState(null)
  const [actions, setActions] = useState([])
  const [companyMap, setCompanyMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!poId) return
    let alive = true
    setLoading(true); setErr('')

    ;(async () => {
      try {
        // 1. The line itself (with product info)
        const { data: l, error: lErr } = await supabase
          .from('purchase_orders')
          .select('id, state, price_ordered, stems_ordered, stems_per_bunch, length_cm, notes_buyer, order_type, box_type, box_nr, boxmark, grower_company_id, products(name, vbn_code)')
          .eq('id', poId).single()
        if (lErr) throw lErr

        // 2. All actions for the line (newest first)
        const { data: a, error: aErr } = await supabase
          .from('po_actions')
          .select('id, action, actor_company_id, fields_json, created_at')
          .eq('po_id', poId)
          .order('created_at', { ascending: false })
        if (aErr) throw aErr

        // 3. Resolve company names for the actors (companies are readable
        //    across an established relationship; user names aren't visible
        //    cross-company so we show company only).
        const companyIds = [...new Set((a || []).map(x => x.actor_company_id).filter(Boolean))]
        if (l.grower_company_id) companyIds.push(l.grower_company_id)
        const uniq = [...new Set(companyIds)]
        const { data: cs } = uniq.length
          ? await supabase.from('companies').select('id, name, brand_name, type').in('id', uniq)
          : { data: [] }

        if (!alive) return
        setLine(l)
        setActions(a || [])
        setCompanyMap(Object.fromEntries((cs || []).map(c => [c.id, c])))
        setLoading(false)
      } catch (e) {
        if (!alive) return
        setErr(e.message || 'Failed to load line history')
        setLoading(false)
      }
    })()

    return () => { alive = false }
  }, [poId])

  if (!poId) return null

  const closeOnBackdrop = (e) => { if (e.target === e.currentTarget) onClose() }
  const companyName = (id) => {
    const c = companyMap[id]
    if (!c) return '—'
    return c.brand_name || c.name
  }

  return (
    <div className="drawer-backdrop" onClick={closeOnBackdrop}>
      <div className="drawer" role="dialog" aria-label="Line history">
        <div className="drawer-header">
          <div className="drawer-title">Line history</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {err && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', fontSize: 13, margin: 16, borderRadius: 7 }}>{err}</div>}

        {loading ? (
          <div className="empty"><i className="ti ti-loader" /><div className="empty-title">Loading…</div></div>
        ) : line ? (
          <>
            {/* Current values */}
            <div className="drawer-section">
              <div className="drawer-section-title">Current</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                {line.products?.name || '—'}
                {line.products?.vbn_code && <span style={{ marginLeft: 6, color: 'var(--text-3)', fontSize: 12 }}>{line.products.vbn_code}</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12, fontFamily: 'var(--mono)' }}>
                Box {line.box_nr ?? '—'} · {line.box_type || '—'} · MARK {line.boxmark || '—'}
                <span style={{ marginLeft: 10 }}>· grower {companyName(line.grower_company_id)}</span>
              </div>
              <div className="kv-grid">
                <KV label="Length"   value={line.length_cm == null ? '—' : `${line.length_cm} cm`} />
                <KV label="Stems"    value={fmtInt(line.stems_ordered)} />
                <KV label="St/Bunch" value={fmtInt(line.stems_per_bunch)} />
                <KV label="Price"    value={fmtPrice(line.price_ordered)} />
                <KV label="Order type" value={({ open_market: 'Open Market', standing: 'Standing', repeating: 'Repeating' })[line.order_type] || '—'} />
                <KV label="State">
                  <span className={`badge ${STATE_BADGE[line.state] || 'badge-draft'}`} style={{ minWidth: 78, textAlign: 'center', justifyContent: 'center', display: 'inline-flex' }}>
                    {STATE_LABEL[line.state] || line.state}
                  </span>
                </KV>
              </div>
              {line.notes_buyer && (
                <div style={{ marginTop: 10, padding: 10, background: 'var(--surface-2)', borderRadius: 6, fontSize: 12.5 }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--text-3)', marginBottom: 4 }}>Buyer note</div>
                  {line.notes_buyer}
                </div>
              )}
            </div>

            {/* Thread */}
            <div className="drawer-section">
              <div className="drawer-section-title">Thread <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>· newest first</span></div>
              {actions.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>No actions recorded yet.</div>
              ) : (
                <div className="thread">
                  {actions.map(a => (
                    <ThreadItem key={a.id} action={a} who={companyName(a.actor_company_id)} />
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}

function KV({ label, value, children }) {
  return (
    <div className="kv">
      <div className="kv-label">{label}</div>
      <div className="kv-value">{children ?? value}</div>
    </div>
  )
}

function ThreadItem({ action, who }) {
  const f = action.fields_json || {}
  const hasPrice = f.price_ordered != null
  const hasStems = f.stems_ordered != null
  const hasStB   = f.stems_per_bunch != null
  return (
    <div className="thread-item">
      <div className="thread-item-icon" style={{ color: ACTION_COLOR[action.action] || 'var(--text-2)' }}>
        <i className={`ti ti-${ACTION_ICON[action.action] || 'circle'}`} aria-hidden="true" />
      </div>
      <div className="thread-item-body">
        <div className="thread-item-head">
          <span style={{ fontWeight: 600, color: ACTION_COLOR[action.action] }}>{ACTION_LABEL[action.action] || action.action}</span>
          <span style={{ color: 'var(--text-3)', fontSize: 11.5 }}>{who}</span>
        </div>
        <div className="thread-item-time">{fmtDate(action.created_at)}</div>
        {(hasPrice || hasStems || hasStB) && (
          <div className="thread-item-fields">
            {hasPrice && <span>Price <strong>{fmtPrice(f.price_ordered)}</strong></span>}
            {hasStems && <span>Stems <strong>{fmtInt(f.stems_ordered)}</strong></span>}
            {hasStB   && <span>St/B <strong>{fmtInt(f.stems_per_bunch)}</strong></span>}
          </div>
        )}
      </div>
    </div>
  )
}
