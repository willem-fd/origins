-- ============================================================
-- ORIGINS — Wave 1 RLS pass
-- Adds buyer_company_id to shipments, drops leftover agency
-- template tables, replaces interim "auth all" policies with
-- proper role-aware Row Level Security.
--
-- Visibility model:
--   super admin   → sees and writes everything
--   buyer         → own shipments + lines on them; own templates
--   grower        → only their own PO lines on non-Draft shipments
--   logistics     → shipments where they're one of the 5 logistics
--                   FKs; PO lines are DENIED
-- ============================================================

begin;

-- ─── 1. Schema additions ───────────────────────────────────────
-- Shipments need a buyer owner so RLS has something to filter on.
alter table shipments
  add column if not exists buyer_company_id uuid references companies(id) on delete set null;
create index if not exists shipments_buyer_company_id_idx on shipments(buyer_company_id);

-- Drop the agency's old (empty) template tables — we use po_templates now.
drop table if exists template_items;
drop table if exists shipment_templates;

-- ─── 2. Helper functions ───────────────────────────────────────
-- security definer so they bypass RLS while looking up the caller's own profile.
create or replace function public.is_super_admin() returns boolean
  language sql stable security definer set search_path = public
as $$ select coalesce((select is_super_admin from users where id = auth.uid()), false) $$;

create or replace function public.current_company_id() returns uuid
  language sql stable security definer set search_path = public
as $$ select company_id from users where id = auth.uid() $$;

create or replace function public.current_company_type() returns text
  language sql stable security definer set search_path = public
as $$ select c.type from users u join companies c on c.id = u.company_id where u.id = auth.uid() $$;

grant execute on function public.is_super_admin()      to authenticated;
grant execute on function public.current_company_id()  to authenticated;
grant execute on function public.current_company_type() to authenticated;

-- ─── 3. Ensure GRANTs are in place (lesson from po_templates) ──
grant usage on schema public to authenticated;
grant all on companies, users, shipments, purchase_orders,
            grower_products, products, claims, shipment_documents,
            po_templates, po_template_items,
            company_addresses, company_bank_accounts, company_contacts
  to authenticated;

-- packing_list_items may or may not exist depending on history; grant defensively
do $$ begin
  if to_regclass('public.packing_list_items') is not null then
    execute 'grant all on packing_list_items to authenticated';
  end if;
end $$;

-- ─── 4. Enable RLS on every relevant table ─────────────────────
alter table companies              enable row level security;
alter table users                  enable row level security;
alter table shipments              enable row level security;
alter table purchase_orders        enable row level security;
alter table grower_products        enable row level security;
alter table products               enable row level security;
alter table claims                 enable row level security;
alter table shipment_documents     enable row level security;
alter table po_templates           enable row level security;
alter table po_template_items      enable row level security;
alter table company_addresses      enable row level security;
alter table company_bank_accounts  enable row level security;
alter table company_contacts       enable row level security;

do $$ begin
  if to_regclass('public.packing_list_items') is not null then
    execute 'alter table packing_list_items enable row level security';
  end if;
end $$;

-- ─── 5. Drop ALL existing policies so we start clean ───────────
-- (idempotent re-run support; lists every policy we may have created)
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'companies','users','shipments','purchase_orders','grower_products','products',
        'claims','shipment_documents','po_templates','po_template_items',
        'company_addresses','company_bank_accounts','company_contacts','packing_list_items'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- ─── 6. companies: directory — readable by all authenticated, written by super admin ──
create policy companies_read on companies for select to authenticated using (true);
create policy companies_write on companies for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ─── 7. users: see self + same-company teammates; super admin sees all ──
create policy users_read on users for select to authenticated using (
  public.is_super_admin()
  or id = auth.uid()
  or company_id = public.current_company_id()
);
create policy users_update on users for update to authenticated
  using (public.is_super_admin() or id = auth.uid())
  with check (public.is_super_admin() or id = auth.uid());
create policy users_insert_super on users for insert to authenticated
  with check (public.is_super_admin());
create policy users_delete_super on users for delete to authenticated
  using (public.is_super_admin());

-- ─── 8. shipments ──────────────────────────────────────────────
create policy shipments_read on shipments for select to authenticated using (
  public.is_super_admin()
  or (public.current_company_type() = 'buyer'
        and buyer_company_id = public.current_company_id())
  or (public.current_company_type() = 'grower'
        and status <> 'draft'
        and exists (
          select 1 from purchase_orders po
          where po.shipment_id = shipments.id
            and po.grower_company_id = public.current_company_id()
        ))
  or (public.current_company_type() = 'logistics'
        and (
             cargo_agent_id   = public.current_company_id()
          or airline_id       = public.current_company_id()
          or customs_agent_id = public.current_company_id()
          or trucking_id      = public.current_company_id()
          or handling_id      = public.current_company_id()
        ))
);
create policy shipments_insert on shipments for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.current_company_type() = 'buyer'
          and buyer_company_id = public.current_company_id())
  );
create policy shipments_update on shipments for update to authenticated
  using (
    public.is_super_admin()
    or (public.current_company_type() = 'buyer'
          and buyer_company_id = public.current_company_id())
  )
  with check (
    public.is_super_admin()
    or (public.current_company_type() = 'buyer'
          and buyer_company_id = public.current_company_id())
  );
create policy shipments_delete on shipments for delete to authenticated
  using (
    public.is_super_admin()
    or (public.current_company_type() = 'buyer'
          and buyer_company_id = public.current_company_id())
  );

