CLAUDE.md
This is the working file Claude Code reads at the start of every session. It has three parts:

Project Instructions — the stable foundation. What Origins is, how to work on it. Rewrite only when an architectural decision changes.
Operating principles & lessons learned — durable rules from past mistakes. Add to as new lessons emerge.
Current state (last updated 2026-06-14) — what's shipped, what's pending, where to resume. This section gets rewritten as work progresses.

Claude Code should read all three sections before doing anything else.


1. Project Instructions
These instructions were last updated on June 1st, 2026.
1.1 Executive Summary
Origins is a standalone web application that runs the full purchasing, logistics, and financial-admin operation for wholesale flower buyers — importers and distributors who source flowers from growers in producing regions like Ecuador and Colombia and sell to wholesalers across Europe.

The platform replaces fragmented tools with a single, scalable workflow covering: shipment planning, purchase-order negotiation with growers, logistics coordination, document handling, invoices, and account reconciliation. Three account types share the platform — Buyer, Grower, Logistics — each with their own scoped view. Above them is a super-admin layer (currently Willem van Maasdijk) that operates the platform, onboards companies, and can "view as" any user.

Origins is built on the operational experience of Farm Direct Flowers — a Dutch flower importer based in Aalsmeer, co-owned by Willem. Farm Direct's real-world processes are the blueprint, and Farm Direct will be the first buyer company onboarded — the proving ground for every feature. But Origins is designed as a standalone product, not Farm Direct's internal tool: other importers should be able to adopt it, and Farm Direct may later offer sub-services through it. The current build is in Wave 2 (accounts & invitations), with Wave 3 (grower portal) substantially underway. Other waves will follow as the project progresses and requires new functionalities like for example buyer to farm payments. 
1.2 About the User (Willem)
Non-technical. No coding background. All advice, output, and explanations must be in plain, clear language. Avoid jargon unless defining it.
ADHD. Long monologues, layered options, and dense reasoning are counterproductive. Keep replies short, forward-moving, and visibly structured.
Decision-maker. Willem owns every architectural and product call. Claude proposes; Willem decides. Once a decision is locked, it stays locked unless Willem explicitly revisits it.
Super admin of Origins, not a Farm Direct employee from the platform's perspective. Farm Direct is the first buyer company; Willem operates the platform above it.
Big-picture thinker with many ideas. Help him prioritize and stay focused. Flag plainly when a new idea contradicts a locked decision — he then decides whether to proceed or revert.
1.3 What Origins Is
Industry context. Origins serves wholesale flower importers and distributors — companies that source premium roses and flowers from growers in producing regions like Ecuador and Colombia, manage the logistics of getting them to Europe, and sell on to wholesalers and retail distributors. The work is operationally complex: many simultaneous orders across many growers, tight time windows, perishable goods, multiple logistics handoffs per shipment, and a constant stream of negotiations, claims, and reconciliations. Origins consolidates all of that into one tool.

Model company. The platform is built on the operational experience of Farm Direct Flowers (a division of Farm Direct Netherlands B.V., Aalsmeer, founded 2012). Farm Direct's real-world processes — its purchasing rhythms, negotiation patterns, logistics coordination, and financial admin — are the blueprint for Origins. Farm Direct will be the first buyer company onboarded and the proving ground for every feature. Beyond Farm Direct, Origins is intended to serve other importers with similar workflows, and Farm Direct may eventually offer sub-services through it. In all design and product decisions, treat Origins as a standalone product — not Farm Direct's internal tool.

Product scope. A single web app that consolidates the procurement operation end-to-end. Domains covered, or to be covered, in priority order:

Shipments & purchasing. Buyer creates a shipment (one flight), builds a Purchase Order list with grower blocks, boxes (FB / HB / QB / EB), and line items (order type, product, stems, stems per bunch, price). Order types: Standing, Repeating, Open Market.
Negotiation. Buyer–grower asks and counters are preserved as a thread on each PO line. The line shows the current agreed state on top; nothing is overwritten. Either side can cancel anytime. Once accepted, the line locks to agreed values.
Logistics coordination. Each shipment may name up to five logistics roles — cargo agent, airline, customs agent, trucking, handling — each with cost + currency. Plus a catchall extra-costs table for one-offs.
Document handling. Growers upload invoices; logistics partners upload shipping documents (AWB, packing lists, etc.). AI extraction pulls out costs, weights, and key fields for reconciliation. (Wave 4.)
Account statements & claims. Per buyer–grower pair; later a per-company global summary.
Admin back-end. Super admin manages companies, users, products, and the master product catalogue.


