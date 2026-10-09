-- Scope-Verify partner network and qualification workflow.
-- Additive and safe to re-run after the existing mission and security migrations.

alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
	check (role in ('admin', 'moderator', 'client', 'collaborator', 'partner'));

alter table public.missions
	add column if not exists requested_deadline date,
	add column if not exists partner_profile_id uuid;

create table if not exists public.partner_profiles (
	id uuid primary key default gen_random_uuid(),
	user_id uuid unique references public.users(id) on delete set null,
	business_name text not null,
	contact_email text not null,
	contact_name text not null,
	qualification_data jsonb not null default '{}'::jsonb,
	status text not null default 'pending'
		check (status in ('pending', 'to_qualify', 'under_review', 'referenced', 'network', 'rejected', 'suspended')),
	internal_notes text not null default '',
	public_name text,
	public_summary text,
	public_domains text[] not null default '{}',
	public_country text,
	public_area text,
	public_website text,
	public_logo_path text,
	is_public boolean not null default false,
	created_by uuid references public.users(id) on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- The public projection contains no application email, qualifications or internal notes.
create table if not exists public.partner_public_directory (
	id uuid primary key references public.partner_profiles(id) on delete cascade,
	public_name text not null,
	public_summary text not null default '',
	public_domains text[] not null default '{}',
	public_country text not null default '',
	public_area text not null default '',
	public_website text not null default '',
	public_logo_path text not null default '',
	is_visible boolean not null default false
);

alter table public.missions drop constraint if exists missions_partner_profile_id_fkey;
alter table public.missions add constraint missions_partner_profile_id_fkey
	foreign key (partner_profile_id) references public.partner_profiles(id) on delete set null;

create table if not exists public.partner_documents (
	id uuid primary key default gen_random_uuid(),
	partner_profile_id uuid not null references public.partner_profiles(id) on delete cascade,
	file_path text not null,
	file_name text not null,
	document_type text not null,
	issued_at date,
	expires_at date,
	uploaded_at timestamptz not null default now(),
	uploaded_by uuid references public.users(id) on delete set null
);

create table if not exists public.partner_history (
	id uuid primary key default gen_random_uuid(),
	partner_profile_id uuid not null references public.partner_profiles(id) on delete cascade,
	event text not null,
	details text not null default '',
	created_by uuid references public.users(id) on delete set null,
	created_at timestamptz not null default now()
);

create index if not exists idx_partner_profiles_status on public.partner_profiles(status);
create index if not exists idx_partner_profiles_business on public.partner_profiles(business_name);
create index if not exists idx_partner_documents_partner on public.partner_documents(partner_profile_id);
create index if not exists idx_partner_history_partner on public.partner_history(partner_profile_id, created_at desc);
create index if not exists idx_missions_partner_profile on public.missions(partner_profile_id);

create or replace function public.is_scope_admin_or_moderator()
returns boolean language sql stable security definer set search_path = public set row_security = off
as $$
	select coalesce(auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr', false)
		or exists (
			select 1 from public.users u
			where u.id = auth.uid() and u.role in ('admin', 'moderator') and u.is_active = true
		);
$$;

create or replace function public.has_active_work_access()
returns boolean language sql stable security definer set search_path = public set row_security = off
as $$
	select coalesce(auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr', false)
		or exists (
			select 1 from public.users u
			where u.id = auth.uid() and u.is_active = true
				and (u.role <> 'partner' or exists (
					select 1 from public.partner_profiles p
					where p.user_id = u.id and p.status in ('referenced', 'network')
				))
		);
$$;

-- Preserve the existing self-signup roles; partner accounts start inactive.
create or replace function public.users_insert_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
	if auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr' then
		new.is_active := true;
		return new;
	end if;
	if new.id is distinct from auth.uid() then
		raise exception 'Vous ne pouvez créer que votre propre profil';
	end if;
	if new.role not in ('client', 'partner') then
		raise exception 'Rôle non autorisé à l’inscription';
	end if;
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
	if auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr' then return new; end if;
	select exists (
		select 1 from public.users u where u.id = auth.uid() and u.role = 'moderator' and u.is_active
	) into is_moderator;
	if is_moderator then
		if new.role is distinct from old.role or new.email is distinct from old.email
			or new.full_name is distinct from old.full_name or new.company is distinct from old.company
		then
			raise exception 'Un modérateur ne peut modifier que l’activation d’un partenaire';
		end if;
		if new.is_active is distinct from old.is_active and old.role <> 'partner' then
			raise exception 'Un modérateur ne peut activer que les partenaires';
		end if;
		return new;
	end if;
	if new.role is distinct from old.role or new.is_active is distinct from old.is_active
		or new.email is distinct from old.email
	then
		raise exception 'Modification non autorisée sur ce champ';
	end if;
	return new;
end;
$$;

-- Extend the original mission guard to the moderator role without weakening client/collaborator protections.
create or replace function public.mission_update_guard()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
	can_manage_missions boolean;
begin
	can_manage_missions := public.is_scope_admin_or_moderator();

	if not can_manage_missions then
		if new.validation_status is distinct from old.validation_status
			or new.validation_notes is distinct from old.validation_notes
		then
			raise exception 'Seul un administrateur ou modérateur peut modifier la validation';
		end if;

		if new.client_id is distinct from old.client_id
			or new.assigned_to is distinct from old.assigned_to
			or new.partner_profile_id is distinct from old.partner_profile_id
		then
			raise exception 'Seul un administrateur ou modérateur peut réaffecter cette mission';
		end if;
	end if;

	if new.status = 'completed' and old.status is distinct from new.status then
		new.validation_status := 'pending';
		new.validation_notes := '';
	end if;

	return new;
end;
$$;

drop trigger if exists trg_users_insert_guard on public.users;
create trigger trg_users_insert_guard before insert on public.users
for each row execute function public.users_insert_guard();
drop trigger if exists trg_users_update_guard on public.users;
create trigger trg_users_update_guard before update on public.users
for each row execute function public.users_update_guard();
drop trigger if exists trg_mission_update_guard on public.missions;
create trigger trg_mission_update_guard before update on public.missions
for each row execute function public.mission_update_guard();

create or replace function public.sync_partner_access()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
	if new.user_id is not null then
		update public.users set is_active = (new.status in ('referenced', 'network'))
		where id = new.user_id and role = 'partner';
	end if;
	return new;
end;
$$;
drop trigger if exists trg_sync_partner_access on public.partner_profiles;
create trigger trg_sync_partner_access after insert or update of status on public.partner_profiles
for each row execute function public.sync_partner_access();

create or replace function public.sync_partner_public_directory()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
	insert into public.partner_public_directory (
		id, public_name, public_summary, public_domains, public_country, public_area,
		public_website, public_logo_path, is_visible
	) values (
		new.id, coalesce(nullif(new.public_name, ''), new.business_name), coalesce(new.public_summary, ''),
		coalesce(new.public_domains, '{}'), coalesce(new.public_country, ''), coalesce(new.public_area, ''),
		coalesce(new.public_website, ''), coalesce(new.public_logo_path, ''), new.status = 'network' and new.is_public
	) on conflict (id) do update set
		public_name = excluded.public_name, public_summary = excluded.public_summary,
		public_domains = excluded.public_domains, public_country = excluded.public_country,
		public_area = excluded.public_area, public_website = excluded.public_website,
		public_logo_path = excluded.public_logo_path, is_visible = excluded.is_visible;
	return new;
end;
$$;
drop trigger if exists trg_sync_partner_public_directory on public.partner_profiles;
create trigger trg_sync_partner_public_directory
after insert or update of status, public_name, public_summary, public_domains, public_country,
	public_area, public_website, public_logo_path, is_public
on public.partner_profiles for each row execute function public.sync_partner_public_directory();

create or replace function public.log_partner_status_change()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
	if tg_op = 'INSERT' then
		insert into public.partner_history(partner_profile_id, event, details, created_by)
		values(new.id, 'application_received', 'Fiche partenaire reçue', auth.uid());
	elsif new.status is distinct from old.status then
		insert into public.partner_history(partner_profile_id, event, details, created_by)
		values(new.id, 'status_changed', old.status || ' -> ' || new.status, auth.uid());
	end if;
	return new;
end;
$$;
drop trigger if exists trg_log_partner_status_change on public.partner_profiles;
create trigger trg_log_partner_status_change after insert or update of status on public.partner_profiles
for each row execute function public.log_partner_status_change();

alter table public.partner_profiles enable row level security;
alter table public.partner_public_directory enable row level security;
alter table public.partner_documents enable row level security;
alter table public.partner_history enable row level security;
grant select, insert, update, delete on public.partner_profiles to authenticated;
grant select on public.partner_public_directory to anon, authenticated;
grant select, insert, update, delete on public.partner_documents to authenticated;
grant select, insert on public.partner_history to authenticated;

-- The original users table has no self-insert policy. Add restricted signup and admin provisioning.
drop policy if exists "Users can insert own allowed profile" on public.users;
create policy "Users can insert own allowed profile" on public.users for insert to authenticated
	with check (auth.uid() = id and role in ('client', 'partner'));
drop policy if exists "Configured admin can insert user profiles" on public.users;
create policy "Configured admin can insert user profiles" on public.users for insert to authenticated
	with check (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr');

drop policy if exists "Partner users read own profile" on public.partner_profiles;
create policy "Partner users read own profile" on public.partner_profiles for select using (user_id = auth.uid());
drop policy if exists "Partner applicants create own profile" on public.partner_profiles;
create policy "Partner applicants create own profile" on public.partner_profiles for insert
	with check (user_id = auth.uid() and status = 'pending');
drop policy if exists "Partner users update own pending profile" on public.partner_profiles;
create policy "Partner users update own pending profile" on public.partner_profiles for update
	using (user_id = auth.uid() and status = 'pending')
	with check (user_id = auth.uid() and status = 'pending');
drop policy if exists "Admins and moderators manage partner profiles" on public.partner_profiles;
create policy "Admins and moderators manage partner profiles" on public.partner_profiles for all
	using (public.is_scope_admin_or_moderator()) with check (public.is_scope_admin_or_moderator());
drop policy if exists "Public sees selected network partners" on public.partner_profiles;
drop policy if exists "Public sees only selected directory fields" on public.partner_public_directory;
create policy "Public sees only selected directory fields" on public.partner_public_directory for select
	using (is_visible = true);

drop policy if exists "Applicants read own partner documents" on public.partner_documents;
create policy "Applicants read own partner documents" on public.partner_documents for select using (
	exists (select 1 from public.partner_profiles p where p.id = partner_profile_id
		and p.user_id = auth.uid() and p.status not in ('rejected', 'suspended'))
);
drop policy if exists "Applicants upload own partner documents" on public.partner_documents;
create policy "Applicants upload own partner documents" on public.partner_documents for insert with check (
	exists (select 1 from public.partner_profiles p where p.id = partner_profile_id
		and p.user_id = auth.uid() and p.status = 'pending')
);
drop policy if exists "Admins and moderators manage partner documents" on public.partner_documents;
create policy "Admins and moderators manage partner documents" on public.partner_documents for all
	using (public.is_scope_admin_or_moderator()) with check (public.is_scope_admin_or_moderator());
drop policy if exists "Admins and moderators read partner history" on public.partner_history;
create policy "Admins and moderators read partner history" on public.partner_history for select
	using (public.is_scope_admin_or_moderator());
drop policy if exists "Admins and moderators add partner history" on public.partner_history;
create policy "Admins and moderators add partner history" on public.partner_history for insert
	with check (public.is_scope_admin_or_moderator());

-- Deny mission and document operations to inactive accounts and unvalidated partners.
drop policy if exists "Active account workflow guard missions" on public.missions;
create policy "Active account workflow guard missions" on public.missions as restrictive for all to authenticated
	using (public.has_active_work_access()) with check (public.has_active_work_access());
drop policy if exists "Active account workflow guard assignments" on public.mission_assignments;
create policy "Active account workflow guard assignments" on public.mission_assignments as restrictive for all to authenticated
	using (public.has_active_work_access()) with check (public.has_active_work_access());
drop policy if exists "Active account workflow guard mission documents" on public.mission_documents;
create policy "Active account workflow guard mission documents" on public.mission_documents as restrictive for all to authenticated
	using (public.has_active_work_access()) with check (public.has_active_work_access());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('partner-documents', 'partner-documents', false, 15728640,
	array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
drop policy if exists "Partner applicants upload qualification files" on storage.objects;
create policy "Partner applicants upload qualification files" on storage.objects for insert to authenticated
	with check (bucket_id = 'partner-documents' and exists (
		select 1 from public.partner_profiles p where p.user_id = auth.uid() and p.status = 'pending'
			and storage.objects.name like p.id::text || '/%'
	));
drop policy if exists "Partner applicants read qualification files" on storage.objects;
create policy "Partner applicants read qualification files" on storage.objects for select to authenticated
	using (bucket_id = 'partner-documents' and exists (
		select 1 from public.partner_profiles p where p.user_id = auth.uid()
			and p.status not in ('rejected', 'suspended') and storage.objects.name like p.id::text || '/%'
	));
drop policy if exists "Admins and moderators manage qualification files" on storage.objects;
create policy "Admins and moderators manage qualification files" on storage.objects for all to authenticated
	using (bucket_id = 'partner-documents' and public.is_scope_admin_or_moderator())
	with check (bucket_id = 'partner-documents' and public.is_scope_admin_or_moderator());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('partner-public-assets', 'partner-public-assets', true, 5242880,
	array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;
drop policy if exists "Public reads selected partner logos" on storage.objects;
create policy "Public reads selected partner logos" on storage.objects for select to anon, authenticated
	using (bucket_id = 'partner-public-assets');
drop policy if exists "Admins and moderators manage partner logos" on storage.objects;
create policy "Admins and moderators manage partner logos" on storage.objects for all to authenticated
	using (bucket_id = 'partner-public-assets' and public.is_scope_admin_or_moderator())
	with check (bucket_id = 'partner-public-assets' and public.is_scope_admin_or_moderator());

-- Update only the untouched legacy CMS copy; preserve edits made by an administrator.
do $$
begin
	if to_regclass('public.site_content') is not null then
		update public.site_content
		set content = case
			when key = 'positioning_title' and language = 'fr' then 'La compétence adaptée à chaque mission.'
			when key = 'positioning_title' and language = 'en' then 'The right expertise for each mission.'
			when key = 'positioning_text' and language = 'fr' then 'Scope-Verify qualifie chaque demande. Lorsqu’une compétence spécialisée est requise, la mission est confiée à un partenaire adapté et sa restitution est organisée par Scope-Verify.'
			when key = 'positioning_text' and language = 'en' then 'Scope-Verify qualifies each request. When specialist expertise is required, the work is assigned to a suitable partner and its findings are coordinated by Scope-Verify.'
		end,
		updated_at = now()
		where section = 'limits'
			and ((key = 'positioning_title' and content in ('Un constat terrain, pas un audit.', 'A field observation, not an audit.'))
				or (key = 'positioning_text' and content in (
					'Nous documentons les points convenus et observables au moment de la visite. La mission ne certifie pas la conformité globale d’un fournisseur et ne garantit pas ses performances futures.',
					'We document the agreed points that can be observed during the visit. The mission does not certify a supplier’s overall compliance or guarantee future performance.'
				)));
	end if;
end;
$$;

notify pgrst, 'reload schema';