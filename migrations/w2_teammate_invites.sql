-- ============================================================
-- ORIGINS — W2 Step 5: teammate invitations
-- 1. Add target_role to company_invitations
-- 2. Update get_invitation_by_token to return target_role
-- 3. Update accept_invitation to use it (admin for new-company,
--    target_role for teammate invites; default 'regular')
-- 4. Loosen users_read RLS so company members see each other
-- ============================================================

begin;

-- 1. target_role on invitation row
alter table company_invitations
  add column if not exists target_role text default 'regular'
    check (target_role in ('admin','regular'));

-- 2. Replace get_invitation_by_token to expose target_role
create or replace function public.get_invitation_by_token(t uuid)
returns table (
  invitation_id        uuid,
  email                text,
  company_id           uuid,
  new_company_name     text,
  new_company_type     text,
  inviter_company_name text,
  target_role          text,
  expires_at           timestamptz
) language sql stable security definer set search_path = public
as $$
  select
    i.id, i.email, i.company_id, i.new_company_name, i.new_company_type,
    coalesce(ic.brand_name, ic.name) as inviter_company_name,
    i.target_role,
    i.expires_at
  from company_invitations i
  left join companies ic on ic.id = i.inviter_company_id
  where i.token = t
    and i.status = 'pending'
    and i.expires_at > now()
$$;
grant execute on function public.get_invitation_by_token(uuid) to anon, authenticated;

-- 3. Replace accept_invitation to use target_role
drop function if exists public.accept_invitation(uuid, text, text, text, text, text, text);

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
  inv                company_invitations%rowtype;
  target_company_id  uuid;
  user_email         text;
  final_company_name text;
  user_role          text;
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

  final_company_name := coalesce(nullif(trim(company_name), ''), inv.new_company_name);

  if inv.company_id is not null then
    -- Teammate joining existing company
    target_company_id := inv.company_id;
    user_role         := coalesce(inv.target_role, 'regular');
  else
    -- New company creation: invitee becomes the admin
    insert into companies (name, type, country, city, brand_name)
      values (final_company_name, inv.new_company_type, country, city, brand_name)
      returning id into target_company_id;
    user_role := 'admin';
  end if;

  insert into users (id, company_id, role, first_name, last_name, email, is_super_admin)
    values (auth.uid(), target_company_id, user_role, first_name, last_name, user_email, false)
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

-- 4. Loosen users_read so same-company users can see each other
drop policy if exists users_read on users;
create policy users_read on users for select to authenticated using (
  public.is_super_admin()
  or id = auth.uid()
  or (company_id is not null and company_id = public.current_company_id())
);

commit;
