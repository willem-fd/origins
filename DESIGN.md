# Origins — Design System

The single source of truth for how Origins looks and feels. Every new screen, component, popup, or button must stay inside this scheme. The live implementation lives in `src/styles.js` (a CSS string) plus inline styles; this document describes and names what's there. **If you change a token, change it in `src/styles.js` and update this file in the same commit.**

Last updated 2026-06-14.

---

## 1. Brand essence & principles

Origins is a calm, premium, operational tool for the flower trade. The feel is **warm and editorial, not techy**: forest green and brass on warm cream, generous whitespace, thin borders, flat surfaces.

Principles:
- **Flat.** No gradients (except the auth background), no drop shadows on in-page elements except functional ones (modals, popovers, the drawer). Depth comes from thin borders and surface tints, not shadow.
- **Warm neutrals.** Backgrounds are cream/off-white (`--surface` family), never pure white, never cool gray.
- **Two brand colors.** Forest green (structure, primary actions) and brass/brown (brand mark, accents, the "money/agreed" highlight). Everything else is neutral or a semantic status color.
- **Quiet by default, color for meaning.** Color signals state (confirmed, reply-required, cancelled). Neutral chrome everywhere else.
- **European number format.** `.` thousands, `,` decimals (`1.234,56`). Currency symbol prefixed (`$1.234,56`). Mono font for all numbers.
- **Sentence case** for labels and buttons. Uppercase only for the small tracked section labels (nav sections, field labels, KV labels).

---

## 2. Color tokens

All defined as CSS variables in `:root` (`src/styles.js`). Use the variable, never a raw hex, unless the value isn't tokenized (status colors below).

### Green family (structure, primary, brand)
| Token | Hex | Used for |
|---|---|---|
| `--green-deep` | `#1E2B1C` | Sidebar bg, grower-block header, totals bar |
| `--green-dark` | `#3D4A39` | Primary button bg (auth), strong text on light |
| `--green` | `#536350` | Primary button (`.btn-primary`), tab active, filter-chip active |
| `--green-mid` | `#647A61` | Hover states, input focus border |
| `--green-light` | `#EAF0EF` | Pale green fill (RO order-type badge, tab count) |
| `--green-pale` | `#F2F6F5` | Row hover tint |

### Brown / brass family (brand mark, accents, "agreed/money")
| Token | Hex | Used for |
|---|---|---|
| `--brown` | `#996633` | Brand wordmark, `.btn-brown`, active-nav rail |
| `--brown-light` | `#B07A3D` | Active nav text, brass highlight on totals |
| `--brown-dark` | `#7A5228` | Box mark text, mono brass cells, counter icon |
| `--brown-pale` | `#F5EDE0` | SO order-type badge, add-row hover, mark input focus |

Two un-tokenized brass values exist for emphasis — keep them consistent if reused:
- `#B4892A` — **changed-value highlight** in a counter thread (`.thread-item-fields .changed`).
- `#C9A96E` — **active-row ring** around the line whose drawer is open.

### Surfaces (warm neutrals)
| Token | Hex | Used for |
|---|---|---|
| `--surface` | `#FAFAF8` | Cards, drawer, modal, inputs |
| `--surface-2` | `#F4F3EF` | Page background, table header, thread items |
| `--surface-3` | `#ECEAE4` | Neutral badge fills, hover |

### Text
| Token | Hex | Used for |
|---|---|---|
| `--text-1` | `#1C2523` | Primary text |
| `--text-2` | `#4A5652` | Secondary text, labels |
| `--text-3` | `#8A9590` | Muted hints, placeholders, uppercase labels |

### Borders
| Token | Value | Used for |
|---|---|---|
| `--border` | `rgba(60,76,73,0.10)` | Default 0.5px hairline |
| `--border-md` | `rgba(60,76,73,0.18)` | Inputs, stronger separation |

### Semantic / status colors (not tokenized — use these exact values)
| Meaning | Bg | Text |
|---|---|---|
| Active / Confirmed / Arrived | `#EAF2EE` | `#1A6640` |
| Reply required / Attention / Partial | `#FEF3E2` | `#B45309` |
| Pending / Draft / Completed / Awaiting | `--surface-3` | `--text-2` / `--text-3` |
| Cancelled / Rejected | `#FDEBEB` / `#FEF2F2` | `#8B1818` / `#8B1C1C` |
| Counter / Transit | `#EAF0FA` | `#1E4080` |
| Departed | `#F0E8FA` | `#5B21B6` |
| Danger button | `#FEF2F2` bg, `#FECACA` border | `#B91C1C` |

