-- ============================================================
-- ORIGINS — W2 sub-step: allow company admins to edit their
-- own company. (Splits companies_write into insert/update/delete.)
-- ============================================================

begin;

drop policy if exists companies_write on companies;

create policy companies_insert on companies for insert to authenticated
  with check (public.is_super_admin());

create policy companies_update on companies for update to authenticated
  using (
    public.is_super_admin()
    or (id = public.current_company_id() and exists (
      select 1 from users where id = auth.uid() and role = 'admin'
    ))
  )
  with check (
    public.is_super_admin()
    or (id = public.current_company_id() and exists (
      select 1 from users where id = auth.uid() and role = 'admin'
    ))
  );

create policy companies_delete on companies for delete to authenticated
  using (public.is_super_admin());

commit;
