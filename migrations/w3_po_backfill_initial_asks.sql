-- ============================================================
-- ORIGINS — W3 Phase 2: backfill initial 'ask' for orphan PO lines
-- For any PO line on a non-draft shipment that has zero entries in
-- po_actions, insert a synthetic initial 'ask'. This catches lines
-- that were created before the on_po_buyer_insert trigger was in
-- place. Safe to re-run (idempotent via NOT EXISTS).
-- ============================================================

begin;

insert into po_actions (po_id, actor_user_id, actor_company_id, action, fields_json, created_at)
select po.id, null, s.buyer_company_id, 'ask',
       jsonb_build_object(
         'price_ordered',   po.price_ordered,
         'stems_ordered',   po.stems_ordered,
         'stems_per_bunch', po.stems_per_bunch
       ),
       coalesce(s.created_at, now())
  from purchase_orders po
  join shipments s on s.id = po.shipment_id
 where s.status <> 'draft'
   and not exists (select 1 from po_actions a where a.po_id = po.id);

commit;
