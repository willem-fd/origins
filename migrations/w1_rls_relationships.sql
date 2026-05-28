-- ============================================================
-- ORIGINS — Wave 1 RLS, relationships iteration
-- Replaces the loose companies/grower_products visibility with
-- an explicit company_relationships table (the buyer's "list").
-- Also closes the write-side back-door: a buyer can't add a
-- grower to a PO line or a logistics company to a shipment
-- unless they're on the buyer's relationship list.
-- ============================================================

begin;

-- 1. Relationship table
create table if not exists company_relationships (
  id uuid primary key default gen_random_uuid(),
  buyer_company_id    uuid not null references companies(id) on delete cascade,
  partner_company_id  uuid not null references companies(id) on delete cascade,
  partner_type        text not null check (partner_type in ('grower','logistics')),
  status              text not null default 'active' check (status in ('active','inactive')),
  created_at          timestamptz not null default now(),
  unique(buyer_company_id, partner_company_id, partner_type)
);
create index if not exists company_relationships_buyer_idx   on company_relationships(buyer_company_id);
create index if not exists company_relationships_partner_idx on company_relationships(partner_company_id);

grant all on company_relationships to authenticated;
alter table company_relationships enable row level security;

drop policy if exists rel_read on company_relationships;
create policy rel_read on company_relationships for select to authenticated using (
  public.is_super_admin()
  or buyer_company_id   = public.current_company_id()
  or partner_company_id = public.current_company_id()
);
drop policy if exists rel_write on company_relationships;
create policy rel_write on company_relationships for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- 2. Helper: is this company on my list as X?
create or replace function public.has_relationship(partner_id uuid, ptype text) returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from company_relationships r
    where r.buyer_company_id   = public.current_company_id()
      and r.partner_company_id = partner_id
      and r.partner_type       = ptype
      and r.status             = 'active'
  )
$$;
grant execute on function public.has_relationship(uuid, text) to authenticated;

-- 3. Tightened companies_read
drop policy if exists companies_read on companies;
create policy companies_read on companies for select to authenticated using (
  public.is_super_admin()
  or id = public.current_company_id()
  or (public.current_company_type() = 'buyer' and exists (
      select 1 from company_relationships r
      where r.buyer_company_id   = public.current_company_id()
        and r.partner_company_id = companies.id
        and r.status             = 'active'))
  or (public.current_company_type() = 'grower' and exists (
      select 1 from company_relationships r
      where r.partner_company_id = public.current_company_id()
        and r.buyer_company_id   = companies.id
        and r.partner_type       = 'grower'
        and r.status             = 'active'))
  or (public.current_company_type() = 'logistics' and (
      exists (
        select 1 from company_relationships r
        where r.partner_company_id = public.current_company_id()
          and r.buyer_company_id   = companies.id
          and r.partner_type       = 'logistics'
          and r.status             = 'active'
      )
      or exists (
        select 1 from shipments s
        join purchase_orders po on po.shipment_id = s.id
        where (s.cargo_agent_id   = public.current_company_id()
            or s.airline_id       = public.current_company_id()
            or s.customs_agent_id = public.current_company_id()
            or s.trucking_id      = public.current_company_id()
            or s.handling_id      = public.current_company_id())
          and po.grower_company_id = companies.id
      )
  ))
);

-- 4. Tightened grower_products_read
drop policy if exists grower_products_read on grower_products;
create policy grower_products_read on grower_products for select to authenticated using (
  public.is_super_admin()
  or company_id = public.current_company_id()
  or (public.current_company_type() = 'buyer'
      and public.has_relationship(grower_products.company_id, 'grower'))
);

-- 5. Write-side defence
drop policy if exists po_write on purchase_orders;
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
    or (
      public.current_company_type() = 'buyer'
      and exists (select 1 from shipments s
                  where s.id = purchase_orders.shipment_id
                    and s.buyer_company_id = public.current_company_id())
      and (purchase_orders.grower_company_id is null
           or public.has_relationship(purchase_orders.grower_company_id, 'grower'))
    )
  );

drop policy if exists shipments_insert on shipments;
create policy shipments_insert on shipments for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      public.current_company_type() = 'buyer'
      and buyer_company_id = public.current_company_id()
      and (cargo_agent_id   is null or public.has_relationship(cargo_agent_id,   'logistics'))
      and (airline_id       is null or public.has_relationship(airline_id,       'logistics'))
      and (customs_agent_id is null or public.has_relationship(customs_agent_id, 'logistics'))
      and (trucking_id      is null or public.has_relationship(trucking_id,      'logistics'))
      and (handling_id      is null or public.has_relationship(handling_id,      'logistics'))
    )
  );

drop policy if exists shipments_update on shipments;
create policy shipments_update on shipments for update to authenticated
  using (
    public.is_super_admin()
    or (public.current_company_type() = 'buyer'
        and buyer_company_id = public.current_company_id())
  )
  with check (
    public.is_super_admin()
    or (
      public.current_company_type() = 'buyer'
      and buyer_company_id = public.current_company_id()
      and (cargo_agent_id   is null or public.has_relationship(cargo_agent_id,   'logistics'))
      and (airline_id       is null or public.has_relationship(airline_id,       'logistics'))
      and (customs_agent_id is null or public.has_relationship(customs_agent_id, 'logistics'))
      and (trucking_id      is null or public.has_relationship(trucking_id,      'logistics'))
      and (handling_id      is null or public.has_relationship(handling_id,      'logistics'))
    )
  );

-- 6. Seed Test Buyer's relationships
insert into company_relationships (buyer_company_id, partner_company_id, partner_type)
select
  (select id from companies where name = 'Test Buyer Co'     and type = 'buyer'),
  (select id from companies where name = 'Test Grower Co'    and type = 'grower'),
  'grower'
on conflict do nothing;

insert into company_relationships (buyer_company_id, partner_company_id, partner_type)
select
  (select id from companies where name = 'Test Buyer Co'     and type = 'buyer'),
  (select id from companies where name = 'Test Logistics Co' and type = 'logistics'),
  'logistics'
on conflict do nothing;

commit;
