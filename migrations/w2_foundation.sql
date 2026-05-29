-- ============================================================
-- ORIGINS — Wave 2 foundation
-- Invitations table + RLS + RPC helpers for token lookup and
-- acceptance. Expands company_relationships.status to support
-- the Mutual acceptance flow (pending/declined).
-- ============================================================

begin;

-- 1. Expand relationship status to support mutual acceptance
alter table company_relationships drop constraint if exists company_relationships_status_check;
alter table company_relationships add constraint company_relationships_status_check
  check (status in ('active','inactive','pending','declined'));

-- 2. Invitations table
create table if not exists company_invitations (
  id                  uuid primary key default gen_random_uuid(),
  token               uuid unique not null default gen_random_uuid(),
  email               text not null,
  -- Target: either existing company OR new company being created
  company_id          uuid references companies(id) on delete cascade,
  new_company_name    text,
  new_company_type    text check (new_company_type in ('buyer','grower','logistics')),
  -- Inviter context
  inviter_user_id     uuid references users(id) on delete set null,
  inviter_company_id  uuid references companies(id) on delete cascade,  -- null when super admin invites a new buyer
  -- Lifecycle
  status              text not null default 'pending' check (status in ('pending','accepted','cancelled','expired')),
  expires_at          timestamptz not null default (now() + interval '14 days'),
  created_at          timestamptz not null default now(),
  accepted_at         timestamptz,
  constraint invitation_target_check check (
    (company_id is not null) or
    (new_company_name is not null and new_company_type is not null)
  )
);
create index if not exists company_invitations_token_idx           on company_invitations(token);
create index if not exists company_invitations_email_idx           on company_invitations(email);
create index if not exists company_invitations_inviter_company_idx on company_invitations(inviter_company_id);

grant all on company_invitations to authenticated;
alter table company_invitations enable row level security;

-- 3. Policies
drop policy if exists inv_read on company_invitations;
create policy inv_read on company_invitations for select to authenticated using (
  public.is_super_admin()
  or inviter_user_id    = auth.uid()
  or inviter_company_id = public.current_company_id()
  or (company_id is not null and company_id = public.current_company_id())
);

drop policy if exists inv_insert on company_invitations;
create policy inv_insert on company_invitations for insert to authenticated with check (
  public.is_super_admin()
  or (
    inviter_user_id    = auth.uid()
    and inviter_company_id = public.current_company_id()
    and public.current_company_id() is not null
  )
);

drop policy if exists inv_update on company_invitations;
create policy inv_update on company_invitations for update to authenticated
  using (public.is_super_admin() or inviter_user_id = auth.uid())
  with check (public.is_super_admin() or inviter_user_id = auth.uid());

drop policy if exists inv_delete on company_invitations;
create policy inv_delete on company_invitations for delete to authenticated
  using (public.is_super_admin() or inviter_user_id = auth.uid());

-- 4. Public token-lookup (anonymous; safe because random uuid token is the credential)
create or replace function public.get_invitation_by_token(t uuid)
returns table (
  invitation_id        uuid,
  email                text,
  company_id           uuid,
  new_company_name     text,
  new_company_type     text,
  inviter_company_name text,
  expires_at           timestamptz
) language sql stable security definer set search_path = public
as $$
  select
    i.id, i.email, i.company_id, i.new_company_name, i.new_company_type,
    coalesce(ic.brand_name, ic.name) as inviter_company_name,
    i.expires_at
  from company_invitations i
  left join companies ic on ic.id = i.inviter_company_id
  where i.token = t
    and i.status = 'pending'
    and i.expires_at > now()
$$;
grant execute on function public.get_invitation_by_token(uuid) to anon, authenticated;

-- 5. Accept-invitation RPC (logged-in caller)
create or replace function public.accept_invitation(t uuid, full_name text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  inv               company_invitations%rowtype;
  target_company_id uuid;
  user_email        text;
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

  -- Target company: existing or create new
  if inv.company_id is not null then
    target_company_id := inv.company_id;
  else
    insert into companies (name, type)
      values (inv.new_company_name, inv.new_company_type)
      returning id into target_company_id;
  end if;

  -- Create the public.users row (admin of their company)
  insert into users (id, company_id, role, full_name, email, is_super_admin)
    values (auth.uid(), target_company_id, 'admin', full_name, user_email, false)
    on conflict (id) do update set
      company_id = excluded.company_id,
      role       = excluded.role,
      full_name  = excluded.full_name,
      email      = excluded.email;

  -- Buyer-invites-new-partner: auto-accept the relationship (the invitation is the consent)
  if inv.inviter_company_id is not null
     and inv.new_company_type in ('grower','logistics') then
    insert into company_relationships (buyer_company_id, partner_company_id, partner_type, status)
      values (inv.inviter_company_id, target_company_id, inv.new_company_type, 'active')
      on conflict do nothing;
  end if;

  update company_invitations set status = 'accepted', accepted_at = now() where id = inv.id;

  return json_build_object('ok', true, 'company_id', target_company_id);
end $$;
grant execute on function public.accept_invitation(uuid, text) to authenticated;

commit;
