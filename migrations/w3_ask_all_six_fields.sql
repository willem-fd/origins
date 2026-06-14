-- ============================================================
-- ORIGINS — W3 Phase 2/3: store all 6 negotiable fields on every 'ask'
--
-- Problem: the three functions that create 'ask' actions stored only a
-- subset of fields, so the drawer's "what changed" highlight had no prior
-- value to compare against for length_cm / order_type / product_id.
--   on_shipment_activate  → missing length_cm
--   on_po_buyer_insert    → missing length_cm, order_type, product_id
--   on_po_buyer_update    → missing length_cm, order_type, product_id (both paths)
--
-- Fix: every 'ask' now records all 6 negotiable fields, matching what
-- po_confirm / po_counter / po_cancel already store:
--   order_type, product_id, length_cm, stems_ordered, stems_per_bunch, price_ordered
--
-- Forward-looking only. Existing 'ask' rows are NOT backfilled, because the
-- original ask-time values of the missing fields cannot be reconstructed
-- once a line has been countered (the purchase_orders row holds the latest
-- agreed values, not the historical ask). To re-test on an existing line,
-- have the buyer edit it (creates a fresh ask) or add a new line.
-- ============================================================

begin;

-- ---------- on_shipment_activate: add length_cm to the snapshot ----------
create or replace function public.on_shipment_activate()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.status = 'draft' and new.status = 'active' then
    insert into po_actions (po_id, actor_user_id, actor_company_id, action, fields_json)
      select po.id, auth.uid(), new.buyer_company_id, 'ask',
             jsonb_build_object(
               'price_ordered',   to_jsonb(po.price_ordered),
               'stems_ordered',   to_jsonb(po.stems_ordered),
               'stems_per_bunch', to_jsonb(po.stems_per_bunch),
               'length_cm',       to_jsonb(po.length_cm),
               'order_type',      to_jsonb(po.order_type),
               'product_id',      to_jsonb(po.product_id)
             )
        from purchase_orders po
       where po.shipment_id = new.id;
    update purchase_orders set state = 'pending' where shipment_id = new.id and state is null;
  end if;
  return new;
end $$;

-- ---------- on_po_buyer_insert: new line on a live shipment → ask ----------
create or replace function public.on_po_buyer_insert()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  ship_status text;
  buyer_id uuid;
  caller_company uuid;
begin
  select s.status, s.buyer_company_id into ship_status, buyer_id
    from shipments s where s.id = new.shipment_id;
  if ship_status = 'draft' then return new; end if;

  select u.company_id into caller_company from users u where u.id = auth.uid();
  if caller_company is distinct from buyer_id then return new; end if;

  insert into po_actions (po_id, actor_user_id, actor_company_id, action, fields_json)
    values (new.id, auth.uid(), buyer_id, 'ask',
            jsonb_build_object(
              'price_ordered',   to_jsonb(new.price_ordered),
              'stems_ordered',   to_jsonb(new.stems_ordered),
              'stems_per_bunch', to_jsonb(new.stems_per_bunch),
              'length_cm',       to_jsonb(new.length_cm),
              'order_type',      to_jsonb(new.order_type),
              'product_id',      to_jsonb(new.product_id)
            ));
  return new;
end $$;

-- ---------- on_po_buyer_update: buyer edit → sync ask or new ask ----------
create or replace function public.on_po_buyer_update()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  ship_status text;
  buyer_id uuid;
  caller_company uuid;
  last_action record;
  changed boolean := false;
begin
  if (new.product_id       is distinct from old.product_id)
    or (new.length_cm       is distinct from old.length_cm)
    or (new.stems_ordered   is distinct from old.stems_ordered)
    or (new.stems_per_bunch is distinct from old.stems_per_bunch)
    or (new.price_ordered   is distinct from old.price_ordered)
    or (new.notes_buyer     is distinct from old.notes_buyer)
    or (new.order_type      is distinct from old.order_type)
    or (new.box_type        is distinct from old.box_type)
    or (new.boxmark         is distinct from old.boxmark)
    or (new.box_nr          is distinct from old.box_nr)
  then changed := true; end if;
  if not changed then return new; end if;

  select s.status, s.buyer_company_id into ship_status, buyer_id
    from shipments s where s.id = new.shipment_id;
  if ship_status = 'draft' then return new; end if;

  select u.company_id into caller_company from users u where u.id = auth.uid();
  if caller_company is distinct from buyer_id then return new; end if;

  select * into last_action from po_actions
    where po_id = new.id
    order by created_at desc
    limit 1;

  if last_action is null then
    return new;
  end if;

  if last_action.action = 'ask' and last_action.actor_company_id = buyer_id then
    update po_actions set fields_json = jsonb_build_object(
      'price_ordered',   to_jsonb(new.price_ordered),
      'stems_ordered',   to_jsonb(new.stems_ordered),
      'stems_per_bunch', to_jsonb(new.stems_per_bunch),
      'length_cm',       to_jsonb(new.length_cm),
      'order_type',      to_jsonb(new.order_type),
      'product_id',      to_jsonb(new.product_id)
    ) where id = last_action.id;
    return new;
  end if;

  insert into po_actions (po_id, actor_user_id, actor_company_id, action, fields_json)
    values (new.id, auth.uid(), buyer_id, 'ask',
            jsonb_build_object(
              'price_ordered',   to_jsonb(new.price_ordered),
              'stems_ordered',   to_jsonb(new.stems_ordered),
              'stems_per_bunch', to_jsonb(new.stems_per_bunch),
              'length_cm',       to_jsonb(new.length_cm),
              'order_type',      to_jsonb(new.order_type),
              'product_id',      to_jsonb(new.product_id)
            ));
  new.state := 'pending';
  return new;
end $$;

commit;
