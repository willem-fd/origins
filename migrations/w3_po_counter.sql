-- ============================================================
-- ORIGINS — W3 Phase 2: po_counter RPC
-- Either side (buyer admin or grower admin) proposes new values
-- on a pending line. Updates the line, inserts a 'counter' action,
-- and the line stays 'pending' (now waiting on the other side).
-- ============================================================

begin;

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
  new_price       numeric;
  new_stems       integer;
  new_stpb        integer;
  final_price     numeric;
  final_stems     integer;
  final_stpb      integer;
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

  -- Caller must be a buyer-side or grower-side admin (or super)
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

  -- Parse new values (empty string or absent key means "keep current")
  if has_price then new_price := nullif(p_fields->>'price_ordered', '')::numeric; end if;
  if has_stems then new_stems := nullif(p_fields->>'stems_ordered', '')::integer; end if;
  if has_stpb  then new_stpb  := nullif(p_fields->>'stems_per_bunch','')::integer; end if;

  -- Compute final values for the snapshot
  final_price := case when has_price then new_price else po_row.price_ordered end;
  final_stems := case when has_stems then new_stems else po_row.stems_ordered end;
  final_stpb  := case when has_stpb  then new_stpb  else po_row.stems_per_bunch end;

  -- Update purchase_orders + reset state to pending (other side now has the ball)
  update purchase_orders set
    price_ordered   = case when has_price then new_price else price_ordered end,
    stems_ordered   = case when has_stems then new_stems else stems_ordered end,
    stems_per_bunch = case when has_stpb  then new_stpb  else stems_per_bunch end,
    state           = 'pending'
  where id = p_po_id;

  insert into po_actions (po_id, actor_user_id, actor_company_id, action, fields_json)
    values (p_po_id, auth.uid(), caller_company, 'counter',
            jsonb_build_object(
              'price_ordered',   to_jsonb(final_price),
              'stems_ordered',   to_jsonb(final_stems),
              'stems_per_bunch', to_jsonb(final_stpb)
            ));

  return json_build_object('ok', true);
end $$;
grant execute on function public.po_counter(uuid, jsonb) to authenticated;

commit;
