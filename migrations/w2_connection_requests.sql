-- ============================================================
-- ORIGINS — W2 Step 3 + 4
-- Buyer adds an EXISTING grower/logistics by company name →
-- creates a pending connection request.
-- Partner side accepts or declines via RPC.
-- ============================================================

begin;

-- ── 1. Lookup partner by name (case-insensitive exact match) ────────────────
-- Callable only by buyer admins. Filters to grower/logistics. Excludes
-- partners already connected (active OR pending) to the caller's company.
-- Returns minimal info: id, name, brand_name, country, type.
create or replace function public.lookup_partner_by_name(
  partner_name text,
  partner_type text
) returns table (id uuid, name text, brand_name text, country text, type text)
language plpgsql security definer set search_path = public
as $$
declare
  caller_company uuid;
  caller_is_admin_buyer boolean;
begin
  if auth.uid() is null then return; end if;
  if partner_type not in ('grower','logistics') then return; end if;

  select u.company_id,
         (u.role = 'admin' and c.type = 'buyer')
    into caller_company, caller_is_admin_buyer
    from users u join companies c on c.id = u.company_id
   where u.id = auth.uid();

  if not coalesce(caller_is_admin_buyer, false) then return; end if;

  return query
    select c.id, c.name, c.brand_name, c.country, c.type
      from companies c
     where c.type = partner_type
       and (
         lower(c.name)                       = lower(trim(partner_name))
         or lower(coalesce(c.brand_name,'')) = lower(trim(partner_name))
       )
       and not exists (
         select 1 from company_relationships r
          where r.buyer_company_id   = caller_company
            and r.partner_company_id = c.id
            and r.status in ('active','pending')
       );
end $$;
grant execute on function public.lookup_partner_by_name(text, text) to authenticated;


-- ── 2. Create pending connection request (buyer side) ────────────────────────
create or replace function public.create_partner_connection_request(
  target_partner_id uuid
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  caller_company uuid;
  caller_is_admin_buyer boolean;
  ptype text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  select u.company_id,
         (u.role = 'admin' and c.type = 'buyer')
    into caller_company, caller_is_admin_buyer
    from users u join companies c on c.id = u.company_id
   where u.id = auth.uid();

  if not coalesce(caller_is_admin_buyer, false) then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  select type into ptype from companies where id = target_partner_id;
  if ptype is null or ptype not in ('grower','logistics') then
    return json_build_object('ok', false, 'error', 'invalid_partner');
  end if;

  if exists (
    select 1 from company_relationships
     where buyer_company_id   = caller_company
       and partner_company_id = target_partner_id
       and status in ('active','pending')
  ) then
    return json_build_object('ok', false, 'error', 'already_connected');
  end if;

  insert into company_relationships (buyer_company_id, partner_company_id, partner_type, status)
       values (caller_company, target_partner_id, ptype, 'pending');

  return json_build_object('ok', true);
end $$;
grant execute on function public.create_partner_connection_request(uuid) to authenticated;


-- ── 3. Respond to connection request (partner side) ─────────────────────────
-- Only the partner-side admin can change status.
create or replace function public.respond_to_connection_request(
  request_id uuid,
  accept     boolean
) returns json
language plpgsql security definer set search_path = public
as $$
declare
  caller_company uuid;
  caller_is_admin boolean;
  req company_relationships%rowtype;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  select u.company_id, (u.role = 'admin')
    into caller_company, caller_is_admin
    from users u where u.id = auth.uid();

  if not coalesce(caller_is_admin, false) then
    return json_build_object('ok', false, 'error', 'not_authorized');
  end if;

  select * into req
    from company_relationships
   where id = request_id and partner_company_id = caller_company and status = 'pending'
   for update;
  if not found then
    return json_build_object('ok', false, 'error', 'request_not_found');
  end if;

  update company_relationships
     set status = case when accept then 'active' else 'declined' end
   where id = req.id;

  return json_build_object('ok', true);
end $$;
grant execute on function public.respond_to_connection_request(uuid, boolean) to authenticated;


-- ── 4. List pending connection requests directed at current company ──────────
create or replace function public.list_connection_requests()
returns table (
  id                    uuid,
  buyer_company_id      uuid,
  buyer_company_name    text,
  buyer_company_brand   text,
  buyer_company_country text,
  partner_type          text,
  created_at            timestamptz
)
language sql stable security definer set search_path = public
as $$
  select r.id, r.buyer_company_id, c.name, c.brand_name, c.country, r.partner_type, r.created_at
    from company_relationships r
    join companies c on c.id = r.buyer_company_id
   where r.partner_company_id = public.current_company_id()
     and r.status = 'pending'
   order by r.created_at desc
$$;
grant execute on function public.list_connection_requests() to authenticated;

commit;
