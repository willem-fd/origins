import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabase'

// ─────────────────────────────────────────────────────────────────────────────
// AUTH MODULE — login, forgot password, reset password
//
// One component handles three modes that share the same brand shell:
//   mode = 'login'    → email + password, with "Forgot password?" link
//   mode = 'forgot'   → request a reset email
//   mode = 'reset'    → set a new password (entered from the reset link)
//
// We detect "reset" mode automatically from the URL (?type=recovery).
// ─────────────────────────────────────────────────────────────────────────────

export default function Auth({ onLogin }) {
  // detect mode from URL hash/query — Supabase sends ?type=recovery in the link
  const initialMode = (() => {
    const hash = window.location.hash || ''
    const search = window.location.search || ''
    if (hash.includes('type=recovery') || search.includes('type=recovery')) return 'reset'
    return 'login'
  })()

  const [mode, setMode] = useState(initialMode)

  return (
    <div className="auth-shell">
      <div className="auth-bg" aria-hidden="true">
        <div className="auth-bg-orb auth-bg-orb-a" />
        <div className="auth-bg-orb auth-bg-orb-b" />
        <div className="auth-bg-grain" />
      </div>
      <div className="auth-card">
        <div className="auth-brand">
          <img src="/origins-logo.svg" alt="Origins" className="auth-logo" />
          <p className="auth-tagline">Buy at the source. Built for flowers.</p>
        </div>
        {mode === 'login'  && <LoginForm onLogin={onLogin} onForgot={() => setMode('forgot')} />}
        {mode === 'forgot' && <ForgotForm onBack={() => setMode('login')} />}
        {mode === 'reset'  && <ResetForm onDone={() => { window.history.replaceState({}, '', '/'); setMode('login') }} />}
      </div>
      <footer className="auth-foot">
        <span>© Origins · A platform for flower trade</span>
      </footer>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
function LoginForm({ onLogin, onForgot }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const emailRef = useRef(null)
  useEffect(() => { emailRef.current?.focus() }, [])

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw })
    setLoading(false)
    if (error) {
      // Friendly mapping; keep safe — never reveal whether the email exists
      const msg = /invalid login credentials/i.test(error.message)
        ? 'That email and password don\u2019t match. Try again or reset your password.'
        : /email not confirmed/i.test(error.message)
        ? 'Please confirm your email address first. Check your inbox for the link.'
        : error.message
      setErr(msg)
      return
    }
    onLogin(data.user)
  }

  return (
    <form onSubmit={submit} className="auth-form" noValidate>
      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-sub">Sign in to your Origins account</p>

      {err && <div className="auth-alert" role="alert">{err}</div>}

      <Field
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        placeholder="you@company.com"
        inputRef={emailRef}
        required
      />

      <Field
        label="Password"
        type={showPw ? 'text' : 'password'}
        value={pw}
        onChange={setPw}
        autoComplete="current-password"
        placeholder="••••••••"
        required
        trailing={
          <button type="button" className="auth-eye" onClick={() => setShowPw(s => !s)} tabIndex={-1} aria-label={showPw ? 'Hide password' : 'Show password'}>
            {showPw ? eyeOff : eyeOn}
          </button>
        }
      />

      <div className="auth-row-between">
        <button type="button" className="auth-link" onClick={onForgot}>Forgot password?</button>
      </div>

      <button type="submit" className="auth-submit" disabled={loading || !email || !pw}>
        {loading ? <span className="auth-spinner" /> : 'Sign in'}
      </button>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
function ForgotForm({ onBack }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')
  const emailRef = useRef(null)
  useEffect(() => { emailRef.current?.focus() }, [])

  const submit = async (e) => {
    e.preventDefault()
    setErr(''); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin
    })
    setLoading(false)
    // Always show the success state — never reveal whether the email exists in our system.
    if (error && !/rate limit/i.test(error.message)) {
      // Only surface true rate-limit errors; otherwise show success regardless.
    }
    if (error && /rate limit/i.test(error.message)) {
      setErr('Too many attempts just now. Please wait a moment and try again.')
      return
    }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="auth-form" aria-live="polite">
        <h1 className="auth-title">Check your inbox</h1>
        <p className="auth-sub">
          If an account exists for <b>{email}</b>, we just sent you a link to reset your password.
          The link will expire in 60 minutes.
        </p>
        <button type="button" className="auth-submit auth-submit-ghost" onClick={onBack}>Back to sign in</button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="auth-form" noValidate>
      <h1 className="auth-title">Reset your password</h1>
      <p className="auth-sub">Enter your email and we&rsquo;ll send you a link to set a new one.</p>

      {err && <div className="auth-alert" role="alert">{err}</div>}

      <Field
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        placeholder="you@company.com"
        inputRef={emailRef}
        required
      />

      <button type="submit" className="auth-submit" disabled={loading || !email}>
        {loading ? <span className="auth-spinner" /> : 'Send reset link'}
      </button>

      <button type="button" className="auth-link auth-link-center" onClick={onBack}>
        &larr; Back to sign in
      </button>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
function ResetForm({ onDone }) {
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  const strength = scorePassword(pw)
  const match = pw && pw === pw2
  const ok = pw.length >= 8 && match

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return }
    if (pw !== pw2) { setErr('The two passwords don\u2019t match.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setLoading(false)
    if (error) { setErr(error.message); return }
    setDone(true)
    // give the user a moment to see success, then drop back to login
    setTimeout(() => onDone(), 1800)
  }

  if (done) {
    return (
      <div className="auth-form" aria-live="polite">
        <div className="auth-tick">{tickIcon}</div>
        <h1 className="auth-title" style={{ marginTop: 14 }}>Password updated</h1>
        <p className="auth-sub">Redirecting you to sign in&hellip;</p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="auth-form" noValidate>
      <h1 className="auth-title">Set a new password</h1>
      <p className="auth-sub">Choose something memorable but strong.</p>

      {err && <div className="auth-alert" role="alert">{err}</div>}

      <Field
        label="New password"
        type={showPw ? 'text' : 'password'}
        value={pw}
        onChange={setPw}
        autoComplete="new-password"
        required
        trailing={
          <button type="button" className="auth-eye" onClick={() => setShowPw(s => !s)} tabIndex={-1} aria-label={showPw ? 'Hide password' : 'Show password'}>
            {showPw ? eyeOff : eyeOn}
          </button>
        }
      />
      {pw && <StrengthMeter strength={strength} />}

      <Field
        label="Confirm new password"
        type={showPw ? 'text' : 'password'}
        value={pw2}
        onChange={setPw2}
        autoComplete="new-password"
        required
      />
      {pw2 && !match && <div className="auth-hint auth-hint-warn">The passwords don&rsquo;t match yet.</div>}

      <button type="submit" className="auth-submit" disabled={loading || !ok}>
        {loading ? <span className="auth-spinner" /> : 'Update password'}
      </button>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Small building blocks

function Field({ label, type, value, onChange, autoComplete, placeholder, inputRef, required, trailing }) {
  return (
    <label className="auth-field">
      <span className="auth-field-label">{label}</span>
      <span className="auth-field-wrap">
        <input
          ref={inputRef}
          className="auth-input"
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
          spellCheck={false}
          autoCapitalize="none"
        />
        {trailing}
      </span>
    </label>
  )
}

function StrengthMeter({ strength }) {
  // strength is 0..4
  const labels = ['Weak', 'Okay', 'Good', 'Strong', 'Excellent']
  return (
    <div className="auth-strength">
      <div className="auth-strength-bars">
        {[0,1,2,3].map(i => (
          <span key={i} className={`auth-strength-bar ${i < strength ? 'on' : ''} s-${strength}`} />
        ))}
      </div>
      <span className={`auth-strength-label s-${strength}`}>{labels[strength]}</span>
    </div>
  )
}

function scorePassword(pw) {
  if (!pw) return 0
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++
  return Math.min(s, 4)
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline SVG icons (so no external dep)

const eyeOn = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>
  </svg>
)
const eyeOff = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a18.62 18.62 0 0 1 4.22-5.16M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a18.6 18.6 0 0 1-2.16 3.19"/><path d="M1 1l22 22"/><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
  </svg>
)
const tickIcon = (
  <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><path d="M8 12.5l3 3 5-6"/>
  </svg>
)
