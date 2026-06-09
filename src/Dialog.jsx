// ============================================================
// ORIGINS — Dialog: the standard Origins overlay.
// Replaces native window.confirm / alert / prompt and the
// browser default-styled dialog boxes. Every overlay in the
// app should use either <Dialog/> directly or one of the
// helpers (confirmDialog, alertDialog, promptDialog).
//
// Usage A — declarative:
//   <Dialog open={open} onClose={...} title="...">
//     <p>Body</p>
//     <DialogFooter>
//       <button className="btn btn-ghost" onClick={...}>Cancel</button>
//       <button className="btn btn-primary" onClick={...}>Save</button>
//     </DialogFooter>
//   </Dialog>
//
// Usage B — imperative (returns a Promise that resolves to a
// value when the user picks a choice, or false on dismiss):
//   const ok = await confirmDialog({
//     title: 'Delete this shipment?',
//     body: 'This cannot be undone.',
//     confirmLabel: 'Delete',
//     tone: 'danger',           // 'primary' | 'danger' | 'default'
//   })
//   if (!ok) return
//
//   const reason = await promptDialog({
//     title: 'Reason for cancellation',
//     body: 'Optional — the buyer will see this.',
//     placeholder: 'e.g. out of stock until next week',
//     submitLabel: 'Submit',
//     dismissLabel: 'No reason, just cancel',
//   })
//   // → reason is the entered string, '' if dismissed via secondary button,
//   //   or null if dismissed via close/Escape/backdrop.
//
//   await alertDialog({ title: 'Heads up', body: '...' })
// ============================================================

import { useEffect, useRef, useState } from 'react'

// --- Imperative singleton root --------------------------------
let _hostInstance = null
function setHost(inst) { _hostInstance = inst }

export function DialogHost() {
  const [items, setItems] = useState([])  // stack — supports nested dialogs
  useEffect(() => {
    setHost({
      push: cfg => new Promise(resolve => {
        const id = Math.random().toString(36).slice(2)
        setItems(s => [...s, { id, cfg, resolve }])
      }),
    })
    return () => setHost(null)
  }, [])

  const close = (id, value) => {
    setItems(s => {
      const item = s.find(x => x.id === id)
      if (item) item.resolve(value)
      return s.filter(x => x.id !== id)
    })
  }

  return (
    <>
      {items.map(({ id, cfg }) => (
        <ImperativeDialog key={id} cfg={cfg} onResolve={v => close(id, v)} />
      ))}
    </>
  )
}

function ImperativeDialog({ cfg, onResolve }) {
  const { kind, title, body, confirmLabel, dismissLabel, submitLabel, placeholder, tone, defaultValue } = cfg
  const [value, setValue] = useState(defaultValue ?? '')
  const inputRef = useRef(null)
  useEffect(() => { if (kind === 'prompt' && inputRef.current) inputRef.current.focus() }, [kind])

  if (kind === 'alert') {
    return (
      <Dialog open onClose={() => onResolve(true)} title={title}>
        {body && <DialogBody>{body}</DialogBody>}
        <DialogFooter>
          <button className="btn btn-primary" onClick={() => onResolve(true)} autoFocus>
            {confirmLabel || 'OK'}
          </button>
        </DialogFooter>
      </Dialog>
    )
  }

  if (kind === 'confirm') {
    const confirmCls = tone === 'danger' ? 'btn btn-danger' : 'btn btn-primary'
    return (
      <Dialog open onClose={() => onResolve(false)} title={title}>
        {body && <DialogBody>{body}</DialogBody>}
        <DialogFooter>
          <button className="btn btn-ghost" onClick={() => onResolve(false)}>
            {dismissLabel || 'Cancel'}
          </button>
          <button className={confirmCls} onClick={() => onResolve(true)} autoFocus>
            {confirmLabel || 'Confirm'}
          </button>
        </DialogFooter>
      </Dialog>
    )
  }

  // prompt
  return (
    <Dialog open onClose={() => onResolve(null)} title={title}>
      {body && <DialogBody>{body}</DialogBody>}
      <DialogBody>
        <textarea
          ref={inputRef}
          className="dialog-textarea"
          rows={3}
          placeholder={placeholder || ''}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onResolve(value) }}
        />
      </DialogBody>
      <DialogFooter>
        <button className="btn btn-ghost" onClick={() => onResolve('')}>
          {dismissLabel || 'Skip'}
        </button>
        <button className="btn btn-primary" onClick={() => onResolve(value)}>
          {submitLabel || 'Submit'}
        </button>
      </DialogFooter>
    </Dialog>
  )
}

export function confirmDialog(opts)  { return _hostInstance ? _hostInstance.push({ kind: 'confirm', ...opts }) : Promise.resolve(window.confirm(opts.title || '')) }
export function alertDialog(opts)    { return _hostInstance ? _hostInstance.push({ kind: 'alert',   ...opts }) : Promise.resolve(window.alert(opts.title || '')) }
export function promptDialog(opts)   { return _hostInstance ? _hostInstance.push({ kind: 'prompt',  ...opts }) : Promise.resolve(window.prompt(opts.title || '', opts.defaultValue || '')) }


// --- Declarative Dialog ---------------------------------------
export function Dialog({ open, onClose, title, children, width }) {
  // Esc to close
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="dialog-overlay" onClick={e => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className="dialog" style={width ? { maxWidth: width } : undefined}>
        {title && (
          <div className="dialog-header">
            <div className="dialog-title">{title}</div>
            <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close">
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export function DialogBody({ children, style }) {
  return <div className="dialog-body" style={style}>{children}</div>
}

export function DialogFooter({ children }) {
  return <div className="dialog-footer">{children}</div>
}
