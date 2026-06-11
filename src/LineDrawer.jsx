import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import { confirmDialog, promptDialog } from './Dialog'

// Display labels for actions in the thread
const ACTION_LABEL = {
  ask:     'Ask',
  confirm: 'Confirmed',
  cancel:  'Cancelled',
  counter: 'Counter offer',
  reopen:  'Reopened',
}
const ACTION_ICON = {
  ask:     'send',
  confirm: 'check',
  cancel:  'x',
  counter: 'arrows-exchange',
  reopen:  'rotate-clockwise',
}
const ACTION_COLOR = {
  ask:     'var(--text-2)',
  confirm: '#1A6640',
  cancel:  '#8B1818',
  counter: 'var(--brown-dark)',
  reopen:  'var(--brown-dark)',
}
const FRIENDLY_ERR = {
  price_required:      'Cannot confirm — the buyer left the price open. Counter with a price first.',
  line_not_pending:    'This line is no longer pending.',
  shipment_not_active: 'Shipment is not in an active state.',
  not_authorized:      'You are not authorised to do that.',
  line_cancelled:      'This line is cancelled.',
  already_confirmed:   'This line is already confirmed.',
  already_cancelled:   'This line is already cancelled.',
  not_reopenable:      'This line cannot be reopened.',
  stems_not_multiple:  'Stems must be a multiple of stems-per-bunch.',
  invalid_order_type:  'Invalid order type.',
}

const STATE_LABEL = { pending: 'Pending', active: 'Confirmed', cancelled: 'Cancelled' }
const STATE_BADGE = { pending: 'badge-pending', active: 'badge-active', cancelled: 'badge-cancelled' }
const OT_LABEL    = { open_market: 'Open Market', standing: 'Standing', repeating: 'Repeating' }

const CLOSE_MS = 220   // must match @keyframes drawer-out duration in styles.js

