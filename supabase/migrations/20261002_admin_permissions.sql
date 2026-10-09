-- Fine-grained moderator permissions for the Scope-Verify admin workspace.
-- Additive and safe to re-run after 20261001_partner_network.sql.

alter table public.users
  add column if not exists permissions jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass and conname = 'users_permissions_array_check'
  ) then
    alter table public.users add constraint users_permissions_array_check
      check (jsonb_typeof(permissions) = 'array');
  end if;
end;
$$;

update public.users
set permissions = '["partners.review", "partners.documents"]'::jsonb
where role = 'moderator' and permissions = '[]'::jsonb;

create table if not exists public.user_access_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  action text not null,
  permissions jsonb not null default '[]'::jsonb,
  changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_user_access_audit_user on public.user_access_audit(user_id, created_at desc);
alter table public.user_access_audit enable row level security;
grant select on public.user_access_audit to authenticated;
drop policy if exists "Admins view account access audit" on public.user_access_audit;
create policy "Admins view account access audit" on public.user_access_audit for select
  using (public.is_scope_admin_or_moderator() and auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr');

create or replace function public.is_scope_admin()
returns boolean language sql stable security definer set search_path = public set row_security = off
as $$
  select coalesce(auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr', false)
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin' and u.is_active = true
    );
$$;

create or replace function public.has_scope_permission(permission_key text)
returns boolean language sql stable security definer set search_path = public set row_security = off
as $$
  select public.is_scope_admin()
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'moderator' and u.is_active = true
        and u.permissions @> jsonb_build_array(permission_key)
    );
$$;

-- Only the server-side service-role invitation endpoint may provision other users.
create or replace function public.users_insert_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(auth.role() = 'service_role', false) then return new; end if;
  if public.is_scope_admin() then
    new.is_active := true;
    return new;
  end if;
  if new.id is distinct from auth.uid() then
    raise exception 'Vous ne pouvez créer que votre propre profil';
  end if;
  if new.role not in ('client', 'partner') then
    raise exception 'Rôle non autorisé à l’inscription';
  end if;
  new.permissions := '[]'::jsonb;
  new.is_active := new.role = 'client';
  return new;
end;
$$;

create or replace function public.users_update_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  is_moderator boolean;
begin
  if coalesce(auth.role() = 'service_role', false) then return new; end if;
  if public.is_scope_admin() then
    if new.role = 'moderator' and old.role is distinct from 'moderator' and new.permissions = '[]'::jsonb then
      new.permissions := '["partners.review", "partners.documents"]'::jsonb;
    end if;
    return new;
  end if;

  select exists (
    select 1 from public.users u where u.id = auth.uid() and u.role = 'moderator' and u.is_active
  ) into is_moderator;
  if is_moderator then
    if new.role is distinct from old.role or new.email is distinct from old.email
      or new.full_name is distinct from old.full_name or new.company is distinct from old.company
      or new.permissions is distinct from old.permissions
    then
      raise exception 'Un modérateur ne peut pas modifier les rôles ou permissions';
    end if;
    if new.is_active is distinct from old.is_active and old.role <> 'partner' then
      raise exception 'Un modérateur ne peut modifier que l’activation d’un partenaire';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role or new.is_active is distinct from old.is_active
    or new.email is distinct from old.email or new.permissions is distinct from old.permissions
  then
    raise exception 'Modification non autorisée sur ce champ';
  end if;
  return new;
end;
$$;

