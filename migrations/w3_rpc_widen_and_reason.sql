-- ============================================================
-- ORIGINS — W3 Phase 2 follow-ups
--  1. po_confirm: was grower-or-super only. Widen to either buyer
--     or grower admin (or super). Counter offers mean either side
--     can be the one accepting the current state.
--  2. po_counter: accept length_cm, order_type, product_id in
--     addition to price/stems/stems_per_bunch.
--  3. po_cancel: accept an optional p_reason text, recorded in the
--     action's fields_json so the thread can surface it.
-- ============================================================

begin;

-- ---------------- po_confirm (widened) ----------------
create or replace function public.po_confirm(p_po_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  caller_company  uuid;
  caller_is_admin boolean;
  caller_is_super boolean;
  po              record;
  buyer_id        uuid;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  select u.company_id, (u.role = 'admin'), coalesce(u.is_super_admin, false)
    into caller_company, caller_is_admin, caller_is_super
    from users u where u.id = auth.uid();

  select po.*, s.status as shipment_status, s.buyer_company_id into po
    from purchase_orders po join shipments s on s.id = po.shipment_id
    where po.id = p_po_id;
  if not found then
    return json_build_object('ok', false, 'error', 'po_not_found');
  end if;
  buyer_id := po.buyer_company_id;

  -- Authorisation: super, OR admin of the line's buyer or grower
  if not caller_is_super
     and (not coalesce(caller_is_admin, false)
          or (caller_company is distinct from buyer_id
              and caller_company is distinct from po.grower_company_id)) then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  if po.shipment_status <> 'active' then
    return json_build_object('ok', false, 'error', 'shipment_not_active');
  end if;
  if po.state = 'cancelled' then
    return json_build_object('ok', false, 'error', 'line_cancelled');
  end if;
  if po.state = 'active' then
    return json_build_object('ok', false, 'error', 'already_confirmed');
  end if;
  if po.price_ordered is null then
    return json_build_object('ok', false, 'error', 'price_required');
  end if;

  update purchase_orders set state = 'active' where id = p_po_id;

  insert into po_actions (po_id, actor_user_id, actor_company_id, action, fields_json)
    values (p_po_id, auth.uid(), caller_company, 'confirm',
            jsonb_build_object(
              'price_ordered',   to_jsonb(po.price_ordered),
              'stems_ordered',   to_jsonb(po.stems_ordered),
              'stems_per_bunch', to_jsonb(po.stems_per_bunch)
            ));

  return json_build_object('ok', true);
end $$;
grant execute on function public.po_confirm(uuid) to authenticated;


-- ---------------- po_counter (extended fields) ----------------
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
  -- Existing fields
  has_price       boolean := p_fields ? 'price_ordered';
  has_stems       boolean := p_fields ? 'stems_ordered';
  has_stpb        boolean := p_fields ? 'stems_per_bunch';
  -- New fields
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

  select po.*, s.status as shipment_status, s.buyer_company_id into po_row
    from purchase_orders po join shipments s on s.id = po.shipment_id
    where po.id = p_po_id;
  if not found then
    return json_build_object('ok', false, 'error', 'po_not_found');
  end if;
  buyer_id := po_row.buyer_company_id;

  -- Either side admin (or super)
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

  -- Parse new values (absent key or empty string = keep current)
  if has_price   then new_price   := nullif(p_fields->>'price_ordered',   '')::numeric; end if;
  if has_stems   then new_stems   := nullif(p_fields->>'stems_ordered',   '')::integer; end if;
  if has_stpb    then new_stpb    := nullif(p_fields->>'stems_per_bunch', '')::integer; end if;
  if has_length  then new_length  := nullif(p_fields->>'length_cm',       '')::integer; end if;
  if has_otype   then new_otype   := nullif(p_fields->>'order_type',      ''); end if;
  if has_product then new_product := nullif(p_fields->>'product_id',      '')::uuid; end if;

  -- Validate order_type whitelist if provided
  if has_otype and new_otype is not null
     and new_otype not in ('open_market','repeating','standing') then
    return json_build_object('ok', false, 'error', 'invalid_order_type');
  end if;

  -- Snapshot values (use new if provided, else current)
  final_price   := case when has_price   then new_price   else po_row.price_ordered  end;
  final_stems   := case when has_stems   then new_stems   else po_row.stems_ordered  end;
  final_stpb    := case when has_stpb    then new_stpb    else po_row.stems_per_bunch end;
  final_length  := case when has_length  then new_length  else po_row.length_cm      end;
  final_otype   := case when has_otype   then new_otype   else po_row.order_type     end;
  final_product := case when has_product then new_product else po_row.product_id     end;

  update purchase_orders set
    price_ordered   = case when has_price   then new_price   else price_ordered end,
    stems_ordered   = case when has_stems   then new_stems   else stems_ordered end,
    stems_per_bunch = case when has_stpb    then new_stpb    else stems_per_bunch end,
    length_cm       = case when has_length  then new_length  else length_cm end,
    order_type      = case when has_otype   then new_otype   else order_type end,
    product_id      = case when has_product then new_product else product_id end,
    state           = 'pending'
  where id = p_po_id;

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


-- ---------------- po_cancel (accepts optional reason) ----------------
-- Drop the old single-arg version first to avoid ambiguity with the new
-- (uuid, text default null) signature — PostgREST cannot route between
-- two functions where one matches by default.
drop function if exists public.po_cancel(uuid);

create or replace function public.po_cancel(p_po_id uuid, p_reason text default null)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  caller_company  uuid;
  caller_is_admin boolean;
  caller_is_super boolean;
  po              record;
  buyer_id        uuid;
  clean_reason    text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  select u.company_id, (u.role = 'admin'), coalesce(u.is_super_admin, false)
    into caller_company, caller_is_admin, caller_is_super
    from users u where u.id = auth.uid();

  select po.*, s.status as shipment_status, s.buyer_company_id into po
    from purchase_orders po join shipments s on s.id = po.shipment_id
    where po.id = p_po_id;
  if not found then
    return json_build_object('ok', false, 'error', 'po_not_found');
  end if;
  buyer_id := po.buyer_company_id;

  -- Either side admin (or super) can cancel
  if not caller_is_super
     and (not coalesce(caller_is_admin, false)
          or (caller_company is distinct from buyer_id
              and caller_company is distinct from po.grower_company_id)) then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  if po.shipment_status <> 'active' then
    return json_build_object('ok', false, 'error', 'shipment_not_active');
  end if;
  if po.state = 'cancelled' then
    return json_build_object('ok', false, 'error', 'already_cancelled');
  end if;

  clean_reason := nullif(btrim(coalesce(p_reason, '')), '');

  update purchase_orders set state = 'cancelled' where id = p_po_id;

  insert into po_actions (po_id, actor_user_id, actor_company_id, action, fields_json)
    values (p_po_id, auth.uid(), caller_company, 'cancel',
            jsonb_build_object(
              'price_ordered',   to_jsonb(po.price_ordered),
              'stems_ordered',   to_jsonb(po.stems_ordered),
              'stems_per_bunch', to_jsonb(po.stems_per_bunch),
              'reason',          to_jsonb(clean_reason)
            ));

  return json_build_object('ok', true);
end $$;
grant execute on function public.po_cancel(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