Project scope may grow as the project progresses into new preferences and feedback from actual users.  

Three account types, each at the company level, each with a distinct experience:

Buyer — creates shipments and PO lists, runs negotiations, assigns lines, splits and closes purchasing. Sees own shipments and all related documents including invoices.
Grower — sees only shipments that include their PO lines, and only their boxes. Confirms, cancels, or counters each line. Uploads invoices. Sees only their own invoices and statements. One grower account can serve multiple buyers, kept fully separate.
Logistics — sees assigned shipments with full shipment details except PO lines. Box totals shown as FB equivalents (HB = ½ FB, QB = ¼ FB). Uploads shipping documents. AI extracts AWB / weights / costs.

Above the account types: super admin. Sits on the platform, sees all data, can "view as" any company or user. Operates onboarding, master data, and platform settings. Not a fourth account type — a layer above.
1.4 Architecture (Locked Decisions)
These decisions are immutable unless Willem explicitly revisits them. If a request appears to contradict any of them, Claude must flag it plainly before acting.

Identity model.

Two layers: account type (Buyer / Grower / Logistics) at the company level — set at creation, shapes the company's whole experience. User role (Admin / Regular) at the user level within a company. Admins can invite teammates and manage their company.
Super admin is a flag on a user, not an account type.

Company visibility (RLS-enforced).

Buyer companies see only growers and logistics on their explicit list — a row in company_relationships.
Buyers cannot put a grower on a PO line unless they're already on the list — enforced both UI-side and via RLS write checks.
Logistics also sees growers on shipments they're assigned to (the "farm list").
Visibility is never derived from shipment participation alone — that would be a back-door to discovery. The relationship row is the only source of truth.

Grower invitations & connections.

Buyers bring their OWN growers (invite if absent) — NOT a shared pool/marketplace. Keeps Origins neutral.
Grower-invites-buyer: BUILD but keep HIDDEN initially.
One grower company = one login, seeing multiple buyers' orders, kept fully separate (buyers never see each other).

Purchasing lifecycle.

States: draft → active → in_transit → departed → arrived → completed.
Draft: buyer builds the PO list privately; growers see nothing.
Manual "Start purchasing" flips draft → active and pushes lines live to growers.
Once active, "Load template" hides; "Save as template" and "Close purchasing" remain.
Post-go-live edits sync via an explicit batched "Send updates to growers" action (Wave 3).
Once past active (status in_transit and beyond), the PO list is read-only — all inputs disabled, add/delete/drag controls hidden. Buyer cannot edit lines, add growers, or add/remove boxes.
"Reopen purchasing" button is available in in_transit only (not from departed onward), with a confirm dialog. It flips the shipment back to active so the PO list becomes editable again. Growers see the shipment status revert.
Editing a confirmed line = a new ask in the thread. Deleting a live line = soft-cancel, kept in history.

Negotiation thread.

Every ask, counter, and acceptance is preserved with who/what/when. Nothing overwritten.
The line displays the current agreed state on top; the full thread sits behind it.
Either side can cancel a line at any point.
Line state lock: confirmed/cancelled lines are read-only inline. Use the drawer's Reopen action to negotiate again.

PO Templates.

Reusable Purchase Order lists, owned per buyer company. Name unique per company, not globally.
Captures grower blocks, boxes, every line including price.
Save = "new template" or "overwrite existing". Load = fills the list, buyer tweaks.
Standing Orders and Repeating Orders are negotiable line attributes with optional date ranges — they live inside the negotiation thread, not in templates.

Shipment logistics.

One buyer per shipment.
Five fixed optional logistics roles, each a foreign key + cost + currency: cargo_agent, airline, customs_agent, trucking, handling.
Catchall shipment_extra_costs(shipment_id, description, amount, currency) for one-offs.
All currencies convert to EUR for cost-per-stem calculations.
Buyer chooses per logistics company whether to grant a login.

Shipment reference.

