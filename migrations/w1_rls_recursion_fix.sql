-- ============================================================
-- ORIGINS — RLS recursion fix
-- The W1 policies have mutual references across companies,
-- shipments, and purchase_orders. Postgres' RLS planner detects
-- these as infinite recursion and aborts queries.
--
-- The fix: wrap the cross-table lookups in SECURITY DEFINER
-- functions so the inner queries bypass RLS, breaking the cycle.
-- Policy LOGIC is unchanged — same visibility, same write guards.
-- ============================================================

begin;

-- ─── Helper functions (security definer bypasses RLS inside) ──

create or replace function public.current_is_buyer_of(s_id uuid) returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from shipments
    where shipments.id = s_id
      and shipments.buyer_company_id = public.current_company_id()
  )
$$;

create or replace function public.current_grower_has_line_on(s_id uuid) returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from purchase_orders
    where purchase_orders.shipment_id = s_id
      and purchase_orders.grower_company_id = public.current_company_id()
  )
$$;

create or replace function public.shipment_past_draft(s_id uuid) returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from shipments where id = s_id and status <> 'draft'
  )
$$;

create or replace function public.current_logistics_is_on(s_id uuid) returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from shipments s
    where s.id = s_id and (
         s.cargo_agent_id   = public.current_company_id()
      or s.airline_id       = public.current_company_id()
      or s.customs_agent_id = public.current_company_id()
      or s.trucking_id      = public.current_company_id()
      or s.handling_id      = public.current_company_id()
    )
  )
$$;

create or replace function public.current_logistics_sees_grower(g_id uuid) returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from shipments s
    join purchase_orders po on po.shipment_id = s.id
    where (s.cargo_agent_id   = public.current_company_id()
        or s.airline_id       = public.current_company_id()
        or s.customs_agent_id = public.current_company_id()
        or s.trucking_id      = public.current_company_id()
        or s.handling_id      = public.current_company_id())
      and po.grower_company_id = g_id
  )
$$;

grant execute on function public.current_is_buyer_of(uuid)            to authenticated;
grant execute on function public.current_grower_has_line_on(uuid)     to authenticated;
grant execute on function public.shipment_past_draft(uuid)            to authenticated;
grant execute on function public.current_logistics_is_on(uuid)        to authenticated;
grant execute on function public.current_logistics_sees_grower(uuid)  to authenticated;

-- ─── Rebuild policies using helpers ────────────────────────────

drop policy if exists shipments_read on shipments;
create policy shipments_read on shipments for select to authenticated using (
  public.is_super_admin()
  or (public.current_company_type() = 'buyer'
        and buyer_company_id = public.current_company_id())
  or (public.current_company_type() = 'grower'
        and status <> 'draft'
        and public.current_grower_has_line_on(shipments.id))
  or (public.current_company_type() = 'logistics' and (
         cargo_agent_id   = public.current_company_id()
      or airline_id       = public.current_company_id()
      or customs_agent_id = public.current_company_id()
      or trucking_id      = public.current_company_id()
      or handling_id      = public.current_company_id()))
);

drop policy if exists po_read on purchase_orders;
create policy po_read on purchase_orders for select to authenticated using (
  public.is_super_admin()
  or (public.current_company_type() = 'buyer'
        and public.current_is_buyer_of(purchase_orders.shipment_id))
  or (public.current_company_type() = 'grower'
        and grower_company_id = public.current_company_id()
        and public.shipment_past_draft(purchase_orders.shipment_id))
);

drop policy if exists po_write on purchase_orders;
create policy po_write on purchase_orders for all to authenticated
  using (
    public.is_super_admin()
    or (public.current_company_type() = 'buyer'
          and public.current_is_buyer_of(purchase_orders.shipment_id))
  )
  with check (
    public.is_super_admin()
    or (
      public.current_company_type() = 'buyer'
      and public.current_is_buyer_of(purchase_orders.shipment_id)
      and (purchase_orders.grower_company_id is null
           or public.has_relationship(purchase_orders.grower_company_id, 'grower'))
    )
  );

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
      or public.current_logistics_sees_grower(companies.id)
  ))
);

drop policy if exists claims_read on claims;
create policy claims_read on claims for select to authenticated using (
  public.is_super_admin()
  or (public.current_company_type() = 'buyer'
        and public.current_is_buyer_of(claims.shipment_id))
  or (public.current_company_type() = 'grower'
        and grower_company_id = public.current_company_id())
);

drop policy if exists claims_write on claims;
create policy claims_write on claims for all to authenticated
  using (
    public.is_super_admin()
    or (public.current_company_type() = 'buyer'
          and public.current_is_buyer_of(claims.shipment_id))
  )
  with check (
    public.is_super_admin()
    or (public.current_company_type() = 'buyer'
          and public.current_is_buyer_of(claims.shipment_id))
  );

drop policy if exists doc_read on shipment_documents;
create policy doc_read on shipment_documents for select to authenticated using (
  public.is_super_admin()
  or (public.current_company_type() = 'buyer'
        and public.current_is_buyer_of(shipment_documents.shipment_id))
  or (public.current_company_type() = 'grower'
        and shipment_documents.grower_company_id = public.current_company_id())
  or (public.current_company_type() = 'logistics'
        and public.current_logistics_is_on(shipment_documents.shipment_id))
);

drop policy if exists doc_write on shipment_documents;
create policy doc_write on shipment_documents for all to authenticated
  using (
    public.is_super_admin()
    or (public.current_company_type() = 'buyer'
          and public.current_is_buyer_of(shipment_documents.shipment_id))
  )
  with check (
    public.is_super_admin()
    or (public.current_company_type() = 'buyer'
          and public.current_is_buyer_of(shipment_documents.shipment_id))
  );

commit;