-- Protect qualification data and public listing fields from moderator edits.
create or replace function public.partner_profile_update_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(auth.role() = 'service_role', false) or public.is_scope_admin() then return new; end if;

  if new.user_id = auth.uid() and old.user_id = auth.uid() and old.status = 'pending' and new.status = 'pending' then
    if new.is_public is distinct from old.is_public or new.public_name is distinct from old.public_name
      or new.public_summary is distinct from old.public_summary or new.public_domains is distinct from old.public_domains
      or new.public_country is distinct from old.public_country or new.public_area is distinct from old.public_area
      or new.public_website is distinct from old.public_website or new.public_logo_path is distinct from old.public_logo_path
    then
      raise exception 'Un candidat ne peut pas publier sa fiche';
    end if;
    return new;
  end if;

  if public.has_scope_permission('partners.review') then
    if new.user_id is distinct from old.user_id or new.business_name is distinct from old.business_name
      or new.contact_email is distinct from old.contact_email or new.contact_name is distinct from old.contact_name
      or new.qualification_data is distinct from old.qualification_data
      or new.public_name is distinct from old.public_name or new.public_summary is distinct from old.public_summary
      or new.public_domains is distinct from old.public_domains or new.public_country is distinct from old.public_country
      or new.public_area is distinct from old.public_area or new.public_website is distinct from old.public_website
      or new.public_logo_path is distinct from old.public_logo_path or new.is_public is distinct from old.is_public
      or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at
    then
      raise exception 'Un modérateur peut uniquement statuer et ajouter des notes internes';
    end if;
    return new;
  end if;

  raise exception 'Modification non autorisée';
end;
$$;
drop trigger if exists trg_partner_profile_update_guard on public.partner_profiles;
create trigger trg_partner_profile_update_guard before update on public.partner_profiles
for each row execute function public.partner_profile_update_guard();

create or replace function public.partner_document_update_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if coalesce(auth.role() = 'service_role', false) or public.is_scope_admin() then return new; end if;
  if public.has_scope_permission('partners.documents')
    and new.partner_profile_id is not distinct from old.partner_profile_id
    and new.file_path is not distinct from old.file_path
    and new.file_name is not distinct from old.file_name
    and new.uploaded_at is not distinct from old.uploaded_at
    and new.uploaded_by is not distinct from old.uploaded_by
  then
    return new;
  end if;
  raise exception 'Modification du document non autorisée';
end;
$$;
drop trigger if exists trg_partner_document_update_guard on public.partner_documents;
create trigger trg_partner_document_update_guard before update on public.partner_documents
for each row execute function public.partner_document_update_guard();

-- Replace broad moderator access on partner data with permission-specific policies.
drop policy if exists "Admins and moderators manage partner profiles" on public.partner_profiles;
drop policy if exists "Admins manage partner profiles" on public.partner_profiles;
create policy "Admins manage partner profiles" on public.partner_profiles for all
  using (public.is_scope_admin()) with check (public.is_scope_admin());
drop policy if exists "Moderators view partner profiles" on public.partner_profiles;
create policy "Moderators view partner profiles" on public.partner_profiles for select
  using (public.has_scope_permission('partners.review'));
drop policy if exists "Moderators review partner profiles" on public.partner_profiles;
create policy "Moderators review partner profiles" on public.partner_profiles for update
  using (public.has_scope_permission('partners.review'))
  with check (public.has_scope_permission('partners.review'));

-- Admins alone manage the document rows; moderator document rights are limited to expiry/type metadata.
drop policy if exists "Admins and moderators manage partner documents" on public.partner_documents;
drop policy if exists "Admins manage partner documents" on public.partner_documents;
create policy "Admins manage partner documents" on public.partner_documents for all
  using (public.is_scope_admin()) with check (public.is_scope_admin());
drop policy if exists "Moderators view partner documents" on public.partner_documents;
create policy "Moderators view partner documents" on public.partner_documents for select
  using (public.has_scope_permission('partners.review'));
drop policy if exists "Moderators update partner document metadata" on public.partner_documents;
create policy "Moderators update partner document metadata" on public.partner_documents for update
  using (public.has_scope_permission('partners.documents'))
  with check (public.has_scope_permission('partners.documents'));

-- Reviewers may read and append the history; only admins may delete or rewrite it.
drop policy if exists "Admins and moderators read partner history" on public.partner_history;
drop policy if exists "Admins and moderators add partner history" on public.partner_history;
drop policy if exists "Admins manage partner history" on public.partner_history;
create policy "Admins manage partner history" on public.partner_history for all
  using (public.is_scope_admin()) with check (public.is_scope_admin());
drop policy if exists "Moderators read partner history" on public.partner_history;
create policy "Moderators read partner history" on public.partner_history for select
  using (public.has_scope_permission('partners.review'));
drop policy if exists "Moderators append partner history" on public.partner_history;
create policy "Moderators append partner history" on public.partner_history for insert
  with check (public.has_scope_permission('partners.review'));

