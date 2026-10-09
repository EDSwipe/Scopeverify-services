-- Require Supabase AAL2 for configured administrators at the database boundary.
create or replace function public.is_scope_admin()
returns boolean language sql stable security definer set search_path = public set row_security = off
as $$
  select coalesce(auth.jwt() ->> 'aal' = 'aal2', false)
    and (
      coalesce(auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr', false)
      or exists (
        select 1 from public.users u
        where u.id = auth.uid() and u.role = 'admin' and u.is_active = true
      )
    );
$$;

create or replace function public.is_scope_admin_or_moderator()
returns boolean language sql stable security definer set search_path = public set row_security = off
as $$
  select public.is_scope_admin()
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'moderator' and u.is_active = true
    );
$$;

create or replace function public.has_active_work_access()
returns boolean language sql stable security definer set search_path = public set row_security = off
as $$
  select public.is_scope_admin()
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.is_active = true
        and (
          u.role in ('client', 'collaborator', 'moderator')
          or (u.role = 'partner' and exists (
            select 1 from public.partner_profiles p
            where p.user_id = u.id and p.status in ('referenced', 'network')
          ))
        )
    );
$$;

-- Users and account provisioning.
drop policy if exists "Admins can view all users" on public.users;
create policy "Admins can view all users" on public.users for select
  using (public.is_scope_admin());
drop policy if exists "Admins can update users" on public.users;
create policy "Admins can update users" on public.users for update
  using (public.is_scope_admin()) with check (public.is_scope_admin());
drop policy if exists "Configured admin can insert user profiles" on public.users;
create policy "Configured admin can insert user profiles" on public.users for insert to authenticated
  with check (public.is_scope_admin());

-- Missions, assignments, and their documents.
drop policy if exists "Admins can view all missions" on public.missions;
drop policy if exists "Admins and moderators view all missions" on public.missions;
drop policy if exists "Admins view all missions" on public.missions;
create policy "Admins view all missions" on public.missions for select
  using (public.is_scope_admin());
drop policy if exists "Admins can update all missions" on public.missions;
drop policy if exists "Admins and moderators assign partner missions" on public.missions;
drop policy if exists "Admins assign missions" on public.missions;
create policy "Admins assign missions" on public.missions for update
  using (public.is_scope_admin()) with check (public.is_scope_admin());
drop policy if exists "Admins can create missions" on public.missions;
create policy "Admins can create missions" on public.missions for insert
  with check (public.is_scope_admin());

drop policy if exists "Admins can manage assignments" on public.mission_assignments;
create policy "Admins can manage assignments" on public.mission_assignments for all
  using (public.is_scope_admin()) with check (public.is_scope_admin());

drop policy if exists "View mission documents" on public.mission_documents;
create policy "View mission documents" on public.mission_documents for select
  using (
    exists (
      select 1 from public.missions m
      where m.id = mission_id and (m.client_id = auth.uid() or m.assigned_to = auth.uid())
    ) or public.is_scope_admin()
  );
drop policy if exists "Upload mission documents" on public.mission_documents;
create policy "Upload mission documents" on public.mission_documents for insert
  with check (
    exists (
      select 1 from public.missions m
      where m.id = mission_id and (m.client_id = auth.uid() or m.assigned_to = auth.uid())
    ) or public.is_scope_admin()
  );

-- Public CMS and operational records.
drop policy if exists "Only SCOPE VERIFY admin manages site content" on public.site_content;
create policy "Only SCOPE VERIFY admin manages site content" on public.site_content for all
  using (public.is_scope_admin()) with check (public.is_scope_admin());

drop policy if exists "Only SCOPE VERIFY admin can manage pricing" on public.prices;
create policy "Only SCOPE VERIFY admin can manage pricing" on public.prices for all
  using (public.is_scope_admin()) with check (public.is_scope_admin());

drop policy if exists "Only SCOPE VERIFY admin reads requests" on public.contact_requests;
create policy "Only SCOPE VERIFY admin reads requests" on public.contact_requests for select
  using (public.is_scope_admin());
drop policy if exists "Only SCOPE VERIFY admin updates requests" on public.contact_requests;
create policy "Only SCOPE VERIFY admin updates requests" on public.contact_requests for update
  using (public.is_scope_admin()) with check (public.is_scope_admin());
drop policy if exists "Only SCOPE VERIFY admin deletes requests" on public.contact_requests;
create policy "Only SCOPE VERIFY admin deletes requests" on public.contact_requests for delete
  using (public.is_scope_admin());

drop policy if exists "Only SCOPE VERIFY admin reads page views" on public.page_views;
create policy "Only SCOPE VERIFY admin reads page views" on public.page_views for select
  using (public.is_scope_admin());
drop policy if exists "Only SCOPE VERIFY admin manages settings" on public.site_settings;
create policy "Only SCOPE VERIFY admin manages settings" on public.site_settings for all
  using (public.is_scope_admin()) with check (public.is_scope_admin());

drop policy if exists "Admins view account access audit" on public.user_access_audit;
create policy "Admins view account access audit" on public.user_access_audit for select
  using (public.is_scope_admin());

-- Legal documents are readable by active moderators; admin mutations require AAL2.
do $$
begin
  if to_regclass('public.legal_documents') is not null then
    execute 'drop policy if exists "Admins and moderators can view legal documents" on public.legal_documents';
    execute 'drop policy if exists "Admins can insert legal documents" on public.legal_documents';
    execute 'drop policy if exists "Admins can update legal documents" on public.legal_documents';
    execute 'drop policy if exists "Admins can delete legal documents" on public.legal_documents';
    execute $policy$
      create policy "Admins and moderators can view legal documents" on public.legal_documents for select to authenticated
      using (public.is_scope_admin() or exists (
        select 1 from public.users u where u.id = auth.uid() and u.role = 'moderator' and u.is_active = true
      ))
    $policy$;
    execute 'create policy "Admins can insert legal documents" on public.legal_documents for insert to authenticated with check (public.is_scope_admin())';
    execute 'create policy "Admins can update legal documents" on public.legal_documents for update to authenticated using (public.is_scope_admin()) with check (public.is_scope_admin())';
    execute 'create policy "Admins can delete legal documents" on public.legal_documents for delete to authenticated using (public.is_scope_admin())';
  end if;
end;
$$;

notify pgrst, 'reload schema';