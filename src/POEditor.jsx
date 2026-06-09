import { useState, useRef, useCallback, useEffect } from 'react'
import {
  DndContext, DragOverlay, closestCenter,
  PointerSensor, useSensor, useSensors,
  useDroppable
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove
} from '@dnd-kit/sortable'
import { CSS as DndCSS } from '@dnd-kit/utilities'
import { supabase } from './supabase'
import { SaveTemplateModal, LoadTemplateModal, templateItemsToPOPayloads } from './Templates'
import LineDrawer from './LineDrawer'

const STATUSES = [
  { key: 'pending',      label: 'Pending',     cls: 'status-pending' },
  { key: 'confirmed',    label: 'Confirmed',   cls: 'status-confirmed' },
  { key: 'partial',      label: 'Partial',     cls: 'status-partial' },
  { key: 'counter_offer',label: 'Counter',     cls: 'status-counter' },
  { key: 'rejected',     label: 'Rejected',    cls: 'status-rejected' },
]
const STATUS_CLS = Object.fromEntries(STATUSES.map(s => [s.key, s.cls]))

const ORDER_TYPES = [
  { key: 'standing',    label: 'SO', cls: 'ot-so' },
  { key: 'repeating',   label: 'RO', cls: 'ot-ro' },
  { key: 'open_market', label: 'OM', cls: 'ot-om' },
]
const OT_MAP = Object.fromEntries(ORDER_TYPES.map(o => [o.key, o]))

const BOX_TYPES = ['FB','HB','QB','EB']

