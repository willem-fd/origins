export const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&family=DM+Mono:wght@400;500&display=swap');

  :root {
    /* ── Farm Direct Brand Palette ── */
    --gold-light:    #C9A96E;   /* Light 1  — warm highlight gold */
    --gold-mid:      #B8935A;   /* Light 2  — mid gold */
    --gold-dark:     #A0671E;   /* Dark 1   — deep amber */
    --gold-deep:     #8B5515;   /* Dark 2   — richest brown */

    --green-bright:  #3D5C47;   /* Bright 2 — mid forest green, primary action */
    --green-dark:    #2E3D2B;   /* Darkest 1 — sidebar base */
    --green-deep:    #253322;   /* Darkest 2 — sidebar deepest */

    --cream:         #F5F0E8;   /* Lightest 2 — warm page background */
    --white:         #FAFAF7;   /* Lightest 1 — card surfaces */

    /* ── App Tokens ── */
    --sidebar-bg:    #2E3D2B;
    --surface:       #FAFAF7;
    --surface-2:     #F5F0E8;
    --surface-3:     #EDE8DE;
    --text-1:        #1C2420;
    --text-2:        #4A5248;
    --text-3:        #8A9288;
    --border:        rgba(45,65,42,0.10);
    --border-md:     rgba(45,65,42,0.18);
    --radius:        12px;
    --radius-sm:     7px;
    --mono:          'DM Mono', monospace;
    --font:          'DM Sans', sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: var(--font); background: var(--surface-2); color: var(--text-1); }
  input, select, textarea, button { font-family: var(--font); }

  .app { display: flex; height: 100vh; overflow: hidden; }

  /* ── SIDEBAR ── */
  .sidebar {
    width: 228px; min-width: 228px;
    background: var(--sidebar-bg);
    display: flex; flex-direction: column;
  }
  .sidebar-logo {
    border-bottom: 1px solid rgba(255,255,255,0.07);
    transition: opacity 0.15s; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    padding: 22px 20px;
  }
  .sidebar-logo:hover { opacity: 0.75; }

  .sidebar-nav { flex: 1; padding: 14px 0; overflow-y: auto; }
  .nav-section { margin-bottom: 20px; }
  .nav-label {
    font-size: 9.5px; font-weight: 700; letter-spacing: 0.14em;
    color: rgba(255,255,255,0.30); text-transform: uppercase;
    padding: 0 16px 6px;
  }
  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 16px; font-size: 13.5px; font-weight: 400;
    color: rgba(255,255,255,0.55);
    cursor: pointer; position: relative; transition: all 0.12s;
  }
  .nav-item:hover {
    color: rgba(255,255,255,0.90);
    background: rgba(255,255,255,0.07);
  }
  .nav-item.active {
    color: var(--gold-light);
    background: rgba(201,169,110,0.13);
    font-weight: 500;
  }
  .nav-item.active::before {
    content: ''; position: absolute; left: 0; top: 6px; bottom: 6px;
    width: 3px; background: var(--gold-mid); border-radius: 0 3px 3px 0;
  }
  .nav-item i { font-size: 16px; flex-shrink: 0; }
  .nav-badge {
    margin-left: auto; font-size: 10.5px; font-weight: 600;
    background: rgba(201,169,110,0.22); color: var(--gold-light);
    padding: 1px 7px; border-radius: 10px;
  }
  .sidebar-footer {
    padding: 14px 16px;
    border-top: 1px solid rgba(255,255,255,0.07);
  }
  .user-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border-radius: var(--radius-sm); cursor: pointer;
    transition: background 0.12s;
  }
  .user-row:hover { background: rgba(255,255,255,0.07); }
  .avatar {
    width: 30px; height: 30px; border-radius: 50%;
    background: var(--gold-deep); color: var(--gold-light);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 700; flex-shrink: 0;
  }
  .user-name { font-size: 12.5px; color: rgba(255,255,255,0.78); font-weight: 500; }
  .user-role { font-size: 10.5px; color: rgba(255,255,255,0.32); margin-top: 1px; }

  /* ── MAIN ── */
  .main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; }
  .topbar {
    height: 56px; display: flex; align-items: center;
    padding: 0 28px; gap: 12px; flex-shrink: 0;
    background: var(--surface); border-bottom: 1px solid var(--border);
  }
  .topbar-title { font-size: 15px; font-weight: 500; color: var(--text-1); flex: 1; }
  .topbar-sub { font-size: 13px; color: var(--text-3); margin-left: 8px; font-weight: 400; }
  .page { flex: 1; overflow-y: auto; padding: 24px 28px; display: flex; flex-direction: column; gap: 18px; }

  /* ── BUTTONS ── */
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: var(--radius-sm);
    font-size: 13px; font-weight: 500; cursor: pointer;
    border: none; transition: all 0.12s; white-space: nowrap;
  }
  .btn i { font-size: 15px; }
  .btn-primary { background: var(--green-bright); color: #fff; }
  .btn-primary:hover { background: #4a6e55; }
  .btn-brown { background: var(--gold-dark); color: #fff; }
  .btn-brown:hover { background: var(--gold-mid); }
  .btn-ghost { background: transparent; color: var(--text-2); border: 1px solid var(--border-md); }
  .btn-ghost:hover { background: var(--surface-2); }
  .btn-danger { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
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

  /* ── CARDS ── */
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .card-header {
    display: flex; align-items: center; padding: 14px 20px;
    border-bottom: 1px solid var(--border); gap: 10px; flex-shrink: 0;
  }
  .card-title { font-size: 13.5px; font-weight: 500; color: var(--text-1); flex: 1; }

  /* ── KPI ── */
  .kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
  .kpi-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px 22px; }
  .kpi-label { font-size: 11.5px; color: var(--text-3); font-weight: 500; margin-bottom: 10px; }
  .kpi-value { font-size: 28px; font-weight: 400; color: var(--text-1); line-height: 1; }
  .kpi-value.gold { color: var(--gold-dark); }

  /* ── TABLE ── */
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  thead th {
    text-align: left; padding: 10px 18px;
    font-size: 11px; font-weight: 600; color: var(--text-3);
    letter-spacing: 0.04em; border-bottom: 1px solid var(--border);
    background: var(--surface-2); white-space: nowrap;
  }
  tbody tr { transition: background 0.1s; cursor: pointer; }
  tbody tr:hover { background: #f0ece3; }
  tbody tr:not(:last-child) td { border-bottom: 1px solid var(--border); }
  tbody td { padding: 12px 18px; vertical-align: middle; color: var(--text-1); }
  .td-muted { color: var(--text-3); font-size: 12.5px; }
  .td-mono { font-family: var(--mono); font-size: 12px; color: var(--text-2); }
  .td-brown { font-family: var(--mono); font-size: 12px; color: var(--gold-dark); font-weight: 500; }

  /* ── BADGES ── */
  .badge { display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 20px; font-size: 11.5px; font-weight: 500; }
  .badge-draft     { background: var(--surface-3); color: var(--text-2); }
  .badge-active    { background: #e4f0e6; color: #1a5c30; }
  .badge-dropped   { background: #fef3e8; color: #7a4a10; }
  .badge-transit   { background: #e8f0f8; color: #1e4080; }
  .badge-arrived   { background: #e4f0e6; color: #1a5c30; }
  .badge-completed { background: var(--surface-3); color: var(--text-2); }
  .badge-pending   { background: var(--surface-3); color: var(--text-2); }
  .badge-confirmed { background: #e4f0e6; color: #1a5c30; }
  .badge-partial   { background: #fef3e8; color: #7a4a10; }
  .badge-counter   { background: #e8f0f8; color: #1e4080; }
  .badge-rejected  { background: #fef2f2; color: #8b1c1c; }

  /* ── FORMS ── */
  .form-row { display: flex; gap: 14px; flex-wrap: wrap; }
  .form-group { display: flex; flex-direction: column; gap: 5px; flex: 1; min-width: 140px; }
  .form-label { font-size: 11.5px; font-weight: 500; color: var(--text-2); }
  .form-input {
    padding: 9px 12px; border-radius: var(--radius-sm);
    border: 1px solid var(--border-md); font-size: 13px;
    color: var(--text-1); background: var(--surface); outline: none;
    transition: border-color 0.12s; width: 100%;
  }
  .form-input:focus { border-color: var(--green-bright); box-shadow: 0 0 0 3px rgba(61,92,71,0.10); }
  .form-input.error { border-color: #f87171; }
  .form-select {
    padding: 9px 12px; border-radius: var(--radius-sm);
    border: 1px solid var(--border-md); font-size: 13px;
    color: var(--text-1); background: var(--surface); outline: none;
    cursor: pointer; width: 100%; appearance: none;
  }
  .form-select:focus { border-color: var(--green-bright); }
  .form-textarea {
    padding: 9px 12px; border-radius: var(--radius-sm);
    border: 1px solid var(--border-md); font-size: 13px;
    color: var(--text-1); background: var(--surface); outline: none;
    resize: vertical; min-height: 72px; width: 100%;
  }
  .form-error { font-size: 11px; color: #b91c1c; margin-top: 2px; }

  /* ── MODAL ── */
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(20,32,18,0.55);
    display: flex; align-items: center; justify-content: center; z-index: 200; padding: 20px;
  }
  .modal {
    background: var(--surface); border-radius: var(--radius);
    border: 1px solid var(--border); width: 100%; max-width: 600px;
    max-height: 90vh; overflow-y: auto;
    box-shadow: 0 24px 80px rgba(20,32,18,0.22);
  }
  .modal-lg { max-width: 860px; }
  .modal-header {
    display: flex; align-items: center; padding: 20px 24px 16px;
    border-bottom: 1px solid var(--border); gap: 10px; position: sticky; top: 0;
    background: var(--surface); z-index: 1;
  }
  .modal-title { font-size: 15px; font-weight: 500; color: var(--text-1); flex: 1; }
  .modal-body { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
  .modal-footer {
    padding: 16px 24px; border-top: 1px solid var(--border);
    display: flex; justify-content: flex-end; gap: 10px;
    position: sticky; bottom: 0; background: var(--surface);
  }

  /* ── TOTALS BAR ── */
  .totals-bar {
    background: var(--green-dark); border-radius: var(--radius);
    padding: 14px 24px; display: flex; align-items: center;
  }
  .total-item { flex: 1; text-align: center; }
  .total-item:not(:last-child) { border-right: 1px solid rgba(255,255,255,0.08); }
  .total-label { font-size: 10px; color: rgba(255,255,255,0.38); margin-bottom: 4px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; }
  .total-val { font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.85); font-family: var(--mono); }
  .total-val.hi { color: var(--gold-light); }

  /* ── EMPTY ── */
  .empty { display: flex; flex-direction: column; align-items: center; padding: 56px 20px; color: var(--text-3); gap: 10px; text-align: center; }
  .empty i { font-size: 36px; opacity: 0.35; }
  .empty-title { font-size: 14px; font-weight: 500; color: var(--text-2); }
  .empty-sub { font-size: 13px; }

  /* ── LOGIN ── */
  .login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--green-deep); padding: 20px; }
  .login-card {
    background: var(--surface); border-radius: 16px; padding: 44px 40px;
    width: 100%; max-width: 400px; box-shadow: 0 24px 80px rgba(0,0,0,0.3);
  }
  .login-logo { font-size: 28px; font-weight: 400; letter-spacing: 0.24em; color: var(--gold-dark); margin-bottom: 36px; }

  /* ── META GRID ── */
  .meta-grid { display: grid; grid-template-columns: repeat(3,1fr); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .meta-item { padding: 14px 18px; border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .meta-item:nth-child(3n) { border-right: none; }
  .meta-label { font-size: 10.5px; color: var(--text-3); font-weight: 600; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.04em; }
  .meta-value { font-size: 14px; color: var(--text-1); }
  .meta-value.mono { font-family: var(--mono); font-size: 13px; }

  /* ── PO EDITOR ── */
  .po-editor { display: flex; flex-direction: column; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; background: var(--surface); }
  .farm-block { border-bottom: 1px solid var(--border); }
  .farm-block:last-child { border-bottom: none; }
  .farm-header { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: var(--green-dark); cursor: pointer; user-select: none; }
  .farm-header-name { font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.90); flex: 1; }
  .farm-header-stats { font-size: 11.5px; color: rgba(255,255,255,0.38); font-family: var(--mono); display: flex; gap: 14px; }
  .box-block { border-bottom: 1px solid var(--border); }
  .box-block:last-child { border-bottom: none; }
  .box-header { display: flex; align-items: center; background: var(--surface-2); border-bottom: 1px solid var(--border); font-size: 12px; }
  .box-drag-handle { padding: 8px 6px 8px 14px; color: var(--text-3); cursor: grab; font-size: 15px; }
  .box-number { padding: 8px 10px 8px 4px; font-size: 11.5px; font-weight: 600; color: var(--text-3); font-family: var(--mono); white-space: nowrap; }
  .box-mark-input { padding: 6px 10px; font-size: 12px; font-weight: 500; border: none; background: transparent; outline: none; color: var(--gold-dark); font-family: var(--mono); text-transform: uppercase; width: 90px; border-left: 1px solid var(--border); border-right: 1px solid var(--border); }
  .box-mark-input:focus { background: #f5ede0; }
  .box-type-select { padding: 6px 8px; font-size: 11.5px; border: none; background: transparent; outline: none; cursor: pointer; color: var(--text-2); border-right: 1px solid var(--border); font-family: var(--mono); font-weight: 500; }
  .box-stems { padding: 8px 12px; font-size: 11.5px; color: var(--text-3); font-family: var(--mono); margin-left: auto; }
  .box-delete-btn { padding: 8px 12px; background: none; border: none; cursor: pointer; color: var(--text-3); font-size: 15px; }
  .box-delete-btn:hover { color: #b91c1c; }
  .product-rows { display: flex; flex-direction: column; }
  .product-row { display: flex; align-items: center; gap: 0; border-bottom: 1px solid var(--border); transition: background 0.1s; position: relative; }
  .product-row:last-child { border-bottom: none; }
  .product-row:hover { background: #f0ece3; }
  .row-drag { padding: 0 6px 0 14px; color: var(--text-3); cursor: grab; font-size: 14px; opacity: 0; transition: opacity 0.1s; flex-shrink: 0; }
  .product-row:hover .row-drag { opacity: 1; }
  .row-num { width: 28px; text-align: center; font-size: 11px; color: var(--text-3); font-family: var(--mono); flex-shrink: 0; padding: 0 4px; }
  .cell { padding: 0; border-right: 1px solid var(--border); display: flex; align-items: center; position: relative; }
  .cell:last-child { border-right: none; }
  .cell-input { width: 100%; padding: 9px 10px; font-size: 12.5px; border: none; background: transparent; outline: none; color: var(--text-1); font-family: var(--font); }
  .cell-input:focus { background: #fffdf8; box-shadow: inset 0 0 0 2px var(--gold-mid); }
  .cell-input.mono { font-family: var(--mono); }
  .cell-select { width: 100%; padding: 9px 8px; font-size: 12.5px; border: none; background: transparent; outline: none; cursor: pointer; color: var(--text-1); appearance: none; }
  .status-dot { width: 10px; height: 10px; border-radius: 50%; cursor: pointer; flex-shrink: 0; transition: transform 0.1s; border: 1.5px solid rgba(0,0,0,0.12); }
  .status-dot:hover { transform: scale(1.3); }
  .status-pending   { background: #D1D5DB; }
  .status-confirmed { background: #34D399; }
  .status-partial   { background: #FBBF24; }
  .status-counter   { background: #60A5FA; }
  .status-rejected  { background: #F87171; }
  .status-popover { position: absolute; left: 50%; transform: translateX(-50%); top: calc(100% + 6px); background: var(--surface); border: 1px solid var(--border-md); border-radius: var(--radius-sm); padding: 6px; display: flex; gap: 6px; z-index: 50; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
  .status-option { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 8px; border-radius: 4px; cursor: pointer; transition: background 0.1s; font-size: 10px; color: var(--text-2); }
  .status-option:hover { background: var(--surface-2); }
  .status-option-dot { width: 12px; height: 12px; border-radius: 50%; border: 1.5px solid rgba(0,0,0,0.1); }
  .row-delete { padding: 0 10px; background: none; border: none; cursor: pointer; color: transparent; font-size: 14px; transition: color 0.1s; flex-shrink: 0; }
  .product-row:hover .row-delete { color: var(--text-3); }
  .row-delete:hover { color: #b91c1c !important; }
  .add-row-btn { display: flex; align-items: center; gap: 7px; padding: 7px 14px 7px 48px; font-size: 12px; color: var(--text-3); cursor: pointer; transition: all 0.12s; border: none; background: none; width: 100%; text-align: left; }
  .add-row-btn:hover { color: var(--gold-dark); background: #f5ede0; }
  .add-box-btn { display: flex; align-items: center; gap: 7px; padding: 8px 16px 8px 36px; font-size: 12px; color: var(--text-3); cursor: pointer; border: none; background: none; width: 100%; text-align: left; transition: all 0.12s; border-top: 1px dashed var(--border); }
  .add-box-btn:hover { color: var(--green-bright); background: #edf3ef; }
  .add-farm-btn { display: flex; align-items: center; gap: 8px; padding: 12px 16px; font-size: 13px; color: var(--text-3); cursor: pointer; border: none; background: none; width: 100%; text-align: left; transition: all 0.12s; border-top: 1px dashed var(--border); }
  .add-farm-btn:hover { color: var(--green-bright); background: #edf3ef; }
  .order-type-badge { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.04em; flex-shrink: 0; }
  .ot-so { background: #f5ede0; color: var(--gold-deep); }
  .ot-ro { background: #edf3ef; color: #2a5c38; }
  .ot-om { background: var(--surface-3); color: var(--text-2); }

  /* ── PRODUCTS PAGE ── */
  .product-catalogue-filters { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .filter-chip { padding: 5px 12px; border-radius: 20px; font-size: 12px; border: 1px solid var(--border-md); cursor: pointer; background: var(--surface); color: var(--text-2); transition: all 0.12s; }
  .filter-chip:hover { background: var(--surface-2); }
  .filter-chip.active { background: var(--green-bright); color: #fff; border-color: var(--green-bright); }

  /* ── MISC ── */
  .flag { font-size: 15px; }
  .route-cell { display: flex; align-items: center; gap: 5px; }
  .arrow { font-size: 11px; color: var(--text-3); }
  .search-input {
    padding: 7px 12px; border-radius: var(--radius-sm);
    border: 1px solid var(--border-md); font-size: 13px;
    background: var(--surface-2); outline: none; width: 220px; color: var(--text-1);
  }
  .search-input:focus { background: var(--surface); border-color: var(--green-bright); }
  .tabs { display: flex; border-bottom: 1px solid var(--border); }
  .tab { padding: 10px 18px; font-size: 13px; color: var(--text-3); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.12s; }
  .tab:hover { color: var(--text-2); }
  .tab.active { color: var(--green-bright); border-bottom-color: var(--green-bright); font-weight: 500; }
  .tab-count { display: inline-block; margin-left: 6px; font-size: 11px; background: var(--surface-3); color: var(--text-2); padding: 1px 6px; border-radius: 10px; }
  .tab.active .tab-count { background: #edf3ef; color: var(--green-bright); }
`
