-- ============================================================
-- ORIGINS — split users.full_name into first_name + last_name
-- Update accept_invitation RPC to take name parts + allow the
-- invitee to confirm/edit the company name.
-- ============================================================

begin;

-- 1. Add columns
alter table users add column if not exists first_name text;
alter table users add column if not exists last_name  text;

-- 2. Backfill from existing full_name (split on first space; single-word names go to first_name)
update users
   set first_name = case when position(' ' in full_name) > 0
                          then split_part(full_name, ' ', 1)
                          else full_name
                     end,
       last_name  = case when position(' ' in full_name) > 0
                          then trim(substring(full_name from position(' ' in full_name) + 1))
                          else ''
                     end
 where full_name is not null;

-- 3. Drop the old column (no live data; clean break)
alter table users drop column if exists full_name;

-- 4. Replace accept_invitation RPC: take first_name + last_name + optional company_name
drop function if exists public.accept_invitation(uuid, text);
drop function if exists public.accept_invitation(uuid, text, text, text, text);

create or replace function public.accept_invitation(
  t            uuid,
  first_name   text,
  last_name    text,
  company_name text default null,
  country      text default null,
  city         text default null,
  brand_name   text default null
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  inv               company_invitations%rowtype;
  target_company_id uuid;
  user_email        text;
  final_company_name text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'not_signed_in');
  end if;

  select email into user_email from auth.users where id = auth.uid();

  select * into inv from company_invitations
   where token = t and status = 'pending' and expires_at > now()
   for update;
  if not found then
    return json_build_object('ok', false, 'error', 'invalid_or_expired');
  end if;

  if lower(inv.email) <> lower(user_email) then
    return json_build_object('ok', false, 'error', 'email_mismatch');
  end if;

  -- Company name: invitee's input wins; fall back to inviter's value
  final_company_name := coalesce(nullif(trim(company_name), ''), inv.new_company_name);

  if inv.company_id is not null then
    target_company_id := inv.company_id;
  else
    insert into companies (name, type, country, city, brand_name)
      values (final_company_name, inv.new_company_type, country, city, brand_name)
      returning id into target_company_id;
  end if;

  insert into users (id, company_id, role, first_name, last_name, email, is_super_admin)
    values (auth.uid(), target_company_id, 'admin', first_name, last_name, user_email, false)
    on conflict (id) do update set
      company_id = excluded.company_id,
      role       = excluded.role,
      first_name = excluded.first_name,
      last_name  = excluded.last_name,
      email      = excluded.email;

  if inv.inviter_company_id is not null
     and inv.new_company_type in ('grower','logistics') then
    insert into company_relationships (buyer_company_id, partner_company_id, partner_type, status)
      values (inv.inviter_company_id, target_company_id, inv.new_company_type, 'active')
      on conflict do nothing;
  end if;

  update company_invitations set status = 'accepted', accepted_at = now() where id = inv.id;

  return json_build_object('ok', true, 'company_id', target_company_id);
end $$;
grant execute on function public.accept_invitation(uuid, text, text, text, text, text, text) to authenticated;

commit;