// ── European number formatting ────────────────────────────────────────────────
// Display "1.234,56" (thousand: ".", decimal: ","). Accepts user input with
// either "." or "," as decimal separator and returns a Number.
export function parseEur(s) {
  if (s == null || s === '') return null
  // Strip thousand separators (any "."), then convert "," → "."
  const cleaned = String(s).replace(/\./g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}
export function formatEur(n, decimals = 2, prefix = '') {
  if (n == null || !Number.isFinite(Number(n))) return prefix ? `${prefix}—` : '—'
  return prefix + Number(n).toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
// For integers like stems counts: "1.234"
export function formatInt(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—'
  return Number(n).toLocaleString('de-DE', { maximumFractionDigits: 0 })
}

// ── Product Combobox ──────────────────────────────────────────────────────────
function ProductCombobox({ value, products, onChange, inputRef }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)
  const containerRef = useRef(null)
  const listRef = useRef(null)

  const selected = products.find(p => p.id === value)
  const displayText = selected ? `${selected.name}${selected.vbn_code ? ` (${selected.vbn_code})` : ''}` : ''

  const filtered = query.length < 1 ? [] : products.filter(p => {
    const q = query.toLowerCase()
    return (p.name || '').toLowerCase().includes(q) || (p.vbn_code || '').includes(q)
  }).slice(0, 40)

  // Close on outside click
  useEffect(() => {
    const handler = e => { if (containerRef.current && !containerRef.current.contains(e.target)) { setOpen(false); setQuery('') } }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectProduct = (p) => {
    onChange(p.id)
    setOpen(false)
    setQuery('')
  }

  const handleKeyDown = e => {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(h + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHighlighted(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter' && filtered[highlighted]) { e.preventDefault(); selectProduct(filtered[highlighted]) }
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        className="cell-input"
        style={{ fontSize: 12.5, cursor: 'text' }}
        placeholder="— type to search variety —"
        value={open ? query : displayText}
        onFocus={() => { setOpen(true); setQuery(''); setHighlighted(0) }}
        onChange={e => { setQuery(e.target.value); setHighlighted(0) }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
      />
      {open && query.length >= 1 && (
        <div ref={listRef} style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--border-md)',
          borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 999, maxHeight: 240, overflowY: 'auto'
        }}>
          {filtered.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text-3)' }}>No matches for "{query}"</div>
          )}
          {filtered.map((p, i) => (
            <div key={p.id}
              onMouseDown={() => selectProduct(p)}
              style={{
                padding: '8px 12px', fontSize: 12.5, cursor: 'pointer',
                background: i === highlighted ? 'var(--green-light)' : 'transparent',
                color: 'var(--text-1)', borderBottom: '0.5px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between'
              }}
              onMouseEnter={() => setHighlighted(i)}
            >
              <span>{p.name}</span>
              {p.vbn_code && <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{p.vbn_code}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function newRow(growerId, boxNr, sortOrder) {
  return {
    _id: `new_${Date.now()}_${Math.random()}`,
    isNew: true,
    grower_id: growerId,
    box_nr: boxNr,
    boxmark: '',
    box_type: 'HB',
    product_id: null,
    order_type: 'open_market',
    status: 'pending',
    length_cm: '',
    stems_ordered: '',
    stems_per_bunch: 25,
    price_ordered: '',
    notes_buyer: '',
    sort_order: sortOrder,
  }
}

function newBox(growerId, boxNr) {
  return {
    boxNr,
    boxmark: '',
    box_type: 'HB',
    rows: [newRow(growerId, boxNr, 0)],
  }
}

function newGrowerBlock(grower) {
  return {
    growerId: grower.id,
    growerName: grower.name,
    growerCode: grower.code,
    collapsed: false,
    boxes: [newBox(grower.id, 1)],
  }
}

// ── Status dot with popover ──────────────────────────────────────────────────
function StatusDot({ status, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  useEffect(() => {
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  return (
    <div ref={ref} style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '0 10px' }}>
      <div className={`status-dot ${STATUS_CLS[status] || 'status-pending'}`} onClick={() => setOpen(o => !o)} title={status} />
      {open && (
        <div className="status-popover">
          {STATUSES.map(s => (
            <div key={s.key} className="status-option" onClick={() => { onChange(s.key); setOpen(false) }}>
              <div className={`status-option-dot ${s.cls}`} />
              {s.label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sortable product row ─────────────────────────────────────────────────────
const STATE_PILL = {
  pending:   { label: 'Pending',   cls: 'badge-pending' },
  active:    { label: 'Confirmed', cls: 'badge-active' },
  cancelled: { label: 'Cancelled', cls: 'badge-completed' },
}
function ProductRow({ row, rowIndex, products, showState, locked, onOpenHistory, onUpdate, onDelete, onKeyDown, inputRef }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging
  } = useSortable({ id: row._id, data: { type: 'row', growerId: row.grower_id, boxNr: row.box_nr }, disabled: locked })

  const style = { transform: DndCSS.Transform.toString(transform), transition }
  const product = products.find(p => p.id === row.product_id)
  const ot = OT_MAP[row.order_type] || OT_MAP.open_market

  const set = (k, v) => onUpdate({ ...row, [k]: v })

  return (
    <div ref={setNodeRef} style={style} className={`product-row${isDragging ? ' is-dragging' : ''}`}>
      {locked
        ? <span className="row-drag" style={{ opacity: 0.25, cursor: 'default' }}><i className="ti ti-grip-vertical" aria-hidden="true" /></span>
        : <span className="row-drag" {...attributes} {...listeners}><i className="ti ti-grip-vertical" aria-hidden="true" /></span>}
      <span className="row-num">{rowIndex + 1}</span>

      {/* Order type */}
      <div className="cell" style={{ width: 42 }}>
        <select className="cell-select" style={{ fontSize: 11, fontWeight: 700, color: 'inherit' }}
          value={row.order_type} onChange={e => set('order_type', e.target.value)} disabled={locked}>
          {ORDER_TYPES.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </div>

      {/* Product */}
      <div className="cell" style={{ flex: 3, minWidth: 180 }}>
        {locked ? (
          <span style={{ padding: '0 10px', fontSize: 12.5 }}>
            {product ? `${product.name}${product.vbn_code ? ` (${product.vbn_code})` : ''}` : <span style={{ color: 'var(--text-3)' }}>—</span>}
          </span>
        ) : (
          <ProductCombobox
            value={row.product_id}
            products={products}
            onChange={v => set('product_id', v)}
            inputRef={inputRef}
          />
        )}
      </div>

      {/* Length */}
      <div className="cell" style={{ width: 72 }}>
        <input className="cell-input mono" type="number" placeholder="cm" value={row.length_cm}
          onChange={e => set('length_cm', e.target.value)}
          onKeyDown={e => onKeyDown(e, row._id, 'length_cm')} readOnly={locked} />
      </div>

      {/* Stems */}
      <div className="cell" style={{ width: 80 }}>
        <input className="cell-input mono" type="number" placeholder="—" value={row.stems_ordered}
          onChange={e => set('stems_ordered', e.target.value)}
          onKeyDown={e => onKeyDown(e, row._id, 'stems_ordered')} readOnly={locked} />
      </div>

      {/* St/Bunch */}
      <div className="cell" style={{ width: 70 }}>
        <input className="cell-input mono" type="number" placeholder="25" value={row.stems_per_bunch}
          onChange={e => set('stems_per_bunch', e.target.value)}
          onKeyDown={e => onKeyDown(e, row._id, 'stems_per_bunch')} readOnly={locked} />
      </div>

      {/* Price */}
      <div className="cell" style={{ width: 82 }}>
        <input className="cell-input mono" type="text" inputMode="decimal" placeholder="0,00" value={row.price_ordered}
          onChange={e => set('price_ordered', e.target.value.replace('.', ','))}
          onKeyDown={e => onKeyDown(e, row._id, 'price_ordered')} readOnly={locked} />
      </div>

      {/* Total */}
      <div className="cell" style={{ width: 88, background: 'var(--surface-2)' }}>
        <span style={{ padding: '0 10px', fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--brown-dark)', fontWeight: 500 }}>
          {row.stems_ordered && row.price_ordered
            ? formatEur(Number(row.stems_ordered) * Number(String(row.price_ordered).replace(',', '.')), 2, '$')
            : '—'}
        </span>
      </div>

      {/* Notes */}
      <div className="cell" style={{ flex: 1, minWidth: 80 }}>
        <input className="cell-input" placeholder="notes" value={row.notes_buyer}
          onChange={e => set('notes_buyer', e.target.value)}
          onKeyDown={e => onKeyDown(e, row._id, 'notes_buyer')} readOnly={locked} />
      </div>

      {/* State (W3 lifecycle: pending / confirmed / cancelled) + history icon */}
      <div className="cell" style={{ width: 110, justifyContent: 'center', gap: 6 }}>
        {showState && row.state ? (
          <span className={`badge ${STATE_PILL[row.state]?.cls || 'badge-draft'}`} style={{ minWidth: 78, textAlign: 'center', justifyContent: 'center', display: 'inline-flex' }}>
            {STATE_PILL[row.state]?.label || row.state}
          </span>
        ) : (
          <span style={{ color: 'var(--text-3)', fontSize: 11 }}>—</span>
        )}
        {!row.isNew && onOpenHistory && (
          <button
            className="history-btn"
            onClick={() => onOpenHistory(row._id)}
            title="Open line history"
            aria-label="Open line history"
          >
            <i className="ti ti-history" aria-hidden="true" />
          </button>
        )}
      </div>

      {locked
        ? <span style={{ width: 30 }} />
        : <button className="row-delete" onClick={() => onDelete(row._id)} title="Remove">
            <i className="ti ti-x" aria-hidden="true" />
          </button>}
    </div>
  )
}

// ── Droppable grower block ─────────────────────────────────────────────────────
function GrowerBlock({ block, blockIndex, growers, products, showState, locked, onOpenHistory, onUpdate, onDelete, onAddGrower }) {
  const [growerProducts, setGrowerProducts] = useState(null) // null = loading, [] = none set

  // Load this grower's product catalogue
  useEffect(() => {
    if (!block.growerId || block.growerId === 'open') { setGrowerProducts(null); return }
    const load = async () => {
      const { data } = await supabase
        .from('grower_products')
        .select('product_id')
        .eq('company_id', block.growerId)
      if (data && data.length > 0) {
        const ids = new Set(data.map(gp => gp.product_id))
        setGrowerProducts(products.filter(p => ids.has(p.id)))
      } else {
        setGrowerProducts([]) // grower has no catalogue set up
      }
    }
    load()
  }, [block.growerId])

  // Use grower's catalogue if it has products, otherwise fall back to full catalogue
  const availableProducts = growerProducts && growerProducts.length > 0 ? growerProducts : products
  const { setNodeRef, isOver } = useDroppable({ id: `grower_${block.growerId}`, data: { type: 'grower', growerId: block.growerId } })
  const inputRefs = useRef({})

  const totalStems = block.boxes.reduce((a, b) => a + b.rows.reduce((c, r) => c + (Number(r.stems_ordered) || 0), 0), 0)
  const totalCost = block.boxes.reduce((a, b) => a + b.rows.reduce((c, r) => c + ((Number(r.stems_ordered) || 0) * (parseEur(r.price_ordered) || 0)), 0), 0)
  const confirmedRows = block.boxes.reduce((a, b) => a + b.rows.filter(r => r.status === 'confirmed').length, 0)
  const totalRows = block.boxes.reduce((a, b) => a + b.rows.length, 0)

  const updateBox = (boxIdx, updates) => {
    const boxes = block.boxes.map((b, i) => i === boxIdx ? { ...b, ...updates } : b)
    onUpdate({ ...block, boxes })
  }

  const updateRow = (boxIdx, rowId, updatedRow) => {
    const boxes = block.boxes.map((b, i) => {
      if (i !== boxIdx) return b
      return { ...b, rows: b.rows.map(r => r._id === rowId ? updatedRow : r) }
    })
    onUpdate({ ...block, boxes })
  }

  const deleteRow = (boxIdx, rowId) => {
    const boxes = block.boxes.map((b, i) => {
      if (i !== boxIdx) return b
      const rows = b.rows.filter(r => r._id !== rowId)
      return { ...b, rows: rows.length ? rows : [newRow(block.growerId, b.boxNr, 0)] }
    }).filter(Boolean)
    onUpdate({ ...block, boxes })
  }

  const addRow = (boxIdx) => {
    const box = block.boxes[boxIdx]
    const sortOrder = box.rows.length
    const row = newRow(block.growerId, box.boxNr, sortOrder)
    const boxes = block.boxes.map((b, i) => i === boxIdx ? { ...b, rows: [...b.rows, row] } : b)
    onUpdate({ ...block, boxes })
    // Focus first cell of new row after render
    setTimeout(() => {
      const el = inputRefs.current[row._id]
      if (el) el.focus()
    }, 50)
  }

  const addBox = () => {
    const nextNr = Math.max(...block.boxes.map(b => b.boxNr), 0) + 1
    onUpdate({ ...block, boxes: [...block.boxes, newBox(block.growerId, nextNr)] })
  }

  const deleteBox = (boxIdx) => {
    // Box-trash deletes only this box — never the grower.
    // If it was the last box, the grower stub remains with the "+ Add box" affordance.
    const boxes = block.boxes.filter((_, i) => i !== boxIdx)
    onUpdate({ ...block, boxes })
  }

  const deleteGrower = () => {
    const name = block.growerName || 'this grower'
    if (window.confirm(`Remove ${name} and all their boxes from this shipment? This cannot be undone.`)) {
      onDelete(block.growerId)
    }
  }

  const handleKeyDown = (e, rowId, field) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      // find next input — simple flat list approach
      const allInputs = document.querySelectorAll('.cell-input, .cell-select')
      const arr = Array.from(allInputs)
      const curr = e.target
      const idx = arr.indexOf(curr)
      if (idx >= 0 && idx < arr.length - 1) arr[idx + 1].focus()
    }
  }

  const rowIds = block.boxes.flatMap(b => b.rows.map(r => r._id))

  return (
    <div ref={setNodeRef} className={`grower-block${isOver ? ' dragging-over' : ''}`}>
      <div className="grower-header" onClick={() => onUpdate({ ...block, collapsed: !block.collapsed })}>
        <i className="ti ti-grip-vertical drag-handle" aria-hidden="true" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 16 }} />
        <span className="grower-header-name">{block.growerName}</span>
        {growerProducts && growerProducts.length > 0 && (
          <span style={{ fontSize: 10, background: 'rgba(201,169,110,0.25)', color: '#C9A96E', padding: '2px 7px', borderRadius: 10, fontWeight: 600 }}>
            {growerProducts.length} varieties
          </span>
        )}
        <div className="grower-header-stats">
          <span>{formatInt(totalStems)} stems</span>
          <span>{formatEur(totalCost, 2, '$')}</span>
          <span>{confirmedRows}/{totalRows} confirmed</span>
        </div>
        <button className="grower-collapse-btn" onClick={e => { e.stopPropagation(); onUpdate({ ...block, collapsed: !block.collapsed }) }} title={block.collapsed ? 'Expand' : 'Collapse'}>
          <i className={`ti ti-chevron-${block.collapsed ? 'right' : 'down'}`} aria-hidden="true" style={{ fontSize: 15, color: 'rgba(255,255,255,0.7)' }} />
        </button>
        {!locked && (
          <button className="grower-collapse-btn" onClick={e => { e.stopPropagation(); deleteGrower() }} title="Remove grower from shipment">
            <i className="ti ti-trash" aria-hidden="true" style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }} />
          </button>
        )}
      </div>

      {!block.collapsed && (
        <>
          {/* Column headers — shown once per grower */}
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-2)', borderBottom: '0.5px solid var(--border)', fontSize: 10, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            <span style={{ width: 34 }} />
            <span style={{ width: 28 }}>#</span>
            <span style={{ width: 42, padding: '6px 8px' }}>Type</span>
            <span style={{ flex: 3, minWidth: 180, padding: '6px 10px' }}>Variety / Product</span>
            <span style={{ width: 72, padding: '6px 10px' }}>Length</span>
            <span style={{ width: 80, padding: '6px 10px' }}>Stems</span>
            <span style={{ width: 70, padding: '6px 10px' }}>St/Bunch</span>
            <span style={{ width: 82, padding: '6px 10px' }}>Price $</span>
            <span style={{ width: 88, padding: '6px 10px' }}>Total $</span>
            <span style={{ flex: 1, minWidth: 80, padding: '6px 10px' }}>Notes</span>
            <span style={{ width: 110, padding: '6px 10px', textAlign: 'center' }}>State</span>
            <span style={{ width: 30 }} />
          </div>

          <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
            {block.boxes.map((box, boxIdx) => (
              <div key={`box_${block.growerId}_${box.boxNr}`} className="box-block">
                <div className="box-header">
                  <span className="box-drag-handle"><i className="ti ti-grip-horizontal" aria-hidden="true" /></span>
                  <span className="box-number">Box {box.boxNr}</span>
                  <select className="box-type-select" value={box.box_type}
                    onChange={e => updateBox(boxIdx, { box_type: e.target.value })}
                    onClick={e => e.stopPropagation()}
                    disabled={locked}>
                    {BOX_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <input
                    className="box-mark-input"
                    placeholder="Mark"
                    value={box.boxmark}
                    onChange={e => updateBox(boxIdx, { boxmark: e.target.value })}
                    onClick={e => e.stopPropagation()}
                    readOnly={locked}
                  />
                  <span className="box-stems">
                    {formatInt(box.rows.reduce((a, r) => a + (Number(r.stems_ordered) || 0), 0))} stems
                  </span>
                  {!locked && (
                    <button className="box-delete-btn" onClick={() => deleteBox(boxIdx)} title="Remove box">
                      <i className="ti ti-trash" aria-hidden="true" />
                    </button>
                  )}
                </div>

                <div className="product-rows">
                  {box.rows.map((row, rowIdx) => (
                    <ProductRow
                      key={row._id}
                      row={row}
                      rowIndex={rowIdx}
                      products={availableProducts}
                      showState={showState}
                      locked={locked}
                      onOpenHistory={onOpenHistory}
                      onUpdate={updated => updateRow(boxIdx, row._id, updated)}
                      onDelete={rowId => deleteRow(boxIdx, rowId)}
                      onKeyDown={handleKeyDown}
                      inputRef={el => { if (el) inputRefs.current[row._id] = el }}
                    />
                  ))}
                </div>

                {!locked && (
                  <button className="add-row-btn" onClick={() => addRow(boxIdx)}>
                    <i className="ti ti-plus" aria-hidden="true" style={{ fontSize: 13 }} /> Add product line
                  </button>
                )}
              </div>
            ))}
          </SortableContext>

          {!locked && (
            <button className="add-box-btn" onClick={addBox}>
              <i className="ti ti-package" aria-hidden="true" style={{ fontSize: 14 }} /> Add box
            </button>
          )}
        </>
      )}
    </div>
  )
}

// ── Main PO Editor ───────────────────────────────────────────────────────────
export default function POEditor({ shipmentId, companyId, status, growers, products, onStartPurchasing, onClosePurchasing, onReopenPurchasing }) {
  // The PO list is editable only in Draft and Active. After Close purchasing
  // (status = in_transit) and beyond, the list is locked. Buyer must Reopen
  // purchasing to make changes.
  const locked = status !== 'draft' && status !== 'active'

  // Which line's history drawer is open (null = closed)
  const [openHistoryFor, setOpenHistoryFor] = useState(null)
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showAddGrower, setShowAddGrower] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const [showSaveTpl, setShowSaveTpl] = useState(false)
  const [showLoadTpl, setShowLoadTpl] = useState(false)
  const [tplMsg, setTplMsg] = useState('')
  const saveTimer = useRef(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // Load existing POs from DB (reusable so we can refresh after applying a template)
  const loadPOs = useCallback(async () => {
      setLoading(true)
      const { data } = await supabase
        .from('purchase_orders')
        .select('*, products(id,name,vbn_code)')
        .eq('shipment_id', shipmentId)
        .order('sort_order')

      if (!data || data.length === 0) { setBlocks([]); setLoading(false); return }

      // Group by grower then box_nr
      const growerMap = {}
      data.forEach(po => {
        const fid = po.grower_company_id || 'open'
        const grower = growers.find(f => f.id === fid)
        const fname = grower?.name || '— Open market'
        const fcode = grower?.code || ''
        if (!growerMap[fid]) growerMap[fid] = { growerId: fid, growerName: fname, growerCode: fcode, collapsed: false, boxes: {} }
        const bn = po.box_nr || 1
        if (!growerMap[fid].boxes[bn]) growerMap[fid].boxes[bn] = { boxNr: bn, boxmark: po.boxmark || '', box_type: po.box_type || 'HB', rows: [] }
        growerMap[fid].boxes[bn].rows.push({
          _id: po.id,
          isNew: false,
          grower_id: po.grower_company_id,
          box_nr: po.box_nr,
          boxmark: po.boxmark,
          box_type: po.box_type,
          product_id: po.product_id,
          order_type: po.order_type || 'open_market',
          status: po.status || 'pending',
          state: po.state || 'pending',
          length_cm: po.length_cm || '',
          stems_ordered: po.stems_ordered || '',
          stems_per_bunch: po.stems_per_bunch || 25,
          price_ordered: po.price_ordered != null ? String(po.price_ordered).replace('.', ',') : '',
          notes_buyer: po.notes_buyer || '',
          sort_order: po.sort_order || 0,
        })
      })

      const blockArr = Object.values(growerMap).map(f => ({
        ...f,
        boxes: Object.values(f.boxes)
      }))
      setBlocks(blockArr)
      setLoading(false)
  }, [shipmentId, growers])

  useEffect(() => { loadPOs() }, [loadPOs])

  // Auto-refresh when the window regains focus (no polling).
  useEffect(() => {
    const onFocus = () => loadPOs()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [loadPOs])

  // Apply a template's lines to this shipment, then refresh
  const applyTemplate = useCallback(async (templateId) => {
    const { data: items } = await supabase
      .from('po_template_items').select('*').eq('template_id', templateId).order('sort_order')
    if (items && items.length) {
      await supabase.from('purchase_orders').insert(templateItemsToPOPayloads(items, shipmentId))
    }
    setShowLoadTpl(false)
    await loadPOs()
    setTplMsg(items?.length ? `Loaded ${items.length} lines from template.` : 'That template had no lines.')
    setTimeout(() => setTplMsg(''), 3000)
  }, [shipmentId, loadPOs])

  // Auto-save with debounce
  const autoSave = useCallback((newBlocks) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => save(newBlocks), 1500)
  }, [])

  const updateBlock = (idx, updated) => {
    const nb = blocks.map((b, i) => i === idx ? updated : b)
    setBlocks(nb)
    autoSave(nb)
  }

  const deleteBlock = (growerId) => {
    const nb = blocks.filter(b => b.growerId !== growerId)
    setBlocks(nb)
    autoSave(nb)
  }

  const addFarm = (grower) => {
    const exists = blocks.find(b => b.growerId === grower.id)
    if (exists) { setShowAddGrower(false); return }
    const nb = [...blocks, newGrowerBlock(grower)]
    setBlocks(nb)
    setShowAddGrower(false)
    autoSave(nb)
  }

  // Save all to DB
  const save = async (blocksToSave = blocks) => {
    setSaving(true)

    // Collect all rows with their current data
    const allRows = []
    blocksToSave.forEach(block => {
      block.boxes.forEach(box => {
        box.rows.forEach((row, rowIdx) => {
          allRows.push({
            _localId: row._id,
            isNew: row.isNew,
            dbId: row.isNew ? null : row._id,
            payload: {
              shipment_id: shipmentId,
              grower_company_id: block.growerId === 'open' ? null : block.growerId,
              product_id: row.product_id || null,
              order_type: row.order_type,
              status: row.status,
              box_nr: box.boxNr,
              boxmark: box.boxmark || null,
              box_type: box.box_type,
              length_cm: row.length_cm ? parseInt(row.length_cm) : null,
              stems_ordered: row.stems_ordered ? parseInt(row.stems_ordered) : null,
              stems_per_bunch: row.stems_per_bunch ? parseInt(row.stems_per_bunch) : 25,
              price_ordered: parseEur(row.price_ordered),
              notes_buyer: row.notes_buyer || null,
              sort_order: rowIdx,
            }
          })
        })
      })
    })

    // Step 1: Get existing DB row IDs for this shipment
    const { data: existingDbRows } = await supabase
      .from('purchase_orders').select('id').eq('shipment_id', shipmentId)
    const existingDbIds = new Set((existingDbRows || []).map(r => r.id))

    // Step 2: Insert new rows
    const toInsert = allRows.filter(r => r.isNew)
    const insertIdMap = {} // localId → realId
    for (const r of toInsert) {
      const { data } = await supabase.from('purchase_orders').insert([r.payload]).select().single()
      if (data) insertIdMap[r._localId] = data.id
    }

    // Step 3: Update existing rows
    const toUpdate = allRows.filter(r => !r.isNew && r.dbId)
    for (const r of toUpdate) {
      await supabase.from('purchase_orders').update(r.payload).eq('id', r.dbId)
      existingDbIds.delete(r.dbId) // mark as accounted for
    }
    // Also remove newly inserted from deletion candidates
    toInsert.forEach(r => { if (insertIdMap[r._localId]) existingDbIds.delete(insertIdMap[r._localId]) })

    // Step 4: Delete rows that are in DB but no longer in blocks
    if (existingDbIds.size > 0) {
      await supabase.from('purchase_orders').delete().in('id', [...existingDbIds])
    }

    // Step 5: Update local state to clear isNew and assign real IDs
    if (Object.keys(insertIdMap).length > 0) {
      setBlocks(prev => prev.map(block => ({
        ...block,
        boxes: block.boxes.map(box => ({
          ...box,
          rows: box.rows.map(row => {
            if (row.isNew && insertIdMap[row._id]) {
              return { ...row, isNew: false, _id: insertIdMap[row._id] }
            }
            return row
          })
        }))
      })))
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // DnD handlers
  const handleDragEnd = (event) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return

    const activeData = active.data.current
    const overData = over.data.current

    // Row reorder within same box
    if (activeData?.type === 'row') {
      const newBlocks = blocks.map(block => ({
        ...block,
        boxes: block.boxes.map(box => {
          const ids = box.rows.map(r => r._id)
          if (!ids.includes(active.id)) return box
          const oldIdx = ids.indexOf(active.id)
          const newIdx = ids.indexOf(over.id)
          if (newIdx === -1) return box
          return { ...box, rows: arrayMove(box.rows, oldIdx, newIdx) }
        })
      }))
      setBlocks(newBlocks)
      autoSave(newBlocks)
    }
  }

  // Totals
  const allRows = blocks.flatMap(b => b.boxes.flatMap(box => box.rows))
  const totalStemsOrdered = allRows.reduce((a, r) => a + (Number(r.stems_ordered) || 0), 0)
  const totalCostOrdered = allRows.reduce((a, r) => a + ((Number(r.stems_ordered) || 0) * (parseEur(r.price_ordered) || 0)), 0)
  const confirmed = allRows.filter(r => r.status === 'confirmed')
  const totalStemsConfirmed = confirmed.reduce((a, r) => a + (Number(r.stems_ordered) || 0), 0)
  const totalCostConfirmed = confirmed.reduce((a, r) => a + ((Number(r.stems_ordered) || 0) * (parseEur(r.price_ordered) || 0)), 0)

  if (loading) return <div className="empty"><i className="ti ti-loader" /><div className="empty-title">Loading purchase orders…</div></div>

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      onDragStart={e => setActiveId(e.active.id)}
      onDragEnd={handleDragEnd}>

      <div className="po-editor">
        <div className="po-editor-toolbar">
          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', flex: 1 }}>
            Purchase Order List
            <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-3)', fontWeight: 400 }}>
              {blocks.length} growers · {allRows.length} lines
            </span>
          </span>
          {saved && <span style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 5 }}><i className="ti ti-check" />Saved</span>}
          {saving && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Saving…</span>}
          {tplMsg && <span style={{ fontSize: 12, color: 'var(--brown)' }}>{tplMsg}</span>}
          {status === 'draft' && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowLoadTpl(true)}>
              <i className="ti ti-template" aria-hidden="true" /> Load template
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={loadPOs} title="Refresh">
            <i className="ti ti-refresh" aria-hidden="true" /> Refresh
          </button>
          {!locked && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowSaveTpl(true)} disabled={blocks.length === 0}>
              <i className="ti ti-device-floppy" aria-hidden="true" /> Save as template
            </button>
          )}
          {(status === 'draft' || status === 'active') && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddGrower(true)}>
              <i className="ti ti-building-factory" aria-hidden="true" /> Add grower
            </button>
          )}
          {status === 'draft' && onStartPurchasing ? (
            <button className="btn btn-primary btn-sm" onClick={onStartPurchasing} disabled={blocks.length === 0} title={blocks.length === 0 ? 'Add at least one grower first' : 'Send this list to growers and begin negotiation'}>
              <i className="ti ti-send" aria-hidden="true" /> Start purchasing
            </button>
          ) : onClosePurchasing ? (
            <button className="btn btn-primary btn-sm" onClick={onClosePurchasing}>
              <i className="ti ti-lock" aria-hidden="true" /> Close purchasing
            </button>
          ) : onReopenPurchasing ? (
            <button className="btn btn-primary btn-sm" onClick={onReopenPurchasing}>
              <i className="ti ti-lock-open" aria-hidden="true" /> Reopen purchasing
            </button>
          ) : null}
        </div>

        {blocks.length === 0 ? (
          <div className="empty">
            <i className="ti ti-list-check" />
            <div className="empty-title">Purchase Order List is empty</div>
            <div className="empty-sub">Add a grower to start building the order list for this shipment</div>
            {(status === 'draft' || status === 'active') && (
              <button className="btn btn-brown" style={{ marginTop: 12 }} onClick={() => setShowAddGrower(true)}>
                <i className="ti ti-building-factory" aria-hidden="true" /> Add first grower
              </button>
            )}
          </div>
        ) : (
          <>
            {blocks.map((block, idx) => (
              <GrowerBlock
                key={block.growerId}
                block={block}
                blockIndex={idx}
                growers={growers}
                products={products}
                showState={status !== 'draft'}
                locked={locked}
                onOpenHistory={setOpenHistoryFor}
                onUpdate={updated => updateBlock(idx, updated)}
                onDelete={growerId => deleteBlock(growerId)}
              />
            ))}
            {(status === 'draft' || status === 'active') && (
              <button className="add-grower-btn" onClick={() => setShowAddGrower(true)}>
                <i className="ti ti-plus" aria-hidden="true" style={{ fontSize: 15 }} /> Add another grower
              </button>
            )}
          </>
        )}
      </div>

      {/* Totals — outside the editor card so never clipped */}
      {blocks.length > 0 && (
        <div className="totals-bar" style={{ marginTop: 12 }}>
          <div className="total-item"><div className="total-label">Stems ordered</div><div className="total-val">{formatInt(totalStemsOrdered)}</div></div>
          <div className="total-item"><div className="total-label">Stems confirmed</div><div className="total-val hi">{formatInt(totalStemsConfirmed)}</div></div>
          <div className="total-item"><div className="total-label">Cost ordered</div><div className="total-val">{formatEur(totalCostOrdered, 2, '$')}</div></div>
          <div className="total-item"><div className="total-label">Cost confirmed</div><div className="total-val hi">{formatEur(totalCostConfirmed, 2, '$')}</div></div>
          <div className="total-item"><div className="total-label">Growers</div><div className="total-val">{blocks.length}</div></div>
          <div className="total-item"><div className="total-label">Order lines</div><div className="total-val">{allRows.length}</div></div>
        </div>
      )}

      {/* Add Grower Modal */}
      {showAddGrower && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAddGrower(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <i className="ti ti-building-factory" style={{ fontSize: 17, color: 'var(--green)' }} aria-hidden="true" />
              <div className="modal-title">Add grower to this shipment</div>
              <button className="btn-icon" onClick={() => setShowAddGrower(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body" style={{ gap: 6, maxHeight: 400, overflowY: 'auto' }}>
              {growers.filter(f => !blocks.find(b => b.growerId === f.id)).map(grower => (
                <div key={grower.id}
                  onClick={() => addFarm(grower)}
                  style={{ padding: '11px 14px', border: '0.5px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--green-pale)'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{grower.name}</div>
                    {grower.code && <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{grower.code}</div>}
                  </div>
                  <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{grower.country}</span>
                </div>
              ))}
              {growers.filter(f => !blocks.find(b => b.growerId === f.id)).length === 0 && (
                <div className="empty" style={{ padding: 24 }}>
                  <div className="empty-sub">All growers already added to this shipment</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showSaveTpl && (
        <SaveTemplateModal
          companyId={companyId}
          blocks={blocks}
          onClose={() => setShowSaveTpl(false)}
          onSaved={(m) => { setShowSaveTpl(false); setTplMsg(m); setTimeout(() => setTplMsg(''), 3000) }}
        />
      )}
      {showLoadTpl && (
        <LoadTemplateModal
          companyId={companyId}
          onApply={applyTemplate}
          onClose={() => setShowLoadTpl(false)}
        />
      )}

      <LineDrawer poId={openHistoryFor} onClose={() => setOpenHistoryFor(null)} />
    </DndContext>
  )
}
