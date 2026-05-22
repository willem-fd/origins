import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { CSS } from './styles'
import POEditor from './POEditor'
import { COUNTRIES, SHIP_STATUSES, flag, fmt, validateEmail, validatePhone } from './utils'

// ── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = { draft:'Draft', active:'Active', dropped:'Dropped', in_transit:'In Transit', arrived:'Arrived', completed:'Completed' }
  const cls = { draft:'badge-draft', active:'badge-active', dropped:'badge-dropped', in_transit:'badge-transit', arrived:'badge-arrived', completed:'badge-completed' }
  return <span className={`badge ${cls[status]||'badge-draft'}`}>{map[status]||status}</span>
}

// ── Country Select ────────────────────────────────────────────────────────────
function CountrySelect({ value, onChange, className = 'form-select', placeholder = '— Select country —' }) {
  return (
    <select className={className} value={value||''} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
    </select>
  )
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const submit = async e => {
    e.preventDefault(); setLoading(true); setErr('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (error) setErr(error.message)
    else onLogin(data.user)
    setLoading(false)
  }
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">ORIGINS</div>
        <div className="login-tagline">Procurement Platform · Farm Direct Flowers</div>
        {err && <div style={{background:'#fef2f2',color:'#b91c1c',padding:'10px 14px',borderRadius:7,fontSize:13,marginBottom:14}}>{err}</div>}
        <form onSubmit={submit} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@farmdirect.nl" />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={pw} onChange={e=>setPw(e.target.value)} required placeholder="••••••••" />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{marginTop:6,justifyContent:'center',padding:11}}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
function Sidebar({ page, setPage, user, pendingCount, onSignOut }) {
  const ni = (id, icon, label, badge) => (
    <div className={`nav-item${page===id?' active':''}`} onClick={()=>setPage(id)}>
      <i className={`ti ti-${icon}`} aria-hidden="true" />{label}
      {badge!=null && <span className="nav-badge">{badge}</span>}
    </div>
  )
  return (
    <div className="sidebar">
      <div
        className="sidebar-logo"
        onClick={() => setPage('dashboard')}
        style={{cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:'24px 20px'}}
      >
        <img src="/origins-logo.svg" alt="Origins" style={{width:'130px', height:'auto', display:'block'}} />
      </div>
      <div className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-label">Overview</div>
          {ni('dashboard','layout-dashboard','Dashboard')}
        </div>
        <div className="nav-section">
          <div className="nav-label">Purchasing</div>
          {ni('shipments','plane','Shipments', pendingCount||undefined)}
          {ni('templates','template','PO Templates')}
        </div>
        <div className="nav-section">
          <div className="nav-label">Relations</div>
          {ni('growers','plant','Growers')}
          {ni('logistics','truck','Logistics')}
        </div>
        <div className="nav-section">
          <div className="nav-label">Finance</div>
          {ni('statements','file-invoice','Account Statements')}
          {ni('claims','alert-triangle','Claims')}
        </div>
        <div className="nav-section">
          <div className="nav-label">Admin</div>
          {ni('products','flower','Products')}
          {ni('users','users','Users')}
          {ni('settings','settings','Settings')}
        </div>
      </div>
      <div className="sidebar-footer">
        <div className="user-row" onClick={onSignOut}>
          <div className="avatar">{(user?.email||'U').slice(0,2).toUpperCase()}</div>
          <div>
            <div className="user-name">{user?.email?.split('@')[0]}</div>
            <div className="user-role">Admin · sign out</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── New Shipment Modal ────────────────────────────────────────────────────────
function NewShipmentModal({ logistics, onClose, onSave }) {
  const airlines = logistics.filter(l => l.type === 'airline')
  const cargoAgents = logistics.filter(l => l.type === 'cargo_agent')
  const customsAgents = logistics.filter(l => l.type === 'customs_agent')
  const handling = logistics.filter(l => l.type === 'handling')
  const trucking = logistics.filter(l => l.type === 'trucking')

  const [f, setF] = useState({
    origin_country:'EC', origin_airport:'UIO', destination_airport:'AMS',
    airline_id:'', cargo_agent_id:'', customs_agent_id:'', handling_id:'', trucking_id:'',
    drop_date:'', departure_date:'', arrival_date:'', notes:'', status:'draft'
  })
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setF(p=>({...p,[k]:v}))

  const airports = { EC:['UIO','GYE'], CO:['BOG','MDE'], KE:['NBO'], ET:['ADD'] }

  const handleSave = async () => {
    setSaving(true)
    const payload = { ...f,
      airline_id: f.airline_id||null, cargo_agent_id: f.cargo_agent_id||null,
      customs_agent_id: f.customs_agent_id||null, handling_id: f.handling_id||null,
      trucking_id: f.trucking_id||null,
      drop_date: f.drop_date||null, departure_date: f.departure_date||null, arrival_date: f.arrival_date||null,
    }
    const { data, error } = await supabase.from('shipments').insert([payload]).select().single()
    setSaving(false)
    if (error) { alert(error.message); return }
    onSave(data)
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <i className="ti ti-plane" style={{fontSize:17,color:'var(--green)'}} aria-hidden="true" />
          <div className="modal-title">New Shipment</div>
          <button className="btn-icon" onClick={onClose}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <div style={{fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Route</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Origin country</label>
              <CountrySelect value={f.origin_country} onChange={v=>{set('origin_country',v);set('origin_airport',airports[v]?.[0]||'')}} />
            </div>
            <div className="form-group">
              <label className="form-label">Departure airport</label>
              <select className="form-select" value={f.origin_airport} onChange={e=>set('origin_airport',e.target.value)}>
                {(airports[f.origin_country]||['UIO']).map(a=><option key={a}>{a}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Destination airport</label>
              <input className="form-input" value={f.destination_airport} onChange={e=>set('destination_airport',e.target.value)} />
            </div>
          </div>

          <div style={{fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginTop:4}}>Logistics partners</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Cargo agent</label>
              <select className="form-select" value={f.cargo_agent_id} onChange={e=>set('cargo_agent_id',e.target.value)}>
                <option value="">— Select —</option>
                {cargoAgents.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Airline</label>
              <select className="form-select" value={f.airline_id} onChange={e=>set('airline_id',e.target.value)}>
                <option value="">— Select —</option>
                {airlines.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Customs agent</label>
              <select className="form-select" value={f.customs_agent_id} onChange={e=>set('customs_agent_id',e.target.value)}>
                <option value="">— Select —</option>
                {customsAgents.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Handling company</label>
              <select className="form-select" value={f.handling_id} onChange={e=>set('handling_id',e.target.value)}>
                <option value="">— None —</option>
                {handling.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Trucking company</label>
              <select className="form-select" value={f.trucking_id} onChange={e=>set('trucking_id',e.target.value)}>
                <option value="">— None —</option>
                {trucking.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{flex:0,minWidth:0}} />
          </div>

          <div style={{fontSize:11,fontWeight:600,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginTop:4}}>Dates</div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Drop date</label>
              <input className="form-input" type="date" value={f.drop_date} onChange={e=>set('drop_date',e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Departure date</label>
              <input className="form-input" type="date" value={f.departure_date} onChange={e=>set('departure_date',e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Est. arrival date</label>
              <input className="form-input" type="date" value={f.arrival_date} onChange={e=>set('arrival_date',e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={f.notes} onChange={e=>set('notes',e.target.value)} placeholder="Any notes…" style={{minHeight:56}} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            <i className="ti ti-plus" aria-hidden="true" />{saving?'Creating…':'Create shipment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shipment Detail ────────────────────────────────────────────────────────────
function ShipmentDetail({ shipment, growers, products, logistics, onBack, onUpdate, onDelete }) {
  const [tab, setTab] = useState('orders')
  const [s, setS] = useState(shipment)
  const airline = logistics.find(l=>l.id===s.airline_id)
  const cargoAgent = logistics.find(l=>l.id===s.cargo_agent_id)
  const customsAgent = logistics.find(l=>l.id===s.customs_agent_id)

  const updateStatus = async status => {
    const { data } = await supabase.from('shipments').update({status}).eq('id',s.id).select().single()
    if (data) { setS(data); onUpdate(data) }
  }
  const updateField = async (field, value) => {
    const { data } = await supabase.from('shipments').update({[field]:value}).eq('id',s.id).select().single()
    if (data) { setS(data); onUpdate(data) }
  }
  const handleDelete = async () => {
    if (!window.confirm(`Delete shipment ${s.mawb||'(draft)'}? This cannot be undone.`)) return
    await supabase.from('purchase_orders').delete().eq('shipment_id', s.id)
    await supabase.from('shipments').delete().eq('id', s.id)
    onDelete(s.id)
  }

  return (
    <>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}><i className="ti ti-arrow-left" aria-hidden="true" /> Shipments</button>
        <div style={{flex:1}} />
        {s.status === 'draft' && (
          <button className="btn btn-danger btn-sm" onClick={handleDelete}>
            <i className="ti ti-trash" aria-hidden="true" /> Delete draft
          </button>
        )}
        <select className="form-select" style={{width:'auto',fontSize:12,padding:'5px 10px'}}
          value={s.status} onChange={e=>updateStatus(e.target.value)}>
          {SHIP_STATUSES.map(st=><option key={st} value={st}>{st.charAt(0).toUpperCase()+st.slice(1).replace('_',' ')}</option>)}
        </select>
        <StatusBadge status={s.status} />
      </div>

      <div style={{display:'flex',alignItems:'baseline',gap:12}}>
        <h1 style={{fontSize:21,fontWeight:400,color:'var(--text-1)'}}>
          {s.mawb ? `AWB ${s.mawb}` : 'Shipment — AWB pending'}
        </h1>
        <span style={{fontSize:13,color:'var(--text-3)'}}>
          {flag(s.origin_country)} {s.origin_airport} → {s.destination_airport}
          {airline && ` · ${airline.name}`}
        </span>
      </div>

      <div className="meta-grid">
        {[
          {label:'Drop date', value:s.drop_date||'—', mono:true},
          {label:'Departure', value:s.departure_date||'—', mono:true},
          {label:'Est. arrival', value:s.arrival_date||'—', mono:true},
          {label:'AWB', value:s.mawb||'—', mono:true},
          {label:'HAWB', value:s.hawb||'—', mono:true},
          {label:'Cargo agent', value:cargoAgent?.name||'—'},
          {label:'Airline', value:airline?.name||'—'},
          {label:'Customs agent', value:customsAgent?.name||'—'},
          {label:'Chargeable weight', value:s.chargeable_weight?`${s.chargeable_weight} kg`:'—', mono:true},
        ].map(m=>(
          <div className="meta-item" key={m.label}>
            <div className="meta-label">{m.label}</div>
            <div className={`meta-value${m.mono?' mono':''}`}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="tabs" style={{padding:'0 20px'}}>
          <div className={`tab${tab==='orders'?' active':''}`} onClick={()=>setTab('orders')}>Purchase Order List</div>
          <div className={`tab${tab==='costs'?' active':''}`} onClick={()=>setTab('costs')}>Costs & AWB</div>
          <div className={`tab${tab==='docs'?' active':''}`} onClick={()=>setTab('docs')}>Documents</div>
        </div>

        {tab==='orders' && (
          <div style={{padding:16}}>
            <POEditor shipmentId={s.id} farms={growers} products={products} />
          </div>
        )}
        {tab==='costs' && (
          <div style={{padding:20,display:'flex',flexDirection:'column',gap:14}}>
            <div style={{fontSize:13,color:'var(--text-2)'}}>Enter AWB details once received. Used to calculate landed cost per stem.</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">MAWB number</label>
                <input className="form-input" defaultValue={s.mawb||''} onBlur={e=>updateField('mawb',e.target.value||null)} placeholder="e.g. 5Y-12345678" />
              </div>
              <div className="form-group">
                <label className="form-label">HAWB number</label>
                <input className="form-input" defaultValue={s.hawb||''} onBlur={e=>updateField('hawb',e.target.value||null)} placeholder="optional" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Gross weight (kg)</label>
                <input className="form-input" type="number" defaultValue={s.gross_weight||''} onBlur={e=>updateField('gross_weight',e.target.value||null)} />
              </div>
              <div className="form-group">
                <label className="form-label">Chargeable weight (kg)</label>
                <input className="form-input" type="number" defaultValue={s.chargeable_weight||''} onBlur={e=>updateField('chargeable_weight',e.target.value||null)} />
              </div>
              <div className="form-group">
                <label className="form-label">AWB total cost (USD)</label>
                <input className="form-input" type="number" step="0.01" defaultValue={s.awb_total_cost||''} onBlur={e=>updateField('awb_total_cost',e.target.value||null)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Customs cost (EUR)</label>
                <input className="form-input" type="number" step="0.01" defaultValue={s.customs_cost||''} onBlur={e=>updateField('customs_cost',e.target.value||null)} />
              </div>
              <div className="form-group">
                <label className="form-label">Handling cost (EUR)</label>
                <input className="form-input" type="number" step="0.01" defaultValue={s.handling_cost||''} onBlur={e=>updateField('handling_cost',e.target.value||null)} />
              </div>
              <div className="form-group">
                <label className="form-label">Other costs (EUR)</label>
                <input className="form-input" type="number" step="0.01" defaultValue={s.other_costs||''} onBlur={e=>updateField('other_costs',e.target.value||null)} />
              </div>
            </div>
          </div>
        )}
        {tab==='docs' && (
          <div className="empty" style={{padding:'48px 20px'}}>
            <i className="ti ti-file-upload" />
            <div className="empty-title">Document vault</div>
            <div className="empty-sub">Invoice upload, AWB, phytosanitary, Form-A — coming next</div>
          </div>
        )}
      </div>
    </>
  )
}

// ── Shipments List ─────────────────────────────────────────────────────────────
function ShipmentsPage({ shipments, logistics, onSelect, onNew }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const filtered = shipments.filter(s => {
    const q = search.toLowerCase()
    const ms = !q || (s.mawb||'').toLowerCase().includes(q) || (s.origin_airport||'').toLowerCase().includes(q)
    const mf = filter==='all'||s.status===filter
    return ms && mf
  })
  const airline = id => logistics.find(l=>l.id===id)?.name||'—'

  return (
    <>
      <div className="kpi-grid">
        {[
          {label:'Draft / Active', value:shipments.filter(s=>['draft','active'].includes(s.status)).length},
          {label:'Dropped', value:shipments.filter(s=>s.status==='dropped').length, brown:true},
          {label:'In transit', value:shipments.filter(s=>s.status==='in_transit').length},
          {label:'Completed', value:shipments.filter(s=>s.status==='completed').length},
        ].map(k=>(
          <div className="kpi-card" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-value${k.brown?' brown':''}`}>{k.value}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-header">
          <div className="card-title">All shipments</div>
          <input className="search-input" placeholder="Search…" value={search} onChange={e=>setSearch(e.target.value)} />
          <select className="form-select" style={{width:'auto',fontSize:12}} value={filter} onChange={e=>setFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {SHIP_STATUSES.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1).replace('_',' ')}</option>)}
          </select>
          <button className="btn btn-primary" onClick={onNew}><i className="ti ti-plus" aria-hidden="true" /> New shipment</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Route</th><th>AWB</th><th>Airline</th><th>Drop date</th><th>Departure</th><th>Est. Arrival</th><th>Status</th></tr></thead>
            <tbody>
              {filtered.map(s=>(
                <tr key={s.id} onClick={()=>onSelect(s)}>
                  <td><span className="route-cell"><span className="flag">{flag(s.origin_country)}</span><span style={{fontSize:12,color:'var(--text-3)'}}>{s.origin_airport}</span><span className="arrow">→</span><span className="flag">🇳🇱</span><span style={{fontSize:12,color:'var(--text-3)'}}>{s.destination_airport}</span></span></td>
                  <td><span className="td-brown">{s.mawb||<span style={{color:'var(--text-3)',fontStyle:'italic',fontSize:12}}>pending</span>}</span></td>
                  <td className="td-muted">{airline(s.airline_id)}</td>
                  <td className="td-mono">{s.drop_date||'—'}</td>
                  <td className="td-mono">{s.departure_date||'—'}</td>
                  <td className="td-mono">{s.arrival_date||'—'}</td>
                  <td><StatusBadge status={s.status} /></td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td colSpan={7}><div className="empty"><i className="ti ti-plane" /><div className="empty-title">No shipments</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ── Growers Page ───────────────────────────────────────────────────────────────
function GrowersPage({ growers, setGrowers }) {
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [f, setF] = useState({name:'',code:'',country:'EC',city:'',contact_name:'',contact_email:'',contact_phone:''})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setF(p=>({...p,[k]:v}))
  const filtered = growers.filter(g=>!search||g.name.toLowerCase().includes(search.toLowerCase())||g.country?.toLowerCase().includes(search.toLowerCase()))

  const validate = () => {
    const e = {}
    if (!f.name.trim()) e.name = 'Grower name is required'
    if (!validateEmail(f.contact_email)) e.contact_email = 'Invalid email format'
    if (!validatePhone(f.contact_phone)) e.contact_phone = 'Invalid phone number'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    const { data, error } = await supabase.from('farms').insert([f]).select().single()
    setSaving(false)
    if (error) { alert(error.message); return }
    setGrowers(gs=>[...gs,data])
    setShowNew(false)
    setF({name:'',code:'',country:'EC',city:'',contact_name:'',contact_email:'',contact_phone:''})
    setErrors({})
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Growers <span style={{color:'var(--text-3)',fontWeight:400,fontSize:12}}>({growers.length})</span></div>
          <input className="search-input" placeholder="Search growers…" value={search} onChange={e=>setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={()=>setShowNew(true)}><i className="ti ti-plus" aria-hidden="true" /> Add grower</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Grower name</th><th>Code</th><th>Country</th><th>City</th><th>Contact</th><th>Email</th><th>Phone</th></tr></thead>
            <tbody>
              {filtered.map(g=>(
                <tr key={g.id}>
                  <td style={{fontWeight:500}}>{g.name}</td>
                  <td className="td-mono">{g.code||'—'}</td>
                  <td>{g.country ? `${flag(g.country)} ${g.country}` : '—'}</td>
                  <td className="td-muted">{g.city||'—'}</td>
                  <td className="td-muted">{g.contact_name||'—'}</td>
                  <td className="td-muted">{g.contact_email||'—'}</td>
                  <td className="td-mono">{g.contact_phone||'—'}</td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td colSpan={7}><div className="empty"><i className="ti ti-plant" /><div className="empty-title">No growers yet</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowNew(false)}>
          <div className="modal" style={{maxWidth:520}}>
            <div className="modal-header">
              <i className="ti ti-plant" style={{fontSize:17,color:'var(--green)'}} aria-hidden="true" />
              <div className="modal-title">Add Grower</div>
              <button className="btn-icon" onClick={()=>setShowNew(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group" style={{flex:2}}>
                  <label className="form-label">Grower name *</label>
                  <input className={`form-input${errors.name?' error':''}`} value={f.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Joygardens" />
                  {errors.name && <div className="form-error">{errors.name}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Code</label>
                  <input className="form-input" value={f.code} onChange={e=>set('code',e.target.value)} placeholder="e.g. JOY" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <CountrySelect value={f.country} onChange={v=>set('country',v)} />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input className="form-input" value={f.city} onChange={e=>set('city',e.target.value)} placeholder="e.g. Quito" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Contact name</label>
                <input className="form-input" value={f.contact_name} onChange={e=>set('contact_name',e.target.value)} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className={`form-input${errors.contact_email?' error':''}`} type="email" value={f.contact_email} onChange={e=>set('contact_email',e.target.value)} placeholder="grower@example.com" />
                  {errors.contact_email && <div className="form-error">{errors.contact_email}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className={`form-input${errors.contact_phone?' error':''}`} value={f.contact_phone} onChange={e=>set('contact_phone',e.target.value)} placeholder="+593…" />
                  {errors.contact_phone && <div className="form-error">{errors.contact_phone}</div>}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'Saving…':'Add grower'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Logistics Page ─────────────────────────────────────────────────────────────
function LogisticsPage({ logistics, setLogistics }) {
  const [showNew, setShowNew] = useState(false)
  const [f, setF] = useState({name:'',code:'',type:'cargo_agent',country:'',city:'',contact_name:'',contact_email:'',contact_phone:''})
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const set = (k,v) => setF(p=>({...p,[k]:v}))
  const TYPE_LABELS = { cargo_agent:'Cargo Agent', airline:'Airline', customs_agent:'Customs Agent', handling:'Handling Co.', trucking:'Trucking Co.', other:'Other' }

  const validate = () => {
    const e = {}
    if (!f.name.trim()) e.name = 'Company name is required'
    if (!validateEmail(f.contact_email)) e.contact_email = 'Invalid email format'
    if (!validatePhone(f.contact_phone)) e.contact_phone = 'Invalid phone number'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    const { data, error } = await supabase.from('logistics_partners').insert([f]).select().single()
    setSaving(false)
    if (error) { alert(error.message); return }
    setLogistics(ls=>[...ls,data])
    setShowNew(false)
    setF({name:'',code:'',type:'cargo_agent',country:'',city:'',contact_name:'',contact_email:'',contact_phone:''})
    setErrors({})
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <div className="card-title">Logistics Partners <span style={{color:'var(--text-3)',fontWeight:400,fontSize:12}}>({logistics.length})</span></div>
          <button className="btn btn-primary" onClick={()=>setShowNew(true)}><i className="ti ti-plus" aria-hidden="true" /> Add partner</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Type</th><th>Code</th><th>Country</th><th>Contact</th><th>Email</th></tr></thead>
            <tbody>
              {logistics.map(l=>(
                <tr key={l.id}>
                  <td style={{fontWeight:500}}>{l.name}</td>
                  <td><span className="badge badge-draft">{TYPE_LABELS[l.type]||l.type}</span></td>
                  <td className="td-mono">{l.code||'—'}</td>
                  <td className="td-muted">{l.country ? `${flag(l.country)} ${l.country}` : '—'}</td>
                  <td className="td-muted">{l.contact_name||'—'}</td>
                  <td className="td-muted">{l.contact_email||'—'}</td>
                </tr>
              ))}
              {logistics.length===0 && <tr><td colSpan={6}><div className="empty"><i className="ti ti-truck" /><div className="empty-title">No logistics partners yet</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowNew(false)}>
          <div className="modal" style={{maxWidth:520}}>
            <div className="modal-header">
              <i className="ti ti-truck" style={{fontSize:17,color:'var(--green)'}} aria-hidden="true" />
              <div className="modal-title">Add Logistics Partner</div>
              <button className="btn-icon" onClick={()=>setShowNew(false)}><i className="ti ti-x" /></button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group" style={{flex:2}}>
                  <label className="form-label">Company name *</label>
                  <input className={`form-input${errors.name?' error':''}`} value={f.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. DSV Ecuador" />
                  {errors.name && <div className="form-error">{errors.name}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Code</label>
                  <input className="form-input" value={f.code} onChange={e=>set('code',e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Type</label>
                <select className="form-select" value={f.type} onChange={e=>set('type',e.target.value)}>
                  {Object.entries(TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Country</label>
                  <CountrySelect value={f.country} onChange={v=>set('country',v)} placeholder="— Select country —" />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input className="form-input" value={f.city} onChange={e=>set('city',e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Contact name</label>
                <input className="form-input" value={f.contact_name} onChange={e=>set('contact_name',e.target.value)} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className={`form-input${errors.contact_email?' error':''}`} type="email" value={f.contact_email} onChange={e=>set('contact_email',e.target.value)} />
                  {errors.contact_email && <div className="form-error">{errors.contact_email}</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className={`form-input${errors.contact_phone?' error':''}`} value={f.contact_phone} onChange={e=>set('contact_phone',e.target.value)} />
                  {errors.contact_phone && <div className="form-error">{errors.contact_phone}</div>}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setShowNew(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'Saving…':'Add partner'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Products Page ──────────────────────────────────────────────────────────────
function ProductsPage({ products }) {
  const [search, setSearch] = useState('')
  const [countryFilter, setCountryFilter] = useState('all')
  const [page, setPage] = useState(1)
  const PER_PAGE = 50

  const filtered = products.filter(p => {
    const q = search.toLowerCase()
    const ms = !q || (p.name||'').toLowerCase().includes(q) || (p.vbn_code||'').includes(q) || (p.search_key||'').toLowerCase().includes(q)
    const mc = countryFilter==='all' || p.country===countryFilter
    return ms && mc
  })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paged = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE)
  const countries = [...new Set(products.map(p=>p.country).filter(Boolean))].sort()

  return (
    <div className="card" style={{overflow:'visible'}}>
      <div className="card-header">
        <div className="card-title">Product Catalogue <span style={{color:'var(--text-3)',fontWeight:400,fontSize:12}}>({filtered.length} of {products.length})</span></div>
        <input className="search-input" placeholder="Search by name, VBN code…" value={search}
          onChange={e=>{setSearch(e.target.value);setPage(1)}} />
        <div className="product-catalogue-filters">
          <div className={`filter-chip${countryFilter==='all'?' active':''}`} onClick={()=>{setCountryFilter('all');setPage(1)}}>All</div>
          {countries.map(c=>(
            <div key={c} className={`filter-chip${countryFilter===c?' active':''}`} onClick={()=>{setCountryFilter(c);setPage(1)}}>
              {flag(c)} {c}
            </div>
          ))}
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>VBN Code</th><th>Name</th><th>VBN Name</th><th>Country</th><th>BKH</th><th>Ripeness</th><th>Quality</th></tr></thead>
          <tbody>
            {paged.map(p=>(
              <tr key={p.id} style={{cursor:'default'}}>
                <td className="td-mono">{p.vbn_code||'—'}</td>
                <td style={{fontWeight:500}}>{p.name}</td>
                <td className="td-muted" style={{fontSize:12}}>{p.vbn_name||'—'}</td>
                <td>{p.country ? `${flag(p.country)} ${p.country}` : '—'}</td>
                <td className="td-mono">{p.bkh||'—'}</td>
                <td className="td-muted">{p.ripeness||'—'}</td>
                <td className="td-muted">{p.quality||'—'}</td>
              </tr>
            ))}
            {paged.length===0 && <tr><td colSpan={7}><div className="empty"><i className="ti ti-flower" /><div className="empty-title">No products found</div></div></td></tr>}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 20px',borderTop:'0.5px solid var(--border)',background:'var(--surface)'}}>
          <span style={{fontSize:12,color:'var(--text-3)'}}>Page {page} of {totalPages} · {filtered.length} products</span>
          <div style={{display:'flex',gap:8}}>
            <button className="btn btn-ghost btn-sm" disabled={page===1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
            <button className="btn btn-ghost btn-sm" disabled={page>=totalPages} onClick={()=>setPage(p=>p+1)}>Next →</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
function DashboardPage({ shipments, logistics }) {
  const airline = id => logistics.find(l=>l.id===id)?.name||'—'
  return (
    <>
      <div className="kpi-grid">
        {[
          {label:'Pending shipments', value:shipments.filter(s=>['draft','active'].includes(s.status)).length},
          {label:'In transit', value:shipments.filter(s=>s.status==='in_transit').length, brown:true},
          {label:'Completed', value:shipments.filter(s=>s.status==='completed').length},
          {label:'Total shipments', value:shipments.length},
        ].map(k=>(
          <div className="kpi-card" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-value${k.brown?' brown':''}`}>{k.value}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Recent shipments</div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Route</th><th>AWB</th><th>Airline</th><th>Drop date</th><th>Departure</th><th>Status</th></tr></thead>
            <tbody>
              {shipments.slice(0,8).map(s=>(
                <tr key={s.id}>
                  <td><span className="route-cell"><span className="flag">{flag(s.origin_country)}</span><span style={{fontSize:12,color:'var(--text-3)'}}>{s.origin_airport}</span><span className="arrow">→</span><span className="flag">🇳🇱</span></span></td>
                  <td className="td-brown">{s.mawb||'—'}</td>
                  <td className="td-muted">{airline(s.airline_id)}</td>
                  <td className="td-mono">{s.drop_date||'—'}</td>
                  <td className="td-mono">{s.departure_date||'—'}</td>
                  <td><StatusBadge status={s.status}/></td>
                </tr>
              ))}
              {shipments.length===0 && <tr><td colSpan={6}><div className="empty"><i className="ti ti-plane"/><div className="empty-title">No shipments yet</div></div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function ComingSoon({icon,title,sub}) {
  return <div className="card" style={{padding:'80px 20px'}}><div className="empty"><i className={`ti ti-${icon}`}/><div className="empty-title">{title}</div><div className="empty-sub">{sub}</div></div></div>
}

// ── Root App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState('shipments')
  const [shipments, setShipments] = useState([])
  const [growers, setGrowers] = useState([])
  const [products, setProducts] = useState([])
  const [logistics, setLogistics] = useState([])
  const [selectedShipment, setSelectedShipment] = useState(null)
  const [showNewShipment, setShowNewShipment] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({data:{session}}) => { setUser(session?.user??null); setLoading(false) })
    supabase.auth.onAuthStateChange((_,session) => setUser(session?.user??null))
  }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('shipments').select('*').order('created_at',{ascending:false}).then(({data})=>setShipments(data||[]))
    supabase.from('farms').select('*').order('name').then(({data})=>setGrowers(data||[]))
    supabase.from('products').select('*').order('name').then(({data})=>setProducts(data||[]))
    supabase.from('logistics_partners').select('*').order('name').then(({data})=>setLogistics(data||[]))
  }, [user])

  const handleSignOut = async () => { await supabase.auth.signOut(); setUser(null) }

  const handleNewShipment = s => {
    setShipments(p=>[s,...p]); setShowNewShipment(false)
    setSelectedShipment(s); setPage('shipments')
  }

  const handleShipmentUpdate = u => {
    setShipments(p=>p.map(s=>s.id===u.id?u:s)); setSelectedShipment(u)
  }

  const handleShipmentDelete = id => {
    setShipments(p=>p.filter(s=>s.id!==id))
    setSelectedShipment(null)
  }

  const navPage = p => { setPage(p); setSelectedShipment(null) }
  const pendingCount = shipments.filter(s=>['draft','active','dropped'].includes(s.status)).length

  const topTitles = {
    dashboard:'Dashboard', shipments:'Shipments', templates:'PO Templates',
    growers:'Growers', logistics:'Logistics Partners',
    statements:'Account Statements', claims:'Claims & Credit Notes',
    products:'Product Catalogue', users:'Users', settings:'Settings'
  }

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'#243330',color:'#BA9870',fontSize:20,letterSpacing:'0.24em'}}>
      ORIGINS
    </div>
  )
  if (!user) return <><style>{CSS}</style><LoginPage onLogin={setUser}/></>

  return (
    <>
      <style>{CSS}</style>
      <div className="app">
        <Sidebar page={selectedShipment?'shipments':page} setPage={navPage} user={user} pendingCount={pendingCount} onSignOut={handleSignOut} />
        <div className="main">
          <div className="topbar">
            <div className="topbar-title">
              {selectedShipment
                ? <>{selectedShipment.mawb||'Shipment'} <span className="topbar-sub">{selectedShipment.origin_airport} → {selectedShipment.destination_airport}</span></>
                : topTitles[page]}
            </div>
          </div>
          <div className="page">
            {page==='dashboard'&&!selectedShipment&&<DashboardPage shipments={shipments} logistics={logistics}/>}
            {page==='shipments'&&!selectedShipment&&<ShipmentsPage shipments={shipments} logistics={logistics} onSelect={s=>{setSelectedShipment(s);setPage('shipments')}} onNew={()=>setShowNewShipment(true)}/>}
            {page==='shipments'&&selectedShipment&&<ShipmentDetail shipment={selectedShipment} growers={growers} products={products} logistics={logistics} onBack={()=>setSelectedShipment(null)} onUpdate={handleShipmentUpdate} onDelete={handleShipmentDelete}/>}
            {page==='growers'&&<GrowersPage growers={growers} setGrowers={setGrowers}/>}
            {page==='logistics'&&<LogisticsPage logistics={logistics} setLogistics={setLogistics}/>}
            {page==='products'&&<ProductsPage products={products}/>}
            {page==='templates'&&<ComingSoon icon="template" title="PO Templates" sub="Save and reuse purchase order lists — coming next"/>}
            {page==='statements'&&<ComingSoon icon="file-invoice" title="Account Statements" sub="Monthly farm payment reconciliation — coming next"/>}
            {page==='claims'&&<ComingSoon icon="alert-triangle" title="Claims & Credit Notes" sub="Quality claims management — coming next"/>}
            {page==='users'&&<ComingSoon icon="users" title="Users" sub="User management — coming next"/>}
            {page==='settings'&&<ComingSoon icon="settings" title="Settings" sub="Global settings — coming next"/>}
          </div>
        </div>
      </div>
      {showNewShipment&&<NewShipmentModal logistics={logistics} onClose={()=>setShowNewShipment(false)} onSave={handleNewShipment}/>}
    </>
  )
}
