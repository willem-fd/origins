-- ============================================================
-- ORIGINS — W3 Phase 2: buyer edit triggers
-- INSERT: new line on non-draft shipment → initial 'ask' action
-- UPDATE: buyer edit after grower action → new 'ask' + reset to pending
--          buyer edit before grower action → sync the existing ask
-- Grower's edits (via po_counter RPC) are skipped: trigger only fires for
-- edits where caller's company == shipment.buyer_company_id.
-- ============================================================

begin;

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
              'price_ordered',   new.price_ordered,
              'stems_ordered',   new.stems_ordered,
              'stems_per_bunch', new.stems_per_bunch
            ));
  return new;
end $$;

drop trigger if exists po_buyer_insert_trigger on purchase_orders;
create trigger po_buyer_insert_trigger
after insert on purchase_orders
for each row
execute function public.on_po_buyer_insert();


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
      'price_ordered',   new.price_ordered,
      'stems_ordered',   new.stems_ordered,
      'stems_per_bunch', new.stems_per_bunch
    ) where id = last_action.id;
    return new;
  end if;

  insert into po_actions (po_id, actor_user_id, actor_company_id, action, fields_json)
    values (new.id, auth.uid(), buyer_id, 'ask',
            jsonb_build_object(
              'price_ordered',   new.price_ordered,
              'stems_ordered',   new.stems_ordered,
              'stems_per_bunch', new.stems_per_bunch
            ));
  new.state := 'pending';
  return new;
end $$;

drop trigger if exists po_buyer_update_trigger on purchase_orders;
create trigger po_buyer_update_trigger
before update on purchase_orders
for each row
execute function public.on_po_buyer_update();

commit;