Every shipment is assigned an auto-generated reference of format YY-NNNN on insert (year + zero-padded sequence — e.g., 26-0042).
The sequence is scoped per buyer company — each buyer has its own counter, restarting per year.
Assigned by a DB trigger; reference is read-only in the UI.

Statements.

Per buyer-grower pair; later add global open/unpaid summary per company on dashboard.

Connection acceptance (Wave 2).

Adding an existing grower or logistics to a buyer's list creates a relationship with status='pending'. Partner admin gets an in-app notification and must Accept or Decline. Only active relationships grant visibility.
Inviting a new grower or logistics via Origins auto-accepts the relationship on onboarding — the invitation itself is the consent.
Super-admin invitations and teammate invitations within a company don't require mutual acceptance.

Box types. FB, HB, QB, EB. Logistics view shows totals as FB equivalents.

Master product catalogue. Owned by super admin only.

Per-grower sub-catalogue. Buyers can curate a per-grower sub-catalogue from the master list (in grower_products). When a grower has at least one product in their sub-catalogue, the PO line product picker for that grower is filtered to that sub-catalogue. Falls back to the full master catalogue when the grower has no sub-catalogue set up.

Invitations (Wave 2 model).

Each invitation produces a shareable link with a UUID token, 14-day expiry.
Public /?invite=<token> flow: sign up + accept + onboarding fields, atomic via the accept_invitation RPC.
Phase 2 backlog: full email-based invitation system with branded templates once SMTP is in place.

Number format.

All numeric display uses European format: . thousand separator, , decimal separator (e.g., 1.234,56).
Price inputs accept either . or , and auto-normalize to ,.
Currency display prefixes the symbol (e.g., $1.234,56).

Dialog system.

All overlays — confirms, alerts, prompts, modals — use the Origins-native <Dialog/> component (in src/Dialog.jsx). No native window.confirm/alert/prompt. No OS / browser-default dialog boxes.
1.5 How Claude Should Work
Communication.

Replies are short by default. PM-style: say what's next, hold the plan visible, don't re-explain settled material.
Silent "Think First": diagnoses, code inspection, and reasoning happen in tool calls and internal thought, not in the reply. Reply with the conclusion + brief next step.
After a change: a single brief note of what changed + what to test. Nothing more unless asked.
Avoid heavy formatting (bullets everywhere, headers in casual replies) unless the content genuinely needs structure.
When a decision is needed and options are clear, present tappable / clear options — easier than typing on mobile.

Decision discipline.

Flag plainly when a new idea contradicts a locked decision. Quote the locked decision, name the contradiction, and ask whether to proceed or revert. Never silently override.
Propose, don't decide. Willem owns architectural and product choices.

Validation before declaring done.

Walk through user scenarios mentally before saying "ready to test". A build that compiles is not enough.
For each change, identify the path the user will take, the data it touches, and the failure modes. If a scenario is unclear, ask before declaring done.
Don't change unrelated things while building a specific feature. Stay scoped.

Session hygiene.

At the end of each session, update the "Current state" section of this file with (a) what was completed, (b) what's queued next, (c) any known issues or deferred items.
Permanent decisions and durable lessons are promoted into Sections 1.4 (Architecture) or 2 (Operating principles) of this file — not just left in "Current state".

What NOT to do.

Don't narrate long reasoning, diagnoses, or audits in the reply.
Don't declare work done without walking through scenarios.
Don't change things outside the current scope while building.
Don't store credentials, tokens, or passwords verbatim in this file or in memory.
Don't proceed past a contradiction with a locked decision — flag it first.
Don't reinstate context Willem already has — assume he's read the recent messages.
1.6 Roadmap
Build waves (locked order).

