-- ============================================================
-- ORIGINS — W3 Phase 2: empty-price guard on po_confirm
-- Grower (or anyone) cannot confirm a line whose price_ordered
-- is null. They must counter with a price first.
-- (Counter mechanism arrives in the next migration.)
-- ============================================================

begin;

create or replace function public.po_confirm(p_po_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  caller_company  uuid;
  caller_is_admin boolean;
  caller_is_super boolean;
  po_row          record;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  select u.company_id, (u.role = 'admin'), coalesce(u.is_super_admin, false)
    into caller_company, caller_is_admin, caller_is_super
    from users u where u.id = auth.uid();

  select po.*, s.status as shipment_status into po_row
    from purchase_orders po join shipments s on s.id = po.shipment_id
    where po.id = p_po_id;
  if not found then
    return json_build_object('ok', false, 'error', 'po_not_found');
  end if;

  if not caller_is_super
     and (not coalesce(caller_is_admin, false) or po_row.grower_company_id is distinct from caller_company) then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  if po_row.shipment_status <> 'active' then
    return json_build_object('ok', false, 'error', 'shipment_not_active');
  end if;

  if po_row.state <> 'pending' then
    return json_build_object('ok', false, 'error', 'line_not_pending');
  end if;

  -- W3 Phase 2: cannot confirm without a price; grower must counter first.
  if po_row.price_ordered is null then
    return json_build_object('ok', false, 'error', 'price_required');
  end if;

  update purchase_orders set state = 'active' where id = p_po_id;

  insert into po_actions (po_id, actor_user_id, actor_company_id, action, fields_json)
    values (p_po_id, auth.uid(), caller_company, 'confirm',
            jsonb_build_object('price_ordered', po_row.price_ordered, 'stems_ordered', po_row.stems_ordered, 'stems_per_bunch', po_row.stems_per_bunch));

  return json_build_object('ok', true);
end $$;
grant execute on function public.po_confirm(uuid) to authenticated;

commit;