-- ─── 9. purchase_orders ────────────────────────────────────────
-- Reads: super admin; buyer of the shipment; grower for own lines on non-draft shipments.
-- Logistics: not in this policy → denied.
create policy po_read on purchase_orders for select to authenticated using (
  public.is_super_admin()
  or (public.current_company_type() = 'buyer' and exists (
        select 1 from shipments s
        where s.id = purchase_orders.shipment_id
          and s.buyer_company_id = public.current_company_id()))
  or (public.current_company_type() = 'grower'
        and grower_company_id = public.current_company_id()
        and exists (
          select 1 from shipments s
          where s.id = purchase_orders.shipment_id and s.status <> 'draft'
        ))
);
create policy po_write on purchase_orders for all to authenticated
  using (
    public.is_super_admin()
    or (public.current_company_type() = 'buyer' and exists (
          select 1 from shipments s
          where s.id = purchase_orders.shipment_id
            and s.buyer_company_id = public.current_company_id()))
  )
  with check (
    public.is_super_admin()
    or (public.current_company_type() = 'buyer' and exists (
          select 1 from shipments s
          where s.id = purchase_orders.shipment_id
            and s.buyer_company_id = public.current_company_id()))
  );

-- ─── 10. po_templates / po_template_items: per-company ────────
create policy po_templates_all on po_templates for all to authenticated
  using (public.is_super_admin() or company_id = public.current_company_id())
  with check (public.is_super_admin() or company_id = public.current_company_id());

create policy po_template_items_all on po_template_items for all to authenticated
  using (public.is_super_admin() or exists (
    select 1 from po_templates t
    where t.id = template_id and t.company_id = public.current_company_id()))
  with check (public.is_super_admin() or exists (
    select 1 from po_templates t
    where t.id = template_id and t.company_id = public.current_company_id()));

-- ─── 11. products: master catalogue — all read, super admin writes ──
create policy products_read on products for select to authenticated using (true);
create policy products_write on products for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ─── 12. grower_products: grower owns its catalogue ────────────
create policy grower_products_read on grower_products for select to authenticated using (true);
create policy grower_products_write on grower_products for all to authenticated
  using (public.is_super_admin() or company_id = public.current_company_id())
  with check (public.is_super_admin() or company_id = public.current_company_id());

-- ─── 13. claims: buyer ↔ grower, attached to a shipment ────────
create policy claims_read on claims for select to authenticated using (
  public.is_super_admin()
  or exists (select 1 from shipments s
             where s.id = claims.shipment_id
               and public.current_company_type() = 'buyer'
               and s.buyer_company_id = public.current_company_id())
  or (public.current_company_type() = 'grower' and grower_company_id = public.current_company_id())
);
create policy claims_write on claims for all to authenticated
  using (
    public.is_super_admin()
    or exists (select 1 from shipments s
               where s.id = claims.shipment_id
                 and public.current_company_type() = 'buyer'
                 and s.buyer_company_id = public.current_company_id())
  )
  with check (
    public.is_super_admin()
    or exists (select 1 from shipments s
               where s.id = claims.shipment_id
                 and public.current_company_type() = 'buyer'
                 and s.buyer_company_id = public.current_company_id())
  );

-- ─── 14. shipment_documents: visibility follows the shipment ──
create policy doc_read on shipment_documents for select to authenticated using (
  public.is_super_admin()
  or exists (select 1 from shipments s where s.id = shipment_documents.shipment_id and (
       (public.current_company_type()='buyer'     and s.buyer_company_id = public.current_company_id())
    or (public.current_company_type()='grower'    and shipment_documents.grower_company_id = public.current_company_id())
    or (public.current_company_type()='logistics' and (
           s.cargo_agent_id   = public.current_company_id()
        or s.airline_id       = public.current_company_id()
        or s.customs_agent_id = public.current_company_id()
        or s.trucking_id      = public.current_company_id()
        or s.handling_id      = public.current_company_id()))
  ))
);
-- W1 writes: super admin or buyer (grower/logistics upload comes in W3/W4).
create policy doc_write on shipment_documents for all to authenticated
  using (
    public.is_super_admin()
    or exists (select 1 from shipments s
               where s.id = shipment_documents.shipment_id
                 and public.current_company_type()='buyer'
                 and s.buyer_company_id = public.current_company_id())
  )
  with check (
    public.is_super_admin()
    or exists (select 1 from shipments s
               where s.id = shipment_documents.shipment_id
                 and public.current_company_type()='buyer'
                 and s.buyer_company_id = public.current_company_id())
  );

-- ─── 15. company_addresses / bank_accounts / contacts ─────────
-- Read: super admin + own company. Write: super admin + own company.
create policy addr_read on company_addresses for select to authenticated
  using (public.is_super_admin() or company_id = public.current_company_id());
create policy addr_write on company_addresses for all to authenticated
  using (public.is_super_admin() or company_id = public.current_company_id())
  with check (public.is_super_admin() or company_id = public.current_company_id());

create policy bank_read on company_bank_accounts for select to authenticated
  using (public.is_super_admin() or company_id = public.current_company_id());
create policy bank_write on company_bank_accounts for all to authenticated
  using (public.is_super_admin() or company_id = public.current_company_id())
  with check (public.is_super_admin() or company_id = public.current_company_id());

create policy contact_read on company_contacts for select to authenticated
  using (public.is_super_admin() or company_id = public.current_company_id());
create policy contact_write on company_contacts for all to authenticated
  using (public.is_super_admin() or company_id = public.current_company_id())
  with check (public.is_super_admin() or company_id = public.current_company_id());

-- ─── 16. packing_list_items (conservative: super admin only until used) ──
do $$ begin
  if to_regclass('public.packing_list_items') is not null then
    execute $p$ create policy pli_super on packing_list_items for all to authenticated
                using (public.is_super_admin()) with check (public.is_super_admin()) $p$;
  end if;
end $$;

commit;