-- Public assets are selected and maintained by admins only; public reads remain limited to the logo bucket.
drop policy if exists "Admins and moderators manage partner logos" on storage.objects;
drop policy if exists "Admins manage partner logos" on storage.objects;
create policy "Admins manage partner logos" on storage.objects for all to authenticated
  using (bucket_id = 'partner-public-assets' and public.is_scope_admin())
  with check (bucket_id = 'partner-public-assets' and public.is_scope_admin());

drop policy if exists "Admins and moderators manage qualification files" on storage.objects;
drop policy if exists "Admins manage qualification files" on storage.objects;
create policy "Admins manage qualification files" on storage.objects for all to authenticated
  using (bucket_id = 'partner-documents' and public.is_scope_admin())
  with check (bucket_id = 'partner-documents' and public.is_scope_admin());
drop policy if exists "Moderators read partner files" on storage.objects;
create policy "Moderators read partner files" on storage.objects for select to authenticated
  using (bucket_id = 'partner-documents' and public.has_scope_permission('partners.review') and exists (
    select 1 from public.partner_documents d
    join public.partner_profiles p on p.id = d.partner_profile_id
    where d.file_path = storage.objects.name and p.status not in ('rejected', 'suspended')
  ));

-- Moderators see/assign mission records only when each corresponding capability is granted.
drop policy if exists "Admins and moderators view all missions" on public.missions;
drop policy if exists "Admins view all missions" on public.missions;
create policy "Admins view all missions" on public.missions for select using (public.is_scope_admin());
drop policy if exists "Moderators view missions by permission" on public.missions;
create policy "Moderators view missions by permission" on public.missions for select
  using (public.has_scope_permission('missions.view') or public.has_scope_permission('missions.assign'));
drop policy if exists "Admins and moderators assign partner missions" on public.missions;
drop policy if exists "Admins assign missions" on public.missions;
create policy "Admins assign missions" on public.missions for update
  using (public.is_scope_admin()) with check (public.is_scope_admin());
drop policy if exists "Moderators assign missions by permission" on public.missions;
create policy "Moderators assign missions by permission" on public.missions for update
  using (public.has_scope_permission('missions.assign')) with check (public.has_scope_permission('missions.assign'));
drop policy if exists "Moderators manage assignments by permission" on public.mission_assignments;
create policy "Moderators manage assignments by permission" on public.mission_assignments for all
  using (public.has_scope_permission('missions.assign')) with check (public.has_scope_permission('missions.assign'));

create or replace function public.mission_update_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  can_assign boolean;
  can_validate boolean;
begin
  if coalesce(auth.role() = 'service_role', false) or public.is_scope_admin() then return new; end if;
  can_assign := public.has_scope_permission('missions.assign');
  can_validate := public.has_scope_permission('missions.validate');

  if not can_validate and (new.validation_status is distinct from old.validation_status
    or new.validation_notes is distinct from old.validation_notes) then
    raise exception 'Permission de validation de mission requise';
  end if;
  if not can_assign and (new.client_id is distinct from old.client_id
    or new.assigned_to is distinct from old.assigned_to
    or new.partner_profile_id is distinct from old.partner_profile_id) then
    raise exception 'Permission d’affectation de mission requise';
  end if;
  if can_assign and not can_validate and (
    new.title is distinct from old.title or new.description is distinct from old.description
    or new.mission_type is distinct from old.mission_type or new.location is distinct from old.location
    or new.status is distinct from old.status or new.requirements is distinct from old.requirements
    or new.budget is distinct from old.budget or new.requested_deadline is distinct from old.requested_deadline
    or new.validation_status is distinct from old.validation_status
    or new.validation_notes is distinct from old.validation_notes
  ) then
    raise exception 'Un gestionnaire d’affectation peut uniquement affecter la mission';
  end if;

  if new.status = 'completed' and old.status is distinct from new.status then
    new.validation_status := 'pending';
    new.validation_notes := '';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_mission_update_guard on public.missions;
create trigger trg_mission_update_guard before update on public.missions
for each row execute function public.mission_update_guard();

notify pgrst, 'reload schema';
