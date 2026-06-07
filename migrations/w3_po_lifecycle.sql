-- ============================================================
-- ORIGINS — W3 Phase 1: PO line lifecycle + negotiation history
-- 1. Add state to purchase_orders (pending/active/cancelled)
-- 2. po_actions: immutable history of every ask/confirm/cancel/counter
-- 3. Trigger: when shipment flips draft→active, insert initial 'ask' actions
-- 4. Backfill: for already-active shipments, insert ask actions if missing
-- 5. RPCs: po_confirm, po_cancel (grower or buyer; later: buyer counter)
-- ============================================================

begin;

-- 1. state column on purchase_orders
alter table purchase_orders
  add column if not exists state text default 'pending'
    check (state in ('pending','active','cancelled'));

-- 2. po_actions: immutable per-line action history
create table if not exists po_actions (
  id                uuid primary key default gen_random_uuid(),
  po_id             uuid not null references purchase_orders(id) on delete cascade,
  actor_user_id     uuid references users(id) on delete set null,
  actor_company_id  uuid references companies(id) on delete set null,
  action            text not null check (action in ('ask','confirm','cancel','counter')),
  fields_json       jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);
create index if not exists po_actions_po_id_idx     on po_actions(po_id);
create index if not exists po_actions_created_at_idx on po_actions(created_at);

alter table po_actions enable row level security;
grant all on po_actions to authenticated;

-- Read: super admin, buyer side of the line's shipment, or the grower of the line
drop policy if exists po_actions_read on po_actions;
create policy po_actions_read on po_actions for select to authenticated using (
  public.is_super_admin()
  or exists (
    select 1 from purchase_orders po
    join shipments s on s.id = po.shipment_id
    where po.id = po_actions.po_id
      and (
        s.buyer_company_id = public.current_company_id()
        or po.grower_company_id = public.current_company_id()
      )
  )
);
-- No insert/update/delete policies → only SECURITY DEFINER functions can write.

-- 3. Trigger: when shipment goes draft → active, snapshot every line as an 'ask'
create or replace function public.on_shipment_activate()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.status = 'draft' and new.status = 'active' then
    insert into po_actions (po_id, actor_user_id, actor_company_id, action, fields_json)
      select po.id, auth.uid(), new.buyer_company_id, 'ask',
             jsonb_build_object(
               'price_ordered', po.price_ordered, 'stems_ordered', po.stems_ordered, 'stems_per_bunch', po.stems_per_bunch,
               'order_type', po.order_type, 'box_type', po.box_type,
               'product_id', po.product_id, 'grower_company_id', po.grower_company_id
             )
        from purchase_orders po
       where po.shipment_id = new.id;
    update purchase_orders set state = 'pending' where shipment_id = new.id and state is null;
  end if;
  return new;
end $$;

drop trigger if exists shipment_activate_trigger on shipments;
create trigger shipment_activate_trigger
after update on shipments
for each row
execute function public.on_shipment_activate();

-- 4. One-time backfill: for any line in an already-non-draft shipment without an 'ask' action, insert one
insert into po_actions (po_id, actor_user_id, actor_company_id, action, fields_json, created_at)
select po.id, null, s.buyer_company_id, 'ask',
       jsonb_build_object(
         'price_ordered', po.price_ordered, 'stems_ordered', po.stems_ordered, 'stems_per_bunch', po.stems_per_bunch,
         'order_type', po.order_type, 'box_type', po.box_type,
         'product_id', po.product_id, 'grower_company_id', po.grower_company_id
       ),
       coalesce(s.created_at, now())
  from purchase_orders po
  join shipments s on s.id = po.shipment_id
 where s.status <> 'draft'
   and not exists (select 1 from po_actions a where a.po_id = po.id and a.action = 'ask');

-- 5a. po_confirm: grower (or super admin) confirms a pending line
create or replace function public.po_confirm(p_po_id uuid)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  caller_company  uuid;
  caller_is_admin boolean;
  caller_is_super boolean;
  po              record;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  select u.company_id, (u.role = 'admin'), coalesce(u.is_super_admin, false)
    into caller_company, caller_is_admin, caller_is_super
    from users u where u.id = auth.uid();

  select po.*, s.status as shipment_status into po
    from purchase_orders po join shipments s on s.id = po.shipment_id
    where po.id = p_po_id;
  if not found then
    return json_build_object('ok', false, 'error', 'po_not_found');
  end if;

  if not caller_is_super
     and (not coalesce(caller_is_admin, false) or po.grower_company_id is distinct from caller_company) then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  if po.shipment_status <> 'active' then
    return json_build_object('ok', false, 'error', 'shipment_not_active');
  end if;

  if po.state <> 'pending' then
    return json_build_object('ok', false, 'error', 'line_not_pending');
  end if;

  update purchase_orders set state = 'active' where id = p_po_id;

  insert into po_actions (po_id, actor_user_id, actor_company_id, action, fields_json)
    values (p_po_id, auth.uid(), caller_company, 'confirm',
            jsonb_build_object('price_ordered', po.price_ordered, 'stems_ordered', po.stems_ordered, 'stems_per_bunch', po.stems_per_bunch));

  return json_build_object('ok', true);
end $$;
grant execute on function public.po_confirm(uuid) to authenticated;

-- 5b. po_cancel: either side (admin) cancels a line
create or replace function public.po_cancel(p_po_id uuid)
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

  select po.*, s.buyer_company_id into po
    from purchase_orders po join shipments s on s.id = po.shipment_id
    where po.id = p_po_id;
  if not found then
    return json_build_object('ok', false, 'error', 'po_not_found');
  end if;
  buyer_id := po.buyer_company_id;

  if not caller_is_super
     and (not coalesce(caller_is_admin, false)
          or (caller_company is distinct from buyer_id
              and caller_company is distinct from po.grower_company_id)) then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  if po.state = 'cancelled' then
    return json_build_object('ok', false, 'error', 'already_cancelled');
  end if;

  update purchase_orders set state = 'cancelled' where id = p_po_id;

  insert into po_actions (po_id, actor_user_id, actor_company_id, action, fields_json)
    values (p_po_id, auth.uid(), caller_company, 'cancel', '{}'::jsonb);

  return json_build_object('ok', true);
end $$;
grant execute on function public.po_cancel(uuid) to authenticated;

commit;