Wave 1 — Buyer portal hardening. Real login, company/user model, super-admin "view as", PO Templates, manual purchasing gate, full RLS pass with relationship-gated visibility. Status: COMPLETE.
Wave 2 — Accounts & invitations. Invitation token system, public accept flow, mutual acceptance for existing partners, teammate invites, eventually email delivery via Resend SMTP. Status: substantially complete; super-admin-invites-buyer, partner accept/decline, and teammate invitations all shipped. Resend SMTP still pending.
Wave 3 — Grower portal. Per-line confirm/cancel/counter, the negotiation thread, post-go-live edit sync, invoice upload. Status: Phase 1 + Phase 2 batch shipped; Phase 3 (negotiation thread polish, post-go-live edit sync, invoice upload) remaining.
Wave 4 — Logistics portal. Assigned shipments view, shipping document upload, AI extraction (AWB, weights, costs). The AI extraction piece uses the Claude API (Claude Platform).
Wave 5 — Partner onboarding & trust handshake. Templated due diligence on the receiving side of a connection request. The partner can require the requesting company to complete onboarding before approval: new-customer form, credit application, supporting documents. The receiving party reviews submissions and approves with explicit terms (credit limit, payment terms, currencies, default order types). Bakes the real-world "are you a company we want to do business with?" check into the platform. Until Wave 5, connection requests remain a simple Accept / Decline.
1.7 Hard Guardrails
Never store passwords, API keys, or GitHub tokens verbatim in this file or anywhere else committed to the repo.
Never silently override a locked architectural decision. Flag and ask first.
Never declare work "ready to test" without walking through the user scenarios that exercise it.
Never edit a section of the codebase that's outside the scope of the current task — even if it looks like it could use cleanup.
Never invent data, sample records, or "Farm Direct" content in the database. Real data only, created via the real flows.
Never assume a feature works because the build compiled. Compilation is necessary but not sufficient.
1.8 Tech Stack & Infrastructure
Frontend.

React, Create React App style. Not Next.js, not Vite.
No router library — top-level routing is via URL query parameter detection (?invite=<token>) and an internal page state for sidebar nav.
Inline styles plus a single styles.js CSS string in App.
Key components: App.jsx (main shell + buyer flows), Auth.jsx (login / forgot / reset), Templates.jsx (PO Templates), Invitations.jsx (invitation send + accept flow), POEditor.jsx (PO list), GrowerOrders.jsx (grower view), LineDrawer.jsx (negotiation drawer + actions), Dialog.jsx (Origins-native overlay system).

Backend.

Supabase project: zzpxcjmvyimwziqljlmb, region Europe / Frankfurt.
Postgres with Row-Level Security on every table.
Auth: Supabase Auth, email + password. "Confirm email" is currently OFF until SMTP is in place.
RPCs for atomic multi-table operations and for things that need to bypass RLS safely (e.g., accept_invitation runs as SECURITY DEFINER).
Key RLS helper functions: is_super_admin(), current_company_id(), current_is_buyer_of(), current_grower_has_line_on(), shipment_past_draft(), current_logistics_is_on(), current_logistics_sees_grower().
Key business RPCs: po_confirm, po_cancel (accepts optional p_reason), po_counter (accepts price/stems/stems-per-bunch/length/order_type/product_id), po_reopen.

Hosting & deployment.

Frontend: Vercel. Auto-deploys from main.
Live URL: https://origins-two.vercel.app
Eventual production domain: letsgoorigins.com (not yet wired).

Source control.

Repo: https://github.com/willem-fd/origins
Local working folder: Documents/Origins Claude Build (in Claude Code).

Migrations.

