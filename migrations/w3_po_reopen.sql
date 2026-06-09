-- ============================================================
-- ORIGINS — W3 Phase 2: po_reopen RPC + 'reopen' action type
-- Either side admin can reopen a confirmed/cancelled line.
-- State goes back to 'pending'; other side gets 'Reply required'.
-- ============================================================

begin;

alter table po_actions drop constraint if exists po_actions_action_check;
alter table po_actions add constraint po_actions_action_check
  check (action in ('ask', 'confirm', 'cancel', 'counter', 'reopen'));

create or replace function public.po_reopen(p_po_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  caller_company  uuid;
  caller_is_admin boolean;
  caller_is_super boolean;
  po_row          record;
  buyer_id        uuid;
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

  if not caller_is_super
     and (not coalesce(caller_is_admin, false)
          or (caller_company is distinct from buyer_id
              and caller_company is distinct from po_row.grower_company_id)) then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  if po_row.shipment_status <> 'active' then
    return json_build_object('ok', false, 'error', 'shipment_not_active');
  end if;

  if po_row.state not in ('active', 'cancelled') then
    return json_build_object('ok', false, 'error', 'not_reopenable');
  end if;

  update purchase_orders set state = 'pending' where id = p_po_id;

  insert into po_actions (po_id, actor_user_id, actor_company_id, action, fields_json)
    values (p_po_id, auth.uid(), caller_company, 'reopen',
            jsonb_build_object(
              'price_ordered',   po_row.price_ordered,
              'stems_ordered',   po_row.stems_ordered,
              'stems_per_bunch', po_row.stems_per_bunch
            ));

  return json_build_object('ok', true);
end $$;
grant execute on function public.po_reopen(uuid) to authenticated;

commit;
