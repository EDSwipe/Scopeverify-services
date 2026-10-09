-- Central, versioned document library. Existing mission/legal/partner files remain separate.
-- Requires public.is_scope_admin(), public.users and Supabase Storage.

create table if not exists public.document_library_categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_library_categories_key_check check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint document_library_categories_name_check check (char_length(btrim(name)) between 2 and 120)
);

create table if not exists public.document_library_documents (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  category_id uuid not null references public.document_library_categories(id) on delete restrict,
  title text not null,
  description text not null default '',
  kind text not null default 'downloadable',
  audience text not null default 'admin',
  status text not null default 'draft',
  published_version_id uuid,
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_library_documents_key_check check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint document_library_documents_title_check check (char_length(btrim(title)) between 2 and 200),
  constraint document_library_documents_description_check check (char_length(description) <= 5000),
  constraint document_library_documents_kind_check check (kind in ('downloadable', 'generated_template', 'digital_form', 'reference')),
  constraint document_library_documents_audience_check check (audience in ('public', 'authenticated', 'admin')),
  constraint document_library_documents_status_check check (status in ('draft', 'published', 'archived')),
  constraint document_library_documents_publication_check check (
    (status = 'published' and published_version_id is not null)
    or (status in ('draft', 'archived') and (published_version_id is null or status = 'archived'))
  )
);

create table if not exists public.document_library_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.document_library_documents(id) on delete restrict,
  version_number integer not null,
  file_name text not null,
  storage_bucket text not null default 'document-library',
  storage_path text not null unique,
  mime_type text not null,
  file_size bigint,
  sha256 text,
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint document_library_versions_document_number_key unique (document_id, version_number),
  constraint document_library_versions_document_id_key unique (document_id, id),
  constraint document_library_versions_number_check check (version_number > 0),
  constraint document_library_versions_file_name_check check (char_length(btrim(file_name)) between 1 and 255),
  constraint document_library_versions_mime_type_check check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg', 'image/png', 'image/webp'
  )),
  constraint document_library_versions_bucket_check check (storage_bucket in ('document-library', 'legal-documents')),
  constraint document_library_versions_size_check check (
    (storage_bucket = 'document-library' and file_size between 1 and 3145728)
    or (storage_bucket = 'legal-documents' and (file_size is null or file_size between 1 and 10485760))
  ),
  constraint document_library_versions_sha256_check check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  constraint document_library_versions_path_check check (
    (storage_bucket = 'document-library' and storage_path like '%/' || document_id::text || '/v' || version_number::text || '-%')
    or storage_bucket = 'legal-documents'
  )
);

alter table public.document_library_documents
  drop constraint if exists document_library_documents_published_version_fkey;
alter table public.document_library_documents
  add constraint document_library_documents_published_version_fkey
  foreign key (id, published_version_id)
  references public.document_library_versions(document_id, id)
  on delete restrict;

create table if not exists public.document_library_usages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.document_library_documents(id) on delete restrict,
  consumer_type text not null,
  consumer_key text not null,
  label text not null,
  version_id uuid,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint document_library_usages_document_consumer_key unique (document_id, consumer_type, consumer_key),
  constraint document_library_usages_type_check check (consumer_type in (
    'form', 'mission', 'mission_request', 'page', 'workflow', 'report', 'partner', 'other'
  )),
  constraint document_library_usages_consumer_key_check check (char_length(btrim(consumer_key)) between 1 and 200),
  constraint document_library_usages_label_check check (char_length(btrim(label)) between 1 and 200),
  constraint document_library_usages_version_fkey foreign key (document_id, version_id)
    references public.document_library_versions(document_id, id) on delete restrict
);

create table if not exists public.document_library_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.document_library_documents(id) on delete set null,
  category_id uuid references public.document_library_categories(id) on delete set null,
  version_id uuid references public.document_library_versions(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  actor_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint document_library_events_type_check check (event_type in (
    'category_created', 'category_updated', 'document_created', 'metadata_updated',
    'version_added', 'published', 'archived', 'usage_added', 'usage_removed'
  ))
);

create index if not exists idx_document_library_categories_active on public.document_library_categories(is_active, sort_order);
create index if not exists idx_document_library_documents_category_status on public.document_library_documents(category_id, status, updated_at desc);
create index if not exists idx_document_library_versions_document on public.document_library_versions(document_id, version_number desc);
create index if not exists idx_document_library_usages_document on public.document_library_usages(document_id);
create index if not exists idx_document_library_events_document on public.document_library_events(document_id, created_at desc);

insert into public.document_library_categories(key, name, sort_order) values
  ('mission-requests', 'Demandes de mission', 10),
  ('authorizations-mandates', 'Autorisations et mandats', 20),
  ('operational-mission-documents', 'Documents opérationnels de mission', 30),
  ('reports-deliverables', 'Rapports et livrables', 40),
  ('client-administrative-documents', 'Documents clients et administratifs', 50),
  ('partner-documents', 'Documents partenaires', 60)
