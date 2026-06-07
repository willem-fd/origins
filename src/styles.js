export const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

  :root {
    --green:        #536350;
    --green-dark:   #3d4a39;
    --green-deep:   #1e2b1c;
    --green-mid:    #647a61;
    --green-light:  #EAF0EF;
    --green-pale:   #F2F6F5;
    --brown:        #996633;
    --brown-light:  #b07a3d;
    --brown-pale:   #f5ede0;
    --brown-dark:   #7a5228;
    --surface:      #FAFAF8;
    --surface-2:    #F4F3EF;
    --surface-3:    #ECEAE4;
    --text-1:       #1C2523;
    --text-2:       #4A5652;
    --text-3:       #8A9590;
    --border:       rgba(60,76,73,0.10);
    --border-md:    rgba(60,76,73,0.18);
    --radius:       12px;
    --radius-sm:    7px;
    --mono:         'DM Mono', monospace;
    --font:         'DM Sans', sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--font); background: var(--surface-2); color: var(--text-1); }
  input, select, textarea, button { font-family: var(--font); }

  .app { display: flex; height: 100vh; height: 100dvh; overflow: hidden; }

  /* SIDEBAR */
  .sidebar {
    width: 228px; min-width: 228px; background: var(--green-deep);
    display: flex; flex-direction: column;
  }
  .sidebar-logo {
    padding: 22px 18px 18px;
    border-bottom: 0.5px solid rgba(255,255,255,0.07);
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .sidebar-logo:hover { opacity: 0.8; }
  .sidebar-nav { flex: 1; padding: 14px 0; overflow-y: auto; }
  .nav-section { margin-bottom: 18px; }
  .nav-label {
    font-size: 9.5px; font-weight: 600; letter-spacing: 0.13em;
    color: rgba(255,255,255,0.18); text-transform: uppercase;
    padding: 0 16px 5px;
  }
  .nav-item {
    display: flex; align-items: center; gap: 9px;
    padding: 8px 16px; font-size: 13px; color: rgba(255,255,255,0.42);
    cursor: pointer; position: relative; transition: all 0.12s;
  }
  .nav-item:hover { color: rgba(255,255,255,0.72); background: rgba(255,255,255,0.04); }
  .nav-item.active { color: var(--brown-light); background: rgba(186,152,112,0.12); }
  .nav-item.active::before {
    content: ''; position: absolute; left: 0; top: 5px; bottom: 5px;
    width: 3px; background: var(--brown); border-radius: 0 2px 2px 0;
  }
  .nav-item i { font-size: 16px; flex-shrink: 0; }
  .nav-badge {
    margin-left: auto; font-size: 10.5px; font-weight: 500;
    background: rgba(186,152,112,0.2); color: var(--brown-light);
    padding: 1px 7px; border-radius: 10px;
  }
  .sidebar-footer { padding: 14px 16px; border-top: 0.5px solid rgba(255,255,255,0.07); }
  .user-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border-radius: var(--radius-sm); cursor: pointer;
    transition: background 0.12s;
  }
  .user-row:hover { background: rgba(255,255,255,0.05); }
  .avatar {
    width: 30px; height: 30px; border-radius: 50%;
    background: var(--brown-dark); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 600; flex-shrink: 0;
  }
  .user-name { font-size: 12.5px; color: rgba(255,255,255,0.62); font-weight: 500; }
  .user-role { font-size: 10.5px; color: rgba(255,255,255,0.25); }

  /* MAIN */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; min-height: 0; }
  .topbar {
    height: 56px; display: flex; align-items: center;
    padding: 0 28px; gap: 12px; flex-shrink: 0;
    background: var(--surface); border-bottom: 0.5px solid var(--border);
  }
  .topbar-title { font-size: 15px; font-weight: 500; color: var(--text-1); flex: 1; }
  .topbar-sub { font-size: 13px; color: var(--text-3); margin-left: 8px; font-weight: 400; }
  .page { flex: 1; min-height: 0; overflow-y: auto; padding: 24px 28px 40px; display: block; -webkit-overflow-scrolling: touch; }
  .page > * { margin-bottom: 18px; }
  .page > *:last-child { margin-bottom: 0; }

  /* BUTTONS */
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: var(--radius-sm);
    font-size: 13px; font-weight: 500; cursor: pointer;
    border: none; transition: all 0.12s; white-space: nowrap;
  }
  .btn i { font-size: 15px; }
  .btn-primary { background: var(--green); color: #fff; }
  .btn-primary:hover { background: var(--green-mid); }
  .btn-brown { background: var(--brown); color: #fff; }
  .btn-brown:hover { background: var(--brown-light); }
  .btn-ghost { background: transparent; color: var(--text-2); border: 0.5px solid var(--border-md); }
  .btn-ghost:hover { background: var(--surface-2); }
  .btn-danger { background: #fef2f2; color: #b91c1c; border: 0.5px solid #fecaca; }
  .btn-danger:hover { background: #fee2e2; }
  .btn-sm { padding: 5px 10px; font-size: 12px; }
  .btn-xs { padding: 3px 8px; font-size: 11px; }
  .btn-icon {
    width: 30px; height: 30px; border-radius: var(--radius-sm);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; border: none; background: transparent;
    color: var(--text-3); transition: all 0.12s;
  }
  .btn-icon:hover { background: var(--surface-3); color: var(--text-1); }
  .btn-icon i { font-size: 16px; }

  /* CARDS */
  .card { background: var(--surface); border: 0.5px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .card-header {
    display: flex; align-items: center; padding: 14px 20px;
    border-bottom: 0.5px solid var(--border); gap: 10px; flex-shrink: 0;
  }
  .card-title { font-size: 13.5px; font-weight: 500; color: var(--text-1); flex: 1; }

  /* KPI */
  .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
  .kpi-card { background: var(--surface); border: 0.5px solid var(--border); border-radius: var(--radius); padding: 20px 22px; }
  .kpi-label { font-size: 11.5px; color: var(--text-3); font-weight: 500; margin-bottom: 10px; }
  .kpi-value { font-size: 28px; font-weight: 400; color: var(--text-1); line-height: 1; }
  .kpi-value.brown { color: var(--brown); }

  /* TABLE */
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th {
    text-align: left; padding: 10px 18px;
    font-size: 11px; font-weight: 600; color: var(--text-3);
    letter-spacing: 0.04em; border-bottom: 0.5px solid var(--border);
    background: var(--surface-2); white-space: nowrap;
  }
  tbody tr { transition: background 0.1s; cursor: pointer; }
  tbody tr:hover { background: var(--green-pale); }
  tbody tr:not(:last-child) td { border-bottom: 0.5px solid var(--border); }
  tbody td { padding: 12px 18px; vertical-align: middle; color: var(--text-1); }
  .td-muted { color: var(--text-3); font-size: 12.5px; }
  .td-mono { font-family: var(--mono); font-size: 12px; color: var(--text-2); }
  .td-brown { font-family: var(--mono); font-size: 12px; color: var(--brown-dark); font-weight: 500; }

  /* BADGES */
  .badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 20px; font-size: 11.5px; font-weight: 500; }
  .badge-draft     { background: var(--surface-3); color: var(--text-2); }
  .badge-active    { background: #EAF2EE; color: #1A6640; }
  .badge-dropped   { background: #FEF3E8; color: #7A4A10; }
  .badge-transit   { background: #EAF0FA; color: #1E4080; }
  .badge-departed  { background: #F0E8FA; color: #5B21B6; }
  .badge-arrived   { background: #EAF2EE; color: #1A6640; }
  .badge-completed { background: var(--surface-3); color: var(--text-2); }
  .badge-pending   { background: var(--surface-3); color: var(--text-2); }
  .badge-confirmed { background: #EAF2EE; color: #1A6640; }
  .badge-partial   { background: #FEF3E8; color: #7A4A10; }
  .badge-counter   { background: #EAF0FA; color: #1E4080; }
  .badge-rejected  { background: #FEF2F2; color: #8B1C1C; }

  /* FORMS */
  .form-row { display: flex; gap: 14px; flex-wrap: wrap; }
  .form-group { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 140px; }
  .form-label { font-size: 11.5px; font-weight: 500; color: var(--text-2); }
  .form-input {
    padding: 9px 12px; border-radius: var(--radius-sm);
    border: 0.5px solid var(--border-md); font-size: 13px;
    color: var(--text-1); background: var(--surface); outline: none;
    transition: border-color 0.12s; width: 100%;
  }
  .form-input:focus { border-color: var(--green-mid); box-shadow: 0 0 0 3px rgba(73,98,93,0.08); }
  .form-input.error { border-color: #f87171; }
  .form-select {
    padding: 9px 12px; border-radius: var(--radius-sm);
    border: 0.5px solid var(--border-md); font-size: 13px;
    color: var(--text-1); background: var(--surface); outline: none;
    cursor: pointer; width: 100%; appearance: none;
  }
  .form-select:focus { border-color: var(--green-mid); }
  .form-textarea {
    padding: 9px 12px; border-radius: var(--radius-sm);
    border: 0.5px solid var(--border-md); font-size: 13px;
    color: var(--text-1); background: var(--surface); outline: none;
    resize: vertical; min-height: 72px; width: 100%;
  }
  .meta-notes-input {
    width: 100%; border: none; background: transparent; outline: none;
    font-family: var(--font); font-size: 13px; color: var(--text-1);
    resize: none; min-height: 36px; line-height: 1.5; padding: 0;
  }
  .meta-notes-input::placeholder { color: var(--text-3); }
  .meta-notes-input:focus { color: var(--text-1); }

  /* MODAL */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(28,37,35,0.5);
    display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px;
  }
  .modal {
    background: var(--surface); border-radius: var(--radius);
    border: 0.5px solid var(--border); width: 100%; max-width: 600px;
    max-height: 90vh; overflow-y: auto;
    box-shadow: 0 24px 80px rgba(28,37,35,0.22);
  }
  .modal-lg { max-width: 860px; }
  .modal-header {
    display: flex; align-items: center; padding: 20px 24px 16px;
    border-bottom: 0.5px solid var(--border); gap: 10px; position: sticky; top: 0;
    background: var(--surface); z-index: 1;
  }
  .modal-title { font-size: 15px; font-weight: 500; color: var(--text-1); flex: 1; }
  .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
  .modal-footer {
    padding: 16px 24px; border-top: 0.5px solid var(--border);
    display: flex; justify-content: flex-end; gap: 10px;
    position: sticky; bottom: 0; background: var(--surface);
  }

  /* TOTALS BAR */
  .totals-bar {
    background: var(--green-deep); border-radius: var(--radius);
    padding: 14px 24px; display: flex; align-items: center;
  }
  .total-item { flex: 1; text-align: center; }
  .total-item:not(:last-child) { border-right: 0.5px solid rgba(255,255,255,0.08); }
  .total-label { font-size: 10px; color: rgba(255,255,255,0.35); margin-bottom: 4px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
  .total-val { font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.82); font-family: var(--mono); }
  .total-val.hi { color: var(--brown-light); }

  /* EMPTY */
  .empty { display: flex; flex-direction: column; align-items: center; padding: 56px 20px; color: var(--text-3); gap: 10px; text-align: center; }
  .empty i { font-size: 36px; opacity: 0.35; }
  .empty-title { font-size: 14px; font-weight: 500; color: var(--text-2); }
  .empty-sub { font-size: 13px; }

  /* AUTH (login · forgot · reset) */
  .auth-shell {
    position: relative; min-height: 100vh; min-height: 100dvh;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 32px 20px;
    background: radial-gradient(125% 90% at 70% 110%, #2a3b27 0%, #1b261a 55%, #131c12 100%);
    overflow: hidden; color: var(--text-1);
  }
  .auth-bg { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .auth-bg-orb {
    position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.55;
    animation: auth-orb 22s ease-in-out infinite alternate;
  }
  .auth-bg-orb-a {
    width: 540px; height: 540px; left: -120px; top: -160px;
    background: radial-gradient(circle, #4a6044 0%, transparent 70%);
  }
  .auth-bg-orb-b {
    width: 620px; height: 620px; right: -180px; bottom: -200px;
    background: radial-gradient(circle, #7a5a36 0%, transparent 70%);
    animation-delay: -8s; opacity: 0.35;
  }
  @keyframes auth-orb {
    0%   { transform: translate3d(0,0,0) scale(1); }
    100% { transform: translate3d(40px,-30px,0) scale(1.08); }
  }
  .auth-bg-grain {
    position: absolute; inset: -50%; opacity: 0.04; pointer-events: none;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
    mix-blend-mode: overlay;
  }

  .auth-card {
    position: relative; z-index: 1;
    background: var(--surface);
    border-radius: 20px;
    padding: 40px 38px 32px;
    width: 100%; max-width: 420px;
    box-shadow:
      0 1px 0 rgba(255,255,255,0.4) inset,
      0 30px 80px -20px rgba(0,0,0,0.55),
      0 10px 30px -10px rgba(0,0,0,0.35);
    animation: auth-card-in 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) both;
  }
  @keyframes auth-card-in {
    from { opacity: 0; transform: translateY(14px) scale(0.985); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .auth-brand { text-align: center; margin-bottom: 28px; }
  .auth-logo { width: 158px; height: auto; display: inline-block; }
  .auth-tagline { font-size: 12.5px; color: var(--text-3); margin-top: 8px; letter-spacing: 0.01em; font-style: italic; }

  .auth-title { font-size: 22px; font-weight: 400; color: var(--text-1); letter-spacing: -0.005em; margin-bottom: 6px; }
  .auth-sub   { font-size: 13.5px; color: var(--text-3); line-height: 1.5; margin-bottom: 22px; }

  .auth-form { display: flex; flex-direction: column; }
  .auth-form > * + * { margin-top: 14px; }

  .auth-field { display: block; }
  .auth-field-label {
    display: block; font-size: 11.5px; font-weight: 600; color: var(--text-2);
    text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 7px;
  }
  .auth-field-wrap {
    position: relative; display: flex; align-items: center;
    border-radius: 10px;
    background: var(--surface-2);
    border: 0.5px solid var(--border-md);
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  }
  .auth-field-wrap:focus-within {
    background: var(--surface);
    border-color: var(--green-mid);
    box-shadow: 0 0 0 3px rgba(83,99,80,0.16);
  }
  .auth-input {
    flex: 1; background: transparent; border: none; outline: none;
    padding: 12px 14px; font-size: 14.5px; color: var(--text-1);
    font-family: var(--font);
  }
  .auth-input::placeholder { color: var(--text-3); opacity: 0.7; }
  .auth-eye {
    background: transparent; border: none; padding: 8px 12px;
    color: var(--text-3); cursor: pointer; display: flex;
    transition: color 0.15s;
  }
  .auth-eye:hover { color: var(--green); }

  .auth-row-between {
    display: flex; justify-content: flex-end; margin-top: 4px; margin-bottom: 4px;
  }
  .auth-link {
    background: none; border: none; padding: 0; font: inherit; cursor: pointer;
    color: var(--green-mid); font-size: 13px; text-decoration: none;
    transition: color 0.15s;
  }
  .auth-link:hover { color: var(--green-dark); text-decoration: underline; }
  .auth-link-center { text-align: center; margin-top: 14px; }

  .auth-submit {
    margin-top: 10px;
    background: var(--green-dark);
    color: #fff;
    border: none; border-radius: 10px;
    padding: 12px 16px; font-size: 14.5px; font-weight: 500; font-family: var(--font);
    cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 10px;
    transition: background 0.15s, transform 0.05s;
    box-shadow: 0 1px 0 rgba(255,255,255,0.08) inset, 0 6px 18px -6px rgba(30,43,28,0.45);
  }
  .auth-submit:hover:not(:disabled) { background: var(--green); }
  .auth-submit:active:not(:disabled) { transform: translateY(1px); }
  .auth-submit:disabled { opacity: 0.55; cursor: not-allowed; }
  .auth-submit-ghost {
    background: transparent; color: var(--text-2);
    border: 0.5px solid var(--border-md);
    box-shadow: none;
  }
  .auth-submit-ghost:hover:not(:disabled) { background: var(--surface-2); color: var(--text-1); }

  .auth-spinner {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
    animation: auth-spin 0.7s linear infinite;
  }
  @keyframes auth-spin { to { transform: rotate(360deg); } }

  .auth-alert {
    background: #fdf2ef;
    color: #8a3a1c;
    border: 0.5px solid #f4d3c2;
    padding: 10px 14px; border-radius: 9px;
    font-size: 13px; line-height: 1.45;
    animation: auth-alert-in 0.25s ease both;
  }
  @keyframes auth-alert-in {
    from { opacity: 0; transform: translateY(-4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .auth-hint { font-size: 12.5px; color: var(--text-3); margin-top: -8px; padding-left: 2px; }
  .auth-hint-warn { color: #a05a2a; }

  .auth-strength {
    display: flex; align-items: center; gap: 10px;
    margin-top: -8px;
  }
  .auth-strength-bars { display: flex; gap: 4px; flex: 1; }
  .auth-strength-bar {
    flex: 1; height: 4px; border-radius: 2px;
    background: var(--surface-3);
    transition: background 0.2s;
  }
  .auth-strength-bar.on.s-1 { background: #c97a4a; }
  .auth-strength-bar.on.s-2 { background: #c9a04a; }
  .auth-strength-bar.on.s-3 { background: #7e9b56; }
  .auth-strength-bar.on.s-4 { background: var(--green); }
  .auth-strength-label {
    font-size: 11.5px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--text-3); min-width: 64px; text-align: right;
  }
  .auth-strength-label.s-1 { color: #c97a4a; }
  .auth-strength-label.s-2 { color: #b08a3c; }
  .auth-strength-label.s-3 { color: #5d7a43; }
  .auth-strength-label.s-4 { color: var(--green-dark); }

  .auth-tick { color: var(--green); display: flex; justify-content: center; }

  .auth-foot {
    position: relative; z-index: 1;
    margin-top: 24px; font-size: 11.5px; color: rgba(255,255,255,0.45);
    letter-spacing: 0.04em;
  }

  /* MISC */
  .flag { font-size: 15px; }
  .route-cell { display: flex; align-items: center; gap: 5px; }
  .arrow { font-size: 11px; color: var(--text-3); }
  .search-input {
    padding: 7px 12px; border-radius: var(--radius-sm);
    border: 0.5px solid var(--border-md); font-size: 13px;
    background: var(--surface-2); outline: none; width: 220px; color: var(--text-1);
  }
  .search-input:focus { background: var(--surface); border-color: var(--green-mid); }
  .tabs { display: flex; border-bottom: 0.5px solid var(--border); }
  .tab { padding: 10px 18px; font-size: 13px; color: var(--text-3); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -0.5px; transition: all 0.12s; }
  .tab:hover { color: var(--text-2); }
  .tab.active { color: var(--green); border-bottom-color: var(--green); font-weight: 500; }
  .tab-count { display: inline-block; margin-left: 6px; font-size: 11px; background: var(--surface-3); color: var(--text-2); padding: 1px 6px; border-radius: 10px; }
  .tab.active .tab-count { background: var(--green-light); color: var(--green-dark); }

  /* SHIPMENT META */
  .meta-grid { display: grid; grid-template-columns: repeat(3,1fr); border: 0.5px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .meta-item { padding: 14px 18px; border-right: 0.5px solid var(--border); border-bottom: 0.5px solid var(--border); }
  .meta-item:nth-child(3n) { border-right: none; }
  .meta-label { font-size: 10.5px; color: var(--text-3); font-weight: 600; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.04em; }
  .meta-value { font-size: 14px; color: var(--text-1); }
  .meta-value.mono { font-family: var(--mono); font-size: 13px; }

  /* PO EDITOR */
  .po-editor { display: flex; flex-direction: column; border: 0.5px solid var(--border); border-radius: var(--radius); background: var(--surface); }
  .po-editor-toolbar { display: flex; align-items: center; padding: 12px 16px; border-bottom: 0.5px solid var(--border); gap: 10px; background: var(--surface); }
  .grower-block { border-bottom: 0.5px solid var(--border); }
  .grower-block:last-child { border-bottom: none; }
  .grower-header { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: var(--green-deep); cursor: pointer; user-select: none; }
  .grower-header-name { font-size: 13px; font-weight: 500; color: #E8DDD0; flex: 1; }
  .grower-header-stats { font-size: 11.5px; color: rgba(255,255,255,0.35); font-family: var(--mono); display: flex; gap: 14px; }
  .grower-collapse-btn { background: transparent; border: none; padding: 4px 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; border-radius: 4px; transition: background 0.15s ease; }
  .grower-collapse-btn:hover { background: rgba(255,255,255,0.08); }
  .box-block { border-bottom: 0.5px solid var(--border); }
  .box-block:last-child { border-bottom: none; }
  .box-header { display: flex; align-items: center; background: var(--surface-2); border-bottom: 0.5px solid var(--border); font-size: 12px; }
  .box-drag-handle { padding: 8px 6px 8px 14px; color: var(--text-3); cursor: grab; font-size: 15px; }
  .box-number { padding: 8px 10px 8px 4px; font-size: 11.5px; font-weight: 600; color: var(--text-3); font-family: var(--mono); white-space: nowrap; }
  .box-mark-input { padding: 6px 10px; font-size: 12px; font-weight: 500; border: none; background: transparent; outline: none; color: var(--brown-dark); font-family: var(--mono); text-transform: uppercase; width: 90px; border-left: 0.5px solid var(--border); border-right: 0.5px solid var(--border); }
  .box-mark-input:focus { background: var(--brown-pale); }
  .box-type-select { padding: 6px 8px; font-size: 11.5px; border: none; background: transparent; outline: none; cursor: pointer; color: var(--text-2); border-right: 0.5px solid var(--border); font-family: var(--mono); font-weight: 500; }
  .box-stems { padding: 8px 12px; font-size: 11.5px; color: var(--text-3); font-family: var(--mono); }
  .box-delete-btn { padding: 8px 12px; background: none; border: none; cursor: pointer; color: var(--text-3); font-size: 15px; margin-left: auto; }
  .box-delete-btn:hover { color: #b91c1c; }
  .product-rows { display: flex; flex-direction: column; }
  .product-row { display: flex; align-items: center; gap: 0; border-bottom: 0.5px solid var(--border); transition: background 0.1s; position: relative; }
  .product-row:last-child { border-bottom: none; }
  .product-row:hover { background: var(--green-pale); }
  .row-drag { padding: 0 6px 0 14px; color: var(--text-3); cursor: grab; font-size: 14px; opacity: 0; transition: opacity 0.1s; flex-shrink: 0; }
  .product-row:hover .row-drag { opacity: 1; }
  .row-num { width: 28px; text-align: center; font-size: 11px; color: var(--text-3); font-family: var(--mono); flex-shrink: 0; padding: 0 4px; }
  .cell { padding: 0; border-right: 0.5px solid var(--border); display: flex; align-items: center; position: relative; }
  .cell:last-child { border-right: none; }
  .cell-input { width: 100%; padding: 9px 10px; font-size: 12.5px; border: none; background: transparent; outline: none; color: var(--text-1); font-family: var(--font); }
  .cell-input::placeholder { color: rgba(0,0,0,0.18); font-weight: 400; }
  .cell-input:focus { background: #FFFEF8; box-shadow: inset 0 0 0 2px var(--brown); }
  .cell-input.mono { font-family: var(--mono); }
  .cell-select { width: 100%; padding: 9px 8px; font-size: 12.5px; border: none; background: transparent; outline: none; cursor: pointer; color: var(--text-1); appearance: none; }
  .status-dot { width: 10px; height: 10px; border-radius: 50%; cursor: pointer; flex-shrink: 0; transition: transform 0.1s; border: 1.5px solid rgba(0,0,0,0.12); }
  .status-dot:hover { transform: scale(1.3); }
  .status-pending   { background: #D1D5DB; }
  .status-confirmed { background: #34D399; }
  .status-partial   { background: #FBBF24; }
  .status-counter   { background: #60A5FA; }
  .status-rejected  { background: #F87171; }
  .status-popover { position: absolute; left: 50%; transform: translateX(-50%); top: calc(100% + 6px); background: var(--surface); border: 0.5px solid var(--border-md); border-radius: var(--radius-sm); padding: 6px; display: flex; gap: 6px; z-index: 50; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
  .status-option { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 8px; border-radius: 4px; cursor: pointer; transition: background 0.1s; font-size: 10px; color: var(--text-2); }
  .status-option:hover { background: var(--surface-2); }
  .status-option-dot { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid rgba(0,0,0,0.1); }
  .row-delete { padding: 0 10px; background: none; border: none; cursor: pointer; color: transparent; font-size: 14px; transition: color 0.1s; flex-shrink: 0; }
  .product-row:hover .row-delete { color: var(--text-3); }
  .row-delete:hover { color: #b91c1c !important; }
  .add-row-btn { display: flex; align-items: center; gap: 7px; padding: 7px 14px 7px 48px; font-size: 12px; color: var(--text-3); cursor: pointer; transition: all 0.12s; border: none; background: none; width: 100%; text-align: left; }
  .add-row-btn:hover { color: var(--brown); background: var(--brown-pale); }
  .add-box-btn { display: flex; align-items: center; gap: 7px; padding: 8px 16px 8px 36px; font-size: 12px; color: var(--text-3); cursor: pointer; border: none; background: none; width: 100%; text-align: left; transition: all 0.12s; border-top: 0.5px dashed var(--border); }
  .add-box-btn:hover { color: var(--green); background: var(--green-pale); }
  .add-grower-btn { display: flex; align-items: center; gap: 8px; padding: 12px 16px; font-size: 13px; color: var(--text-3); cursor: pointer; border: none; background: none; width: 100%; text-align: left; transition: all 0.12s; border-top: 0.5px dashed var(--border); }
  .add-grower-btn:hover { color: var(--green); background: var(--green-pale); }
  .order-type-badge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.04em; flex-shrink: 0; }
  .ot-so { background: var(--brown-pale); color: var(--brown-dark); }
  .ot-ro { background: var(--green-light); color: var(--green-dark); }
  .ot-om { background: var(--surface-3); color: var(--text-2); }

  /* PRODUCTS PAGE */
  .product-catalogue-filters { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .filter-chip { padding: 5px 12px; border-radius: 20px; font-size: 12px; border: 0.5px solid var(--border-md); cursor: pointer; background: var(--surface); color: var(--text-2); transition: all 0.12s; }
  .filter-chip:hover { background: var(--surface-2); }
  .filter-chip.active { background: var(--green); color: #fff; border-color: var(--green); }
  .add-product-row:hover { background: var(--green-pale); }
`
