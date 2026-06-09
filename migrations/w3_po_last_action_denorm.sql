-- ============================================================
-- ORIGINS — W3 Phase 2: denormalize last_action onto purchase_orders
-- Adds last_action_at + last_action_by_company so the frontend can
-- compute "whose turn it is" per line without joining po_actions.
-- Maintained by a trigger on po_actions insert.
-- ============================================================

begin;

alter table purchase_orders
  add column if not exists last_action_at         timestamptz,
  add column if not exists last_action_by_company uuid references companies(id) on delete set null;

create index if not exists purchase_orders_last_action_idx
  on purchase_orders(last_action_at desc);

-- Backfill from existing po_actions (latest action per po wins)
update purchase_orders po set
  last_action_at         = la.created_at,
  last_action_by_company = la.actor_company_id
from (
  select distinct on (po_id) po_id, created_at, actor_company_id
  from po_actions
  order by po_id, created_at desc
) la
where la.po_id = po.id;

-- Trigger: keep the denorm in sync on every po_actions insert
create or replace function public.sync_po_last_action()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update purchase_orders
    set last_action_at         = new.created_at,
        last_action_by_company = new.actor_company_id
  where id = new.po_id;
  return new;
end $$;

drop trigger if exists po_actions_sync_last on po_actions;
create trigger po_actions_sync_last
after insert on po_actions
for each row
execute function public.sync_po_last_action();

commit;