const fmtPrice = (v) => v == null ? '—' : `$${Number(v).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtInt   = (v) => v == null ? '—' : Number(v).toLocaleString('de-DE')
const fmtDate  = (s) => new Date(s).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function LineDrawer({ poId, initialCounterMode, onClose, onActionTaken }) {
  const [line, setLine] = useState(null)
  const [shipment, setShipment] = useState(null)
  const [actions, setActions] = useState([])
  const [companyMap, setCompanyMap] = useState({})
  const [productMap, setProductMap] = useState({})   // id → {name, vbn_code}
  const [growerProducts, setGrowerProducts] = useState([])  // sub-catalogue for this grower (fallback to all)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [closing, setClosing] = useState(false)
  const [otHelp, setOtHelp] = useState(false)

  // Counter form now covers Type, Variety, Length, Stems, St/B, Price
  const [counterMode, setCounterMode] = useState(false)
  const [counterForm, setCounterForm] = useState({
    order_type: '', product_id: '', length: '', stems: '', stpb: '', price: '',
  })
  const [submitting, setSubmitting] = useState(false)

  // Refs to handle close-out animation cleanly
  const closeTimerRef = useRef(null)
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current) }, [])

  const requestClose = useCallback(() => {
    if (closing) return
    setClosing(true)
    closeTimerRef.current = setTimeout(() => { onClose?.() }, CLOSE_MS)
  }, [closing, onClose])

  // Esc closes
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') requestClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestClose])

  const reload = useCallback(async () => {
    if (!poId) return
    try {
      const [lRes, aRes, pRes] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select('id, state, price_ordered, stems_ordered, stems_per_bunch, length_cm, notes_buyer, order_type, box_type, box_nr, boxmark, grower_company_id, shipment_id, product_id, products(name, vbn_code), shipments(buyer_company_id)')
          .eq('id', poId).single(),
        supabase
          .from('po_actions')
          .select('id, action, actor_company_id, fields_json, created_at')
          .eq('po_id', poId)
          .order('created_at', { ascending: false }),
        (async () => {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return { data: null }
          return supabase.from('users').select('id, company_id, role, is_super_admin').eq('id', user.id).single()
        })()
      ])
      if (lRes.error) throw lRes.error
      if (aRes.error) throw aRes.error

      const l = lRes.data
      const a = aRes.data || []
      const p = pRes.data
      const buyerId = l.shipments?.buyer_company_id

      const companyIds = [...new Set(a.map(x => x.actor_company_id).filter(Boolean))]
      if (l.grower_company_id) companyIds.push(l.grower_company_id)
      if (buyerId) companyIds.push(buyerId)
      const uniq = [...new Set(companyIds)]
      const { data: cs } = uniq.length
        ? await supabase.from('companies').select('id, name, brand_name, type').in('id', uniq)
        : { data: [] }

      // Collect every product_id we've ever referenced (current row + historic actions)
      const productIds = [...new Set(
        [l.product_id, ...a.map(x => x.fields_json?.product_id).filter(Boolean)].filter(Boolean)
      )]
      const { data: ps } = productIds.length
        ? await supabase.from('products').select('id, name, vbn_code').in('id', productIds)
        : { data: [] }
      const productMapLocal = Object.fromEntries((ps || []).map(p2 => [p2.id, p2]))
      if (l.products && l.product_id) productMapLocal[l.product_id] = l.products

      // Load grower's product sub-catalogue (fallback to full master catalogue)
      let growerCat = []
      if (l.grower_company_id) {
        const { data: gp } = await supabase
          .from('grower_products')
          .select('product_id')
          .eq('company_id', l.grower_company_id)
        if (gp && gp.length > 0) {
          const ids = gp.map(x => x.product_id)
          const { data: prods } = await supabase
            .from('products').select('id, name, vbn_code').in('id', ids).order('name')
          growerCat = prods || []
        } else {
          const { data: prods } = await supabase
            .from('products').select('id, name, vbn_code').order('name').limit(1000)
          growerCat = prods || []
        }
        // Merge into productMap so dropdown options always resolve
        for (const p2 of growerCat) productMapLocal[p2.id] = p2
      }

      setLine(l)
      setShipment({ buyer_company_id: buyerId })
      setActions(a)
      setProfile(p)
      setCompanyMap(Object.fromEntries((cs || []).map(c => [c.id, c])))
      setProductMap(productMapLocal)
      setGrowerProducts(growerCat)

      if (initialCounterMode && l.state === 'pending') {
        seedCounterFormFromLine(l)
        setCounterMode(true)
      }

      setLoading(false)
    } catch (e) {
      setErr(e.message || 'Failed to load line history')
      setLoading(false)
    }
  }, [poId, initialCounterMode])

  const seedCounterFormFromLine = (l) => {
    setCounterForm({
      order_type: l.order_type || '',
      product_id: l.product_id || '',
      length:     l.length_cm != null ? String(l.length_cm) : '',
      stems:      l.stems_ordered != null ? String(l.stems_ordered) : '',
      stpb:       l.stems_per_bunch != null ? String(l.stems_per_bunch) : '',
      price:      l.price_ordered != null ? String(l.price_ordered).replace('.', ',') : '',
    })
    setErr('')
  }

  useEffect(() => {
    if (!poId) return
    setLoading(true); setErr(''); setClosing(false)
    setCounterMode(false)
    reload()
  }, [poId, reload])

  if (!poId) return null

  const isAdmin       = profile && (profile.is_super_admin || profile.role === 'admin')
  const myCompany     = profile?.company_id
  const buyerId       = shipment?.buyer_company_id
  const growerId      = line?.grower_company_id
  const iAmGrower     = myCompany && myCompany === growerId
  const iAmBuyer      = myCompany && myCompany === buyerId
  const iAmInvolved   = iAmGrower || iAmBuyer
  const lastAction    = actions[0]
  const lastByMe      = lastAction && myCompany && lastAction.actor_company_id === myCompany
  const replyRequired = line?.state === 'pending' && lastAction && !lastByMe

  // Action visibility — counter is now both sides (was grower-only)
  const canConfirm = isAdmin && iAmInvolved && line?.state === 'pending' && replyRequired && line?.price_ordered != null
  const canCounter = isAdmin && iAmInvolved && line?.state === 'pending'
  const canCancel  = isAdmin && iAmInvolved && (line?.state === 'pending' || line?.state === 'active')
  const canReopen  = isAdmin && iAmInvolved && (line?.state === 'active' || line?.state === 'cancelled')

  const companyName = (id) => {
    const c = companyMap[id]
    if (!c) return '—'
    return c.brand_name || c.name
  }
  const productLabel = (id) => {
    if (!id) return '—'
    const p = productMap[id]
    if (!p) return '—'
    return `${p.name}${p.vbn_code ? ` (${p.vbn_code})` : ''}`
  }

  const beginCounter = () => {
    seedCounterFormFromLine(line)
    setCounterMode(true)
  }

  const submitCounter = async () => {
    setErr('')
    // Price required
    const priceStr = (counterForm.price || '').replace(',', '.')
    const priceNum = priceStr === '' ? null : Number(priceStr)
    if (priceNum === null || isNaN(priceNum) || priceNum <= 0) {
      setErr('Set a price greater than 0')
      return
    }
    const stemsNum = counterForm.stems ? parseInt(counterForm.stems, 10) : null
    const stpbNum  = counterForm.stpb  ? parseInt(counterForm.stpb,  10) : null
    const lenNum   = counterForm.length ? parseInt(counterForm.length, 10) : null
    if (stemsNum != null && (isNaN(stemsNum) || stemsNum <= 0)) { setErr('Stems must be a positive number'); return }
    if (stpbNum  != null && (isNaN(stpbNum)  || stpbNum  <= 0)) { setErr('Stems per bunch must be a positive number'); return }
    if (lenNum   != null && (isNaN(lenNum)   || lenNum   <= 0)) { setErr('Length must be a positive number'); return }
    if (stemsNum != null && stpbNum != null && stemsNum % stpbNum !== 0) {
      setErr(`Stems (${stemsNum}) must be a whole multiple of stems-per-bunch (${stpbNum}).`)
      return
    }
    if (!counterForm.order_type) { setErr('Pick an order type'); return }
    if (!counterForm.product_id) { setErr('Pick a variety'); return }

    setSubmitting(true)
    const { data, error } = await supabase.rpc('po_counter', {
      p_po_id: poId,
      p_fields: {
        price_ordered:   priceNum,
        stems_ordered:   stemsNum,
        stems_per_bunch: stpbNum,
        length_cm:       lenNum,
        order_type:      counterForm.order_type,
        product_id:      counterForm.product_id,
      }
    })
    setSubmitting(false)
    if (error || !data?.ok) {
      const code = data?.error || error?.message || 'Failed to submit counter'
      setErr(FRIENDLY_ERR[code] || code)
      return
    }
    onActionTaken?.()
    requestClose()
  }

  // Generic RPC runner used for confirm / reopen
  const runRpc = async (fnName) => {
    setErr('')
    setSubmitting(true)
    const { data, error } = await supabase.rpc(fnName, { p_po_id: poId })
    setSubmitting(false)
    if (error || !data?.ok) {
      const code = data?.error || error?.message || 'Action failed'
      setErr(FRIENDLY_ERR[code] || code)
      return
    }
    onActionTaken?.()
    requestClose()
  }

  // Cancel — grower gets the reason prompt; buyer is one-click with confirm
  const handleCancel = async () => {
    let reason = ''
    if (iAmGrower) {
      const res = await promptDialog({
        title: 'Reason for cancellation?',
        body: 'Optional — the buyer will see this note in the line history. Leave blank if you just want to cancel.',
        placeholder: 'e.g. out of stock until next week',
        submitLabel: 'Cancel with reason',
        dismissLabel: 'No reason, just cancel',
      })
      if (res === null) return        // user closed the dialog
      reason = (res || '').trim()
    } else {
      const ok = await confirmDialog({
        title: 'Cancel this line?',
        body: 'The other side will see it as Cancelled in the line history.',
        confirmLabel: 'Cancel line',
        dismissLabel: 'Back',
        tone: 'danger',
      })
      if (!ok) return
    }
    setErr('')
    setSubmitting(true)
    const { data, error } = await supabase.rpc('po_cancel', { p_po_id: poId, p_reason: reason || null })
    setSubmitting(false)
    if (error || !data?.ok) {
      const code = data?.error || error?.message || 'Action failed'
      setErr(FRIENDLY_ERR[code] || code)
      return
    }
    onActionTaken?.()
    requestClose()
  }

  const handleReopen = async () => {
    const ok = await confirmDialog({
      title: 'Reopen this line for negotiation?',
      body: 'It moves back to Pending and the other side sees a new ask.',
      confirmLabel: 'Reopen',
    })
    if (!ok) return
    runRpc('po_reopen')
  }

  // Storyline text
  let storyMsg = null, storyColor = 'var(--text-2)', storyBg = 'var(--surface-2)'
  if (line) {
    if (line.state === 'active') {
      storyMsg = 'Line confirmed. Both sides agree.'
      storyColor = '#1A6640'; storyBg = '#EAF2EE'
    } else if (line.state === 'cancelled') {
      storyMsg = 'Line cancelled.'
      storyColor = '#8B1818'; storyBg = '#FDEBEB'
    } else if (lastAction && lastByMe) {
      const otherCompanyId = iAmGrower ? buyerId : growerId
      storyMsg = `Awaiting a reply from ${companyName(otherCompanyId)}.`
    } else if (lastAction && !lastByMe) {
      storyMsg = 'Reply required: please confirm, counter or cancel.'
      storyColor = '#B45309'; storyBg = '#FEF3E2'
    }
  }

  return (
    <>
      <div className={`drawer-backdrop${closing ? ' closing' : ''}`} onClick={requestClose} />
      <div className={`drawer${closing ? ' closing' : ''}`} role="dialog" aria-label="Line history">
        <div className="drawer-header">
          <div className="drawer-title">Line history</div>
          <button className="btn btn-ghost btn-sm" onClick={requestClose} aria-label="Close">
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        </div>

        {err && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '10px 14px', fontSize: 13, margin: 16, borderRadius: 7 }}>{err}</div>}

        {loading ? (
          <div className="empty"><i className="ti ti-loader" /><div className="empty-title">Loading…</div></div>
        ) : line ? (
          <>
            <div className="drawer-section">
              <div className="drawer-section-title">Current</div>
              {storyMsg && (
                <div style={{ background: storyBg, color: storyColor, padding: '8px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 500, marginBottom: 12 }}>
                  {storyMsg}
                </div>
              )}
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
                <KV
                  labelExtra={
                    <span className="ot-help-wrap">
                      <button className="ot-help-btn" onClick={() => setOtHelp(o => !o)} aria-label="Order type help" type="button">
                        <i className="ti ti-help" aria-hidden="true" />
                      </button>
                      {otHelp && (
                        <div className="ot-help-popover" onClick={e => e.stopPropagation()}>
                          <p><strong>OM (Open Market):</strong> a one-time order from the grower's live stock.</p>
                          <p><strong>RO (Repeating Order):</strong> an order that repeats weekly until the buyer wishes to stop.</p>
                          <p><strong>SO (Standing Order):</strong> a fixed order contract between the grower and the buyer for a set period of time.</p>
                          <p style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-3)' }}>All RO's and SO's must be contracted separately.</p>
                        </div>
                      )}
                    </span>
                  }
                  label="Order type"
                  value={OT_LABEL[line.order_type] || '—'}
                />
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

            {/* Actions */}
            {(canConfirm || canCounter || canCancel || canReopen) && (
              <div className="drawer-section" style={{ background: 'var(--surface-2)' }}>
                {counterMode ? (
                  <>
                    <div className="drawer-section-title">Your counter offer</div>
                    <div className="counter-form">
                      <label className="col-type">
                        <span>Type</span>
                        <select value={counterForm.order_type}
                          onChange={e => setCounterForm({ ...counterForm, order_type: e.target.value })}>
                          <option value="">—</option>
                          <option value="open_market">OM</option>
                          <option value="repeating">RO</option>
                          <option value="standing">SO</option>
                        </select>
                      </label>
                      <label className="col-variety">
                        <span>Variety</span>
                        <select value={counterForm.product_id}
                          onChange={e => setCounterForm({ ...counterForm, product_id: e.target.value })}>
                          <option value="">— pick a variety —</option>
                          {growerProducts.map(p => (
                            <option key={p.id} value={p.id}>{p.name}{p.vbn_code ? ` (${p.vbn_code})` : ''}</option>
                          ))}
                        </select>
                      </label>
                      <label className="col-length">
                        <span>Length cm</span>
                        <input type="number" placeholder="60"
                          value={counterForm.length}
                          onChange={e => setCounterForm({ ...counterForm, length: e.target.value })} />
                      </label>
                      <label className="col-stems">
                        <span>Stems</span>
                        <input type="number" placeholder="100"
                          value={counterForm.stems}
                          onChange={e => setCounterForm({ ...counterForm, stems: e.target.value })} />
                      </label>
                      <label className="col-stpb">
                        <span>St/Bunch</span>
                        <input type="number" placeholder="25"
                          value={counterForm.stpb}
                          onChange={e => setCounterForm({ ...counterForm, stpb: e.target.value })} />
                      </label>
                      <label className="col-price">
                        <span>Price $</span>
                        <input type="text" inputMode="decimal" placeholder="0,00"
                          value={counterForm.price}
                          onChange={e => setCounterForm({ ...counterForm, price: e.target.value.replace('.', ',') })}
                          onBlur={e => {
                            const v = e.target.value
                            if (!v) return
                            const cleaned = v.trim().replace(',', '.')
                            const n = Number(cleaned)
                            if (Number.isFinite(n)) setCounterForm(f => ({ ...f, price: n.toFixed(2).replace('.', ',') }))
                          }} />
                      </label>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => { setCounterMode(false); setErr('') }} disabled={submitting}>
                        Back
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={submitCounter} disabled={submitting}>
                        <i className="ti ti-send" aria-hidden="true" /> {submitting ? 'Sending…' : 'Send counter'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="drawer-section-title">Actions</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {canConfirm && (
                        <button className="btn btn-primary btn-sm" onClick={() => runRpc('po_confirm')} disabled={submitting}>
                          <i className="ti ti-check" aria-hidden="true" /> Confirm
                        </button>
                      )}
                      {canCounter && (
                        <button className="btn btn-ghost btn-sm" onClick={beginCounter} disabled={submitting}>
                          <i className="ti ti-arrows-exchange" aria-hidden="true" /> Counter
                        </button>
                      )}
                      {canCancel && (
                        <button className="btn btn-ghost btn-sm" onClick={handleCancel} disabled={submitting}>
                          <i className="ti ti-x" aria-hidden="true" /> Cancel
                        </button>
                      )}
                      {canReopen && (
                        <button className="btn btn-ghost btn-sm" onClick={handleReopen} disabled={submitting}>
                          <i className="ti ti-rotate-clockwise" aria-hidden="true" /> Reopen
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="drawer-section">
              <div className="drawer-section-title">Thread <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>· newest first</span></div>
              {actions.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--text-3)' }}>No actions recorded yet.</div>
              ) : (
                <div className="thread">
                  {actions.map((a, idx) => {
                    // For counter actions, compare against the prior non-reopen action
                    let prior = null
                    if (a.action === 'counter') {
                      for (let j = idx + 1; j < actions.length; j++) {
                        if (actions[j].action !== 'reopen') { prior = actions[j]; break }
                      }
                    }
                    return (
                      <ThreadItem key={a.id} action={a} who={companyName(a.actor_company_id)} prior={prior} productLabel={productLabel} />
                    )
                  })}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </>
  )
}

function KV({ label, value, children, labelExtra }) {
  return (
    <div className="kv">
      <div className="kv-label" style={{ display: 'inline-flex', alignItems: 'center' }}>
        {label}
        {labelExtra}
      </div>
      <div className="kv-value">{children ?? value}</div>
    </div>
  )
}

function ThreadItem({ action, who, prior, productLabel }) {
  const f = action.fields_json || {}
  const isCounter = action.action === 'counter'
  const isCancel  = action.action === 'cancel'
  const isReopen  = action.action === 'reopen'
  const showValues = !isCancel && !isReopen

  const priorF = prior?.fields_json || {}
  const changed = (key) => isCounter && priorF[key] != null && f[key] != null && String(f[key]) !== String(priorF[key])

  // Reason for cancellation, if present
  const reason = f.reason

  return (
    <div className="thread-item">
      <div className="thread-item-icon" style={{ color: ACTION_COLOR[action.action] || 'var(--text-2)' }}>
        <i className={`ti ti-${ACTION_ICON[action.action] || 'circle'}`} aria-hidden="true" />
      </div>
      <div className="thread-item-body">
        <div className="thread-item-head">
          <span style={{ fontWeight: 600, color: ACTION_COLOR[action.action] }}>{ACTION_LABEL[action.action] || action.action}</span>
          <span style={{ color: 'var(--text-3)', fontSize: 11.5 }}>· {who}</span>
        </div>
        {showValues && (
          <div className="thread-item-fields">
            <span>Type <strong className={changed('order_type') ? 'changed' : ''}>{f.order_type ? ({ open_market: 'OM', repeating: 'RO', standing: 'SO' })[f.order_type] || f.order_type : '—'}</strong></span>
            <span>· Variety <strong className={changed('product_id') ? 'changed' : ''}>{productLabel(f.product_id) || '—'}</strong></span>
            <span>· Len <strong className={changed('length_cm') ? 'changed' : ''}>{f.length_cm != null ? `${f.length_cm} cm` : '—'}</strong></span>
            <span>· Stems <strong className={changed('stems_ordered') ? 'changed' : ''}>{f.stems_ordered != null ? fmtInt(f.stems_ordered) : '—'}</strong></span>
            <span>· St/B <strong className={changed('stems_per_bunch') ? 'changed' : ''}>{f.stems_per_bunch != null ? fmtInt(f.stems_per_bunch) : '—'}</strong></span>
            <span>· Price <strong className={changed('price_ordered') ? 'changed' : ''}>{f.price_ordered != null ? fmtPrice(f.price_ordered) : '—'}</strong></span>
          </div>
        )}
        {isCancel && reason && (
          <div className="thread-item-reason">
            <div className="thread-item-reason-label">Reason</div>
            {reason}
          </div>
        )}
        <div className="thread-item-time">{fmtDate(action.created_at)}</div>
      </div>
    </div>
  )
}