Row tint for "needs your reply": `#FFF7ED` (`.reply-required`).

---

## 3. Typography

- **Sans:** `DM Sans` (`--font`) — all UI text. Weights 300/400/500 only. Never 600/700 for body; 600 is reserved for small uppercase labels and badge emphasis.
- **Mono:** `DM Mono` (`--mono`) — all numbers, codes, marks, KV values, totals, timestamps.
- Loaded via Google Fonts `@import` at the top of `src/styles.js`.

Scale (px):
| Use | Size / weight |
|---|---|
| Page / auth title | 22 / 400 |
| Section & modal title | 14–15 / 500–600 |
| Body / table cell | 13 / 400 |
| KPI number | 28 / 400 (mono feel) |
| Small label (uppercase) | 10.5–11.5 / 600, letter-spacing 0.04–0.13em |
| Badge | 11.5 / 500 |
| Tiny meta / timestamp | 10–11 / 400 mono |

Casing: **sentence case** everywhere except the tracked uppercase labels (nav sections, form labels, KV labels, drawer section titles).

---

## 4. Spacing, radius, motion

- **Radius:** `--radius` 12px (cards, modals, drawer sections' outer), `--radius-sm` 7px (buttons, inputs, chips). Badges/pills use 20px. Avatars/icon circles 50%.
- **Borders:** always `0.5px solid var(--border)` for hairlines; `--border-md` for inputs/emphasis. Never rounded corners on single-sided borders.
- **Page padding:** 24px top, 28px sides. Topbar height 56px. Sidebar width 228px. Drawer width 480px (max 92vw).
- **Motion:** fast and subtle. Transitions 0.12–0.15s. Drawer slides in `0.25s cubic-bezier(0.22,0.61,0.36,1)`, out `0.22s`. Dialog pops `0.18s`. Keep new animation in this range; no bounce, no long durations.

---

## 5. Buttons (`.btn` + variant)

| Class | Look | Use |
|---|---|---|
| `.btn-primary` | green bg, white text | Main action on a screen (New shipment, Close purchasing) |
| `.btn-brown` | brass bg, white text | Brand-accent action (rare; e.g. catalogue) |
| `.btn-ghost` | transparent, hairline border, text-2 | Secondary actions (Refresh, Save as template, Add grower) |
| `.btn-danger` | pale red bg + border | Destructive (delete, cancel line) |
| `.btn-icon` | 30×30 transparent, icon only | Toolbar icon actions |
| Sizes | `.btn-sm`, `.btn-xs` | Compact contexts |

Rule: **one primary button per view.** Everything else is ghost. Destructive actions are danger-styled and never the visual default.

---

## 6. Forms & inputs

- `.form-input`, `.form-select`, `.form-textarea`: cream bg, `--border-md` hairline, radius-sm, 13px. Focus = green-mid border + 3px soft green ring.
- Labels: `.form-label`, 11.5px / 500, text-2.
- In-grid editing (PO list) uses `.cell-input` / `.cell-select`: borderless, transparent, focus shows a brass inset ring (`inset 0 0 0 2px var(--brown)`) on a near-white `#FFFEF8`.
- Invalid input: `#FEF3E2` bg, `#B45309` text (`.cell-input.invalid`).
- Search: `.search-input`, 220px, surface-2 bg.

---

## 7. Badges (`.badge` + variant)

Pill, 20px radius, 11.5px / 500–600. Full set in `src/styles.js` lines ~160–175. Map state → variant; don't invent new badge colors. Most-used:
- `badge-active`, `badge-confirmed`, `badge-arrived` → green (#EAF2EE / #1A6640)
- `badge-attention`, `badge-partial` → amber (#FEF3E2 / #B45309) — "reply required"
- `badge-draft`, `badge-pending`, `badge-completed`, `badge-awaiting` → neutral
- `badge-cancelled`, `badge-rejected` → red
- `badge-counter`, `badge-transit` → blue; `badge-departed` → purple

Order-type chips (PO list): `.ot-so` brass-pale, `.ot-ro` green-light, `.ot-om` neutral.

---

## 8. Cards, KPIs, tables, totals

- **Card:** `.card` surface bg + hairline + radius-12, optional `.card-header`.
- **KPI:** `.kpi-grid` (4-up), `.kpi-card` with 11.5px muted label + 28px number. `.kpi-value.brown` for money.
- **Table:** uppercase 11px header on surface-2; 13px rows; hover = green-pale; mono helper classes `.td-mono`, `.td-brown`. Status shown as a badge in the last column.
- **Totals bar:** `.totals-bar` green-deep, mono white values, `.total-val.hi` brass for the headline number. Used at the foot of the PO list.

---

## 9. Overlays — three types, distinct jobs

Origins has exactly three overlay patterns. Pick by weight. **No native `window.confirm/alert/prompt` ever.**

### Dialog (`src/Dialog.jsx`, `.dialog`)
The Origins-native confirm/alert/prompt/small-form. Max 440px, centered, pops in. Use for: confirmations (Reopen, Close purchasing), reason prompts (cancel reason), short messages. This is the default for anything that would otherwise be a browser dialog.

### Modal (`.modal`)
Heavier, scrollable forms. Max 600px (`.modal-lg` 860px), sticky header/footer. Use for: multi-field create/edit forms (new shipment, invite).

### Drawer (`.drawer`)
Slides from the **right**, 480px, full height. Use for: the full detail + context + actions of **one record**, where it helps to keep the list visible behind it. Currently: the **PO line drawer** (see §10).

All three sit on a dim backdrop (`rgba(28,37,35,0.45)` for dialog/modal; `rgba(0,0,0,0.18)` for the drawer). Z-order: drawer backdrop 80 < active row 90 < drawer 100; modal 200; dialog 300.

---

## 10. The PO line drawer (key pattern)

The make-or-break surface. Opened from a PO line; gives full detail, negotiation state, history, and actions for that single line.

Current structure (`src/LineDrawer.jsx` + `.drawer*` styles):
- **Header** (`.drawer-header`): line title + close (×).
- **Active-row link:** the originating row gets a brass ring (`#C9A96E`) and lifts above the backdrop so the user keeps their place.
- **Sections** (`.drawer-section`, hairline-separated):
  - Detail KV grid (`.kv-grid`, 3-col): length, stems, st/bunch, price, order type, state — mono values.
  - Buyer note.
  - Status banner — one sentence on what's happening / whose move (green when agreed).
  - **Actions:** Confirm / Counter / Cancel / Reopen, contextual to state. Counter expands the 6-field `.counter-form` (12-col grid: type 3, variety 9, then length/stems/st-b/price 3 each).
  - **Thread** (`.thread`, newest first): each `.thread-item` = icon circle + who/action + timestamp + the relevant field values. Counter items highlight **changed** fields in brass (`#B4892A`).

The six negotiable line fields (the counter form): **order type, variety (product), length, stems, stems/bunch, price.** Box number / type / mark are fixed context, not negotiable.

> Redesign in progress (2026-06-14): proposal to re-rank the drawer as identity → whose-move → "deal on the table" (with was→now changes surfaced up top) → box context → actions → collapsible history. Decisions pending with Willem before implementation. Any redesign stays within the tokens above.

---

## 11. PO editor specifics

- **Grower block header** (`.grower-header`): green-deep bar, cream title (`#E8DDD0`), mono stats right.
- **Box header** (`.box-header`): surface-2 strip with drag handle, mono box number, brass mark input (uppercase), type select, stems.
- **Rows** (`.product-row`): 34px min, hover green-pale, drag handle + delete appear on hover. Reply-required rows tint `#FFF7ED`.
- **Status dots** (`.status-dot`): pending gray, confirmed `#34D399`, partial `#FBBF24`, counter `#60A5FA`, rejected `#F87171`.
- Add-line / add-box / add-grower are dashed-top ghost rows that tint on hover (brass for line, green for box/grower).

---

## 12. Auth screen

Distinct from the app shell: dark radial-green gradient background with blurred orbs + faint grain, a floating cream card (radius 20px, layered soft shadow). Brass `ORIGINS` wordmark, italic tagline. Primary submit is green-dark. This is the **only** place gradients/shadows are used heavily — keep the in-app experience flat.

---

## 13. Iconography & motion

- **Icons:** Tabler (`<i className="ti ti-name" />`), outline only, 15–16px inline. Decorative icons `aria-hidden`; icon-only buttons need a label.
- **Motion:** see §4. Subtle, fast, no bounce.

---

## 14. Do / don't

**Do:** use tokens; one primary button per view; mono for numbers; sentence case; thin borders for structure; semantic color only for state.

**Don't:** introduce new colors or fonts; use pure white or cool gray; add drop shadows to in-page elements; use ALL-CAPS outside small tracked labels; use a native browser dialog; mix a fourth overlay pattern; put non-negotiable fields into the counter form.