on conflict (key) do nothing;

create or replace function public.document_library_set_metadata()
returns trigger language plpgsql security definer set search_path = public set row_security = off
as $$
begin
  if coalesce(current_setting('app.document_library_import', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.updated_by := auth.uid();
    new.created_at := now();
  else
    new.updated_by := auth.uid();
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create or replace function public.document_library_guard_document()
returns trigger language plpgsql security definer set search_path = public set row_security = off
as $$
declare
  managed_status boolean := coalesce(current_setting('app.document_library_managed_status', true), '') = 'on';
begin
  if tg_op = 'UPDATE' and (
    new.id is distinct from old.id
    or new.key is distinct from old.key
    or ((new.status is distinct from old.status or new.published_version_id is distinct from old.published_version_id) and not managed_status)
  ) then
    raise exception 'Identifiant, statut et version publiée gérés par les fonctions de la bibliothèque';
  end if;
  return new;
end;
$$;

create or replace function public.document_library_guard_version()
returns trigger language plpgsql security definer set search_path = public set row_security = off
as $$
declare
  expected_number integer;
begin
  if tg_op = 'INSERT' and coalesce(current_setting('app.document_library_import', true), '') = 'on' then
    return new;
  end if;
  if tg_op <> 'INSERT' then
    raise exception 'Les versions de documents sont immuables';
  end if;
  perform 1 from public.document_library_documents where id = new.document_id for update;
  if not found then
    raise exception 'Document introuvable';
  end if;
  select coalesce(max(version_number), 0) + 1 into expected_number
  from public.document_library_versions where document_id = new.document_id;
  if new.version_number is distinct from expected_number then
    raise exception 'Numéro de version inattendu : attendu %', expected_number;
  end if;
  new.uploaded_by := auth.uid();
  new.created_at := now();
  return new;
end;
$$;

create or replace function public.document_library_log_changes()
returns trigger language plpgsql security definer set search_path = public set row_security = off
as $$
declare
  action text;
  details_value jsonb;
begin
  if tg_table_name = 'document_library_categories' then
    action := case when tg_op = 'INSERT' then 'category_created' else 'category_updated' end;
    insert into public.document_library_events(category_id, event_type, details, actor_id)
    values (new.id, action, jsonb_build_object('key', new.key, 'name', new.name, 'is_active', new.is_active), auth.uid());
    return null;
  elsif tg_table_name = 'document_library_versions' then
    insert into public.document_library_events(document_id, version_id, event_type, details, actor_id)
    values (new.document_id, new.id, 'version_added', jsonb_build_object(
      'version_number', new.version_number, 'file_name', new.file_name, 'mime_type', new.mime_type,
      'file_size', new.file_size, 'sha256', new.sha256
    ), auth.uid());
    return null;
  elsif tg_table_name = 'document_library_usages' then
    action := case when tg_op = 'INSERT' then 'usage_added' else 'usage_removed' end;
    insert into public.document_library_events(document_id, event_type, details, actor_id)
    values (coalesce(new.document_id, old.document_id), action,
      jsonb_build_object('consumer_type', coalesce(new.consumer_type, old.consumer_type),
        'consumer_key', coalesce(new.consumer_key, old.consumer_key), 'label', coalesce(new.label, old.label)), auth.uid());
    return null;
  end if;

  if tg_op = 'INSERT' then
    insert into public.document_library_events(document_id, event_type, details, actor_id)
    values (new.id, 'document_created', jsonb_build_object('key', new.key, 'title', new.title), auth.uid());
    return null;
  end if;

  if new.status is distinct from old.status then
    action := case when new.status = 'published' then 'published' else 'archived' end;
    details_value := jsonb_build_object('from_status', old.status, 'to_status', new.status,
      'published_version_id', new.published_version_id);
    insert into public.document_library_events(document_id, event_type, details, actor_id)
    values (new.id, action, details_value, auth.uid());
  elsif (new.category_id, new.title, new.description, new.kind, new.audience)
    is distinct from (old.category_id, old.title, old.description, old.kind, old.audience) then
    insert into public.document_library_events(document_id, event_type, details, actor_id)
    values (new.id, 'metadata_updated', jsonb_build_object(
      'category_id', new.category_id, 'title', new.title, 'description', new.description,
      'kind', new.kind, 'audience', new.audience
    ), auth.uid());
  end if;
  return null;
end;
$$;

drop trigger if exists trg_document_library_categories_metadata on public.document_library_categories;
create trigger trg_document_library_categories_metadata before insert or update on public.document_library_categories
for each row execute function public.document_library_set_metadata();
drop trigger if exists trg_document_library_documents_metadata on public.document_library_documents;
create trigger trg_document_library_documents_metadata before insert or update on public.document_library_documents
for each row execute function public.document_library_set_metadata();
drop trigger if exists trg_document_library_documents_guard on public.document_library_documents;
create trigger trg_document_library_documents_guard before update on public.document_library_documents
for each row execute function public.document_library_guard_document();
drop trigger if exists trg_document_library_versions_guard on public.document_library_versions;
create trigger trg_document_library_versions_guard before insert or update or delete on public.document_library_versions
for each row execute function public.document_library_guard_version();
drop trigger if exists trg_document_library_categories_audit on public.document_library_categories;
create trigger trg_document_library_categories_audit after insert or update on public.document_library_categories
for each row execute function public.document_library_log_changes();
drop trigger if exists trg_document_library_documents_audit on public.document_library_documents;
create trigger trg_document_library_documents_audit after insert or update on public.document_library_documents
for each row execute function public.document_library_log_changes();
drop trigger if exists trg_document_library_versions_audit on public.document_library_versions;
create trigger trg_document_library_versions_audit after insert on public.document_library_versions
for each row execute function public.document_library_log_changes();
drop trigger if exists trg_document_library_usages_audit on public.document_library_usages;
create trigger trg_document_library_usages_audit after insert or delete on public.document_library_usages
for each row execute function public.document_library_log_changes();

-- Import existing legal metadata without moving or deleting its private Storage objects.
do $$
begin
  if to_regclass('public.legal_documents') is not null then
    perform set_config('app.document_library_import', 'on', true);
    execute $import_documents$
      insert into public.document_library_documents(id, key, category_id, title, description, kind, audience, status)
      select l.id,
        'legal-' || l.type || '-' || l.id::text,
        c.id,
        case l.type
          when 'mentions_legales' then 'Mentions légales'
          when 'cgu' then 'Conditions générales d’utilisation'
          when 'cgv' then 'Conditions générales de vente'
          when 'rgpd' then 'Politique de confidentialité'
          when 'cookies' then 'Politique de cookies'
          else 'Document juridique'
        end,
        '', 'downloadable', 'admin', 'draft'
      from public.legal_documents l
      cross join public.document_library_categories c
      where c.key = 'client-administrative-documents'
        and not exists (select 1 from public.document_library_documents d where d.id = l.id)
    $import_documents$;

    execute $import_versions$
      insert into public.document_library_versions(
        document_id, version_number, file_name, storage_bucket, storage_path, mime_type,
        file_size, sha256, uploaded_by, created_at
      )
      select l.id, 1, l.file_name, 'legal-documents', l.file_path, 'application/pdf',
        null, null, l.updated_by, coalesce(l.updated_at, l.created_at, now())
      from public.legal_documents l
      join public.document_library_documents d on d.id = l.id
      where not exists (select 1 from public.document_library_versions v where v.document_id = l.id)
    $import_versions$;

    perform set_config('app.document_library_managed_status', 'on', true);
    update public.document_library_documents d
    set status = 'published', published_version_id = v.id,
      created_by = l.updated_by, updated_by = l.updated_by, updated_at = coalesce(l.updated_at, l.created_at, now())
    from public.legal_documents l
    join public.document_library_versions v on v.document_id = l.id and v.version_number = 1
    where d.id = l.id and d.status = 'draft';
    perform set_config('app.document_library_managed_status', 'off', true);
    perform set_config('app.document_library_import', 'off', true);
  end if;
end;
$$;

do $$
declare
  legacy_bucket storage.buckets%rowtype;
begin
  if exists (select 1 from public.document_library_versions where storage_bucket = 'legal-documents') then
    select * into legacy_bucket from storage.buckets where id = 'legal-documents';
    if not found then
      raise exception 'Le bucket legal-documents est introuvable; vérifier les fichiers historiques avant de poursuivre';
    end if;
    if legacy_bucket.public then
      raise exception 'Le bucket legal-documents est public; le rendre privé avant de poursuivre';
    end if;
  end if;
end;
$$;

create or replace function public.publish_document_library_version(p_document_id uuid, p_version_id uuid)
returns public.document_library_documents
language plpgsql security definer set search_path = public set row_security = off
as $$
declare
  result public.document_library_documents;
begin
  if not public.is_scope_admin() then
    raise exception 'Accès réservé à l’administrateur' using errcode = '42501';
  end if;
  if not exists (select 1 from public.document_library_versions v where v.id = p_version_id and v.document_id = p_document_id) then
    raise exception 'Cette version ne correspond pas au document';
  end if;
  perform set_config('app.document_library_managed_status', 'on', true);
  update public.document_library_documents
  set status = 'published', published_version_id = p_version_id
  where id = p_document_id
  returning * into result;
  if not found then
    perform set_config('app.document_library_managed_status', 'off', true);
    raise exception 'Document introuvable';
  end if;
  perform set_config('app.document_library_managed_status', 'off', true);
  return result;
end;
$$;

create or replace function public.archive_document_library_document(p_document_id uuid)
returns public.document_library_documents
language plpgsql security definer set search_path = public set row_security = off
as $$
declare
  result public.document_library_documents;
begin
  if not public.is_scope_admin() then
    raise exception 'Accès réservé à l’administrateur' using errcode = '42501';
  end if;
  perform set_config('app.document_library_managed_status', 'on', true);
  update public.document_library_documents set status = 'archived'
  where id = p_document_id returning * into result;
  if not found then
    perform set_config('app.document_library_managed_status', 'off', true);
    raise exception 'Document introuvable';
  end if;
  perform set_config('app.document_library_managed_status', 'off', true);
  return result;
end;
$$;

revoke all on function public.publish_document_library_version(uuid, uuid) from public, anon;
revoke all on function public.archive_document_library_document(uuid) from public, anon;
grant execute on function public.publish_document_library_version(uuid, uuid) to authenticated;
grant execute on function public.archive_document_library_document(uuid) to authenticated;

alter table public.document_library_categories enable row level security;
alter table public.document_library_documents enable row level security;
alter table public.document_library_versions enable row level security;
alter table public.document_library_usages enable row level security;
alter table public.document_library_events enable row level security;

revoke all on public.document_library_categories, public.document_library_documents,
  public.document_library_versions, public.document_library_usages, public.document_library_events
  from public, anon, authenticated;
grant select, insert, update on public.document_library_categories to authenticated;
grant select on public.document_library_documents to authenticated;
grant insert (key, category_id, title, description, kind, audience, created_by, updated_by)
  on public.document_library_documents to authenticated;
grant update (category_id, title, description, kind, audience)
  on public.document_library_documents to authenticated;
grant select, insert on public.document_library_versions to authenticated;
grant select, insert, delete on public.document_library_usages to authenticated;
grant select on public.document_library_events to authenticated;
grant all on public.document_library_categories, public.document_library_documents,
  public.document_library_versions, public.document_library_usages, public.document_library_events
  to service_role;

drop policy if exists "Admins manage document library categories" on public.document_library_categories;
create policy "Admins manage document library categories" on public.document_library_categories
  for all to authenticated using (public.is_scope_admin()) with check (public.is_scope_admin());
drop policy if exists "Admins read document library documents" on public.document_library_documents;
create policy "Admins read document library documents" on public.document_library_documents
  for select to authenticated using (public.is_scope_admin());
drop policy if exists "Admins create document library documents" on public.document_library_documents;
create policy "Admins create document library documents" on public.document_library_documents
  for insert to authenticated with check (public.is_scope_admin());
drop policy if exists "Admins update document library documents" on public.document_library_documents;
create policy "Admins update document library documents" on public.document_library_documents
  for update to authenticated using (public.is_scope_admin()) with check (public.is_scope_admin());
drop policy if exists "Admins read document library versions" on public.document_library_versions;
create policy "Admins read document library versions" on public.document_library_versions
  for select to authenticated using (public.is_scope_admin());
drop policy if exists "Admins add document library versions" on public.document_library_versions;
create policy "Admins add document library versions" on public.document_library_versions
  for insert to authenticated with check (public.is_scope_admin());
drop policy if exists "Admins manage document library usages" on public.document_library_usages;
create policy "Admins manage document library usages" on public.document_library_usages
  for all to authenticated using (public.is_scope_admin()) with check (public.is_scope_admin());
drop policy if exists "Admins read document library events" on public.document_library_events;
create policy "Admins read document library events" on public.document_library_events
  for select to authenticated using (public.is_scope_admin());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('document-library', 'document-library', false, 3145728, array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg', 'image/png', 'image/webp'
])
on conflict (id) do nothing;

do $$
declare
  bucket storage.buckets%rowtype;
begin
  select * into bucket from storage.buckets where id = 'document-library';
  if not found or bucket.public
    or bucket.file_size_limit is distinct from 3145728
    or bucket.allowed_mime_types is distinct from array[
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg', 'image/png', 'image/webp'
    ] then
    raise exception 'Le bucket document-library doit être privé et respecter les formats et la limite configurés';
  end if;
end;
$$;

drop policy if exists "Admins read document library storage" on storage.objects;
create policy "Admins read document library storage" on storage.objects for select to authenticated
  using (bucket_id = 'document-library' and public.is_scope_admin());
drop policy if exists "Admins upload document library storage" on storage.objects;
create policy "Admins upload document library storage" on storage.objects for insert to authenticated
  with check (bucket_id = 'document-library' and public.is_scope_admin());

notify pgrst, 'reload schema';