All SQL migrations live in migrations/, one file per change set, named wN_<name>.sql.
Migrations are run by Willem in the Supabase SQL Editor — Claude prepares the SQL, Willem pastes and runs. (Once the Supabase MCP server is connected, Claude Code can paste them directly with Willem's approval.)

Test fixtures (in the database).

Logins, password TestOrigins!2026:
tbuyer@origins.test → Test Buyer Co (admin)
tgrower@origins.test → Test Grower Co (admin)
tlogistics@origins.test → Test Logistics Co (admin)
Seed shipments: TEST-A-001 (Active, has a Test Grower line and Test Logistics as cargo agent), TEST-B-002 (Draft, Test Grower line only).
Super admin login: willemvanmaasdijk@gmail.com.
Farm Direct buyer admin: willem@farmdirect.nl.

Active database tables. companies, users, company_relationships, company_invitations, shipments, purchase_orders, po_actions, products, grower_products, po_templates, po_template_items, shipment_documents, packing_list_items, claims.

Retired tables (do not reintroduce): growers, logistics_partners, farms, profiles, handshakes, logistics_rates, template_items, shipment_templates.


2. Operating principles & lessons learned
These rules came from real mistakes. Re-read them when in doubt.

Surgical fixes only. When fixing one bug, do NOT change anything beyond what's strictly needed for that bug. Bulk find/replace across files is dangerous because the same variable, class, or CSS variable may serve different contexts (e.g., --surface works for white forms but breaks dark sidebars). Fix each instance with surgical awareness of its context.

Verify column names before writing SQL. Real column names diverge from intuition:

purchase_orders uses price_ordered and stems_ordered — not price / stems.
purchase_orders uses length_cm — not length.
shipments uses reference — not shipment_no.
shipments uses departure_date — not dep_date.

ALWAYS verify columns via information_schema before writing SQL or supabase.select(). Guessing has cost multiple debug round-trips.

Catch errors on every Supabase query. A query against a hidden / mis-named column returns an error, not data. If the calling code shows "empty state" on error, the bug looks like "no data" instead of "broken query" — and debugging takes far longer. Inspect { data, error } on every call.

Validate before declaring done. Walk through the user's actual path. A build that compiles is not enough. Identify the data it touches and the failure modes. If a scenario is unclear, ask before saying it's ready to test.

No bulk changes without explicit scope. Only change what was explicitly requested. Flag unrelated issues separately rather than fixing them inline.

"Think First" discipline. Confirm understanding → check existing code → identify risks → state plan → get explicit go-ahead before writing code.

PL/pgSQL gotchas.

Record variables must not share names with table aliases used in the same function body (shadowing).
Cannot change the return type of an existing SQL function without DROP FUNCTION first.
After table renames or creating new tables, explicit GRANT ALL ON [table] TO anon, authenticated, service_role is required — not just NOTIFY pgrst.


3. Current state (last updated 2026-06-14)
3.1 What's been shipped
Wave 1 — Buyer portal hardening. Complete: real login, company/user model, super-admin "view as" feature pending, PO Templates, manual purchasing gate, full RLS pass with relationship-gated visibility.

Wave 2 — Accounts & invitations. Substantially complete:

Super-admin-invites-buyer flow live (Farm Direct created via the real flow)
Buyer-invites-new-grower/logistics flow (auto-accept on onboarding)
Buyer-adds-existing-partner with pending → accept/decline mutual-acceptance flow
Teammate invitations within a company
Connection requests UI (partner side)

Pending: Resend SMTP for branded transactional emails on letsgoorigins.com.

Wave 3 Phase 1 — Grower portal foundation. Complete:

purchase_orders.state column (pending/active/cancelled)
po_actions immutable history table
po_confirm / po_cancel RPCs
Trigger for draft → active snapshot
Buyer + grower UI polish: status badges, box/grower separation, Reopen button, read-only lock past Active, European number format, grower Orders page with shipment list + detail view
Internal rename from "Farm/farm" to "Grower/grower"
YY-NNNN buyer-scoped shipment reference (DB trigger)

Wave 3 Phase 2 — Negotiation system. Shipped in two batches:

Batch A (2026-06-09):

LineDrawer.jsx — drawer that acts as the action hub for each line (Confirm / Counter / Cancel / Reopen)
Whose-turn badges: "Reply required" (pastel orange) on the side whose turn it is, "Awaiting reply" (muted gray) on the side that just acted
Row background tint when reply required
Counter form initially with Price / Stems / St/Bunch
Drawer close animation (slide-out mirror of slide-in)
Drawer hoisted out of backdrop's stacking context (z-index 90, between backdrop 80 and drawer 100)
Cell-jump fix: row-delete element parity between locked and unlocked rows
Order-type help icon (?) next to the ORDER TYPE label, opens popover with OM/RO/SO definitions
Counter form expanded to 6 fields (Type / Variety / Length / Stems / St/Bunch / Price) — both sides
Brass-coloured diff highlight on changed counter fields
Dialog.jsx reusable component + DialogHost mounted at app root + 8 native window.confirm/alert callsites replaced
Drawer closes after every successful action
po_confirm RPC widened to allow either buyer-admin or grower-admin (was grower-only; broke buyer confirm after grower counter)
po_cancel RPC accepts optional p_reason; grower cancel prompts for reason via promptDialog; reason rendered as a small block under the Cancelled thread item
po_counter RPC accepts length_cm / order_type / product_id
"Purchase Order List · X growers · X lines" toolbar text removed

Batch B (2026-06-12) — three UI fixes pushed:

Removed company name from line details box
Moved status banner to between buyer note and actions
Fixed renderFields filter to show ONLY changed fields in counter thread items (not all 6)
Session — 2026-06-14 (moved from Projects to Claude Code; Supabase MCP connected)

Environment / tooling.
- Repo cloned into the local working folder; CLAUDE.md and DESIGN.md committed and pushed.
- GitHub auth: a personal access token is stored in the macOS keychain only (never in the repo). NOTE: a PAT was pasted into chat this session — recommend revoking + rotating it when convenient.
- Supabase MCP server connected at user scope (~/.claude.json), project zzpxcjmvyimwziqljlmb, read+write. Claude Code now applies migrations directly with Willem approving each query — no more manual SQL paste. The Supabase access token also lives only in ~/.claude.json.
- DESIGN.md added: the site-wide design system (colors, type, spacing, buttons, forms, badges, the three overlays Dialog/Modal/Drawer, the PO line drawer pattern, auth, icons). READ IT before any UI work. Brand = forest green + brass on warm cream; fonts DM Sans / DM Mono.

The stale "paste w3_rpc_widen_and_reason_fixed.sql" item is RETIRED — do not apply it. That file never existed in the repo, and the only-changed-fields SQL it described would BREAK the shipped frontend, which diffs each action against the prior one and therefore needs every action to carry a full snapshot. The brass-diff was already solved in the frontend (commit 84376a6).

Negotiation drawer rework — SHIPPED & LIVE.
- Data fix (migrations/w3_ask_all_six_fields.sql, applied): every 'ask' action now stores all 6 negotiable fields. This was the root cause of "length didn't highlight" — the opening ask had no length to diff against. on_shipment_activate, on_po_buyer_insert, on_po_buyer_update all fixed. FORWARD-ONLY: 'ask' rows created before this date lack length/order_type/product_id, so legacy lines won't show those as changed — test on fresh lines.
- Drawer redesign (src/LineDrawer.jsx + src/styles.js, deployed): re-ranked to Identity (variety + box, state badge in header) → whose-move banner → "Current order" grid (the 6 terms; the latest action's changes tinted brass with "· was X" inline) → Actions → History (always expanded, newest first). Variety spans the full grid width. Buttons fill the action row: Confirm/Counter/Reopen flex to fill, Cancel compact at the end, all same height. History bubble field order mirrors the grid (Variety, Type, Length, Stems, St/B, Price).
- Re-counter fix (migrations/w3_recounter_fix.sql, applied): buyer countering a counter crashed with "tuple to be updated was already modified...". Cause: po_counter's UPDATE fired the buyer-edit ask trigger (caller == buyer), whose insert fired the last-action denorm trigger, which re-updated the same row mid-command. Fix: po_counter now sets a transaction-local flag origins.skip_buyer_edit around its UPDATE and on_po_buyer_update returns early when set. Buyer↔grower can now counter indefinitely.
- Verified live: po_confirm / po_counter / po_cancel all store all 6 fields; po_counter is guarded against the buyer-edit trigger. Willem confirmed the flow works end-to-end on the live site.

Deferred / known issues.
- Pre-2026-06-14 'ask' rows lack length/order_type/product_id (forward-only fix above). Cosmetic only, legacy lines.
- Connection-request-approval UX (W2 Steps 3–4) works; Willem wants to refine later — ask him what felt off.
- Resend SMTP for branded transactional emails on letsgoorigins.com — pending the domain move.
3.3 Wave 3 Phase 3 and beyond (next up)
W3 Phase 3: Post-go-live edit sync (the explicit batched "Send updates to growers" action), further negotiation polish, grower invoice upload.
W4: Logistics portal — assigned shipments view, shipping document upload, AI extraction. The AI extraction uses the Claude API (Claude Platform). Setup of the API key + first PDF-to-structured-data prompt is the first task in this wave.
3.4 Things to verify when Claude Code first opens the repo
Confirm the Supabase MCP is connected (tools named mcp__supabase__*). If absent, reconnect via ~/.claude.json. Migrations are now applied directly via MCP (Willem approves each); the DB is the source of truth — verify live function bodies with pg_get_functiondef before editing, since the repo and DB have diverged in the past. APPLIED.md is stale.
Run npm install if node_modules/ isn't present (optional for code reading; required to run npm start).
Confirm Vercel auto-deployed the most recent main: visit origins-two.vercel.app and check it loads.



End of CLAUDE.md.
