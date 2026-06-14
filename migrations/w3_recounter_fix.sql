-- ============================================================
-- ORIGINS — W3 Phase 2/3: fix repeated counters (re-counter)
--
-- Bug: when the BUYER counters (re-counter / re-re-counter), po_counter's
-- UPDATE on purchase_orders fires the buyer-edit trigger on_po_buyer_update
-- (caller == buyer). That trigger inserts an 'ask', whose insert fires the
-- last-action denorm trigger (sync_po_last_action), which UPDATEs the very
-- same purchase_orders row that is still mid-update. Postgres aborts with:
--   "tuple to be updated was already modified by an operation triggered by
--    the current command"
-- Grower counters are unaffected because the buyer-edit trigger skips
-- non-buyers.
--
-- Fix: a buyer counter is a counter, not an edit. po_counter sets a
-- transaction-local flag (origins.skip_buyer_edit) around its UPDATE, and
-- on_po_buyer_update returns early when that flag is set. po_counter still
-- records the 'counter' action itself, so nothing is lost.
-- ============================================================

begin;

-- 1. Buyer-edit trigger: stand down while a counter RPC owns the update.
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
  -- A counter RPC is responsible for its own action; don't also log an 'ask'.
  if current_setting('origins.skip_buyer_edit', true) = '1' then
    return new;
  end if;

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

-- 2. po_counter: raise the flag around the UPDATE so the buyer path
--    doesn't recurse through the denorm trigger.
create or replace function public.po_counter(p_po_id uuid, p_fields jsonb)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  caller_company  uuid;
  caller_is_admin boolean;
  caller_is_super boolean;
  po_row          record;
  buyer_id        uuid;
  has_price       boolean := p_fields ? 'price_ordered';
  has_stems       boolean := p_fields ? 'stems_ordered';
  has_stpb        boolean := p_fields ? 'stems_per_bunch';
  has_length      boolean := p_fields ? 'length_cm';
  has_otype       boolean := p_fields ? 'order_type';
  has_product     boolean := p_fields ? 'product_id';
  new_price       numeric;
  new_stems       integer;
  new_stpb        integer;
  new_length      integer;
  new_otype       text;
  new_product     uuid;
  final_price     numeric;
  final_stems     integer;
  final_stpb      integer;
  final_length    integer;
  final_otype     text;
  final_product   uuid;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  select u.company_id, (u.role = 'admin'), coalesce(u.is_super_admin, false)
    into caller_company, caller_is_admin, caller_is_super
    from users u where u.id = auth.uid();

  select po_rec.*, s.status as shipment_status, s.buyer_company_id into po_row
    from purchase_orders po_rec join shipments s on s.id = po_rec.shipment_id
    where po_rec.id = p_po_id;
  if not found then
    return json_build_object('ok', false, 'error', 'po_not_found');
  end if;
  buyer_id := po_row.buyer_company_id;

  if not caller_is_super
     and (not coalesce(caller_is_admin, false)
          or (caller_company is distinct from buyer_id
              and caller_company is distinct from po_row.grower_company_id)) then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  if po_row.shipment_status <> 'active' then
    return json_build_object('ok', false, 'error', 'shipment_not_active');
  end if;
  if po_row.state = 'cancelled' then
    return json_build_object('ok', false, 'error', 'line_cancelled');
  end if;

  if has_price   then new_price   := nullif(p_fields->>'price_ordered',   '')::numeric; end if;
  if has_stems   then new_stems   := nullif(p_fields->>'stems_ordered',   '')::integer; end if;
  if has_stpb    then new_stpb    := nullif(p_fields->>'stems_per_bunch', '')::integer; end if;
  if has_length  then new_length  := nullif(p_fields->>'length_cm',       '')::integer; end if;
  if has_otype   then new_otype   := nullif(p_fields->>'order_type',      ''); end if;
  if has_product then new_product := nullif(p_fields->>'product_id',      '')::uuid; end if;

  if has_otype and new_otype is not null
     and new_otype not in ('open_market','repeating','standing') then
    return json_build_object('ok', false, 'error', 'invalid_order_type');
  end if;

  final_price   := case when has_price   then new_price   else po_row.price_ordered  end;
  final_stems   := case when has_stems   then new_stems   else po_row.stems_ordered  end;
  final_stpb    := case when has_stpb    then new_stpb    else po_row.stems_per_bunch end;
  final_length  := case when has_length  then new_length  else po_row.length_cm      end;
  final_otype   := case when has_otype   then new_otype   else po_row.order_type     end;
  final_product := case when has_product then new_product else po_row.product_id     end;

  -- Suppress the buyer-edit 'ask' trigger for the duration of this update.
  perform set_config('origins.skip_buyer_edit', '1', true);

  update purchase_orders set
    price_ordered   = case when has_price   then new_price   else price_ordered end,
    stems_ordered   = case when has_stems   then new_stems   else stems_ordered end,
    stems_per_bunch = case when has_stpb    then new_stpb    else stems_per_bunch end,
    length_cm       = case when has_length  then new_length  else length_cm end,
    order_type      = case when has_otype   then new_otype   else order_type end,
    product_id      = case when has_product then new_product else product_id end,
    state           = 'pending'
  where id = p_po_id;

  perform set_config('origins.skip_buyer_edit', '', true);

  insert into po_actions (po_id, actor_user_id, actor_company_id, action, fields_json)
    values (p_po_id, auth.uid(), caller_company, 'counter',
            jsonb_build_object(
              'price_ordered',   to_jsonb(final_price),
              'stems_ordered',   to_jsonb(final_stems),
              'stems_per_bunch', to_jsonb(final_stpb),
              'length_cm',       to_jsonb(final_length),
              'order_type',      to_jsonb(final_otype),
              'product_id',      to_jsonb(final_product)
            ));

  return json_build_object('ok', true);
end $$;
grant execute on function public.po_counter(uuid, jsonb) to authenticated;

commit;
