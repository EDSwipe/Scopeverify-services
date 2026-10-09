-- Mission request intake V1: requests, attachment metadata and status history.
-- Rows are inserted by the server (service role). Admins read and manage the workflow through RLS.
-- Requires public.is_scope_admin() (latest definition: 20261007), public.users and public.missions.

create sequence if not exists public.mission_request_reference_seq;

create table if not exists public.mission_requests (
  id uuid not null default gen_random_uuid(),
  reference text not null,
  status text not null default 'new',
  client_id uuid,
  requester_name text not null,
  contact_name text not null,
  contact_role text,
  email text not null,
  phone text,
  country text not null,
  domain text not null,
  description text not null,
  questions jsonb not null default '[]'::jsonb,
  questions_free_text text,
  multi_site boolean not null default false,
  sites jsonb not null,
  deadline_option text not null default 'no_urgency',
  desired_date date,
  additional_info text,
  consent_authorized boolean not null,
  consent_text_version text not null,
  consent_at timestamptz not null default now(),
  ip_hash text,
  internal_notes text not null default '',
  pdf_path text,
  pdf_sha256 text,
  pdf_generated_at timestamptz,
  converted_mission_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mission_requests_pkey primary key (id),
  constraint mission_requests_reference_key unique (reference),
  constraint mission_requests_client_id_fkey foreign key (client_id) references public.users(id) on delete set null,
  constraint mission_requests_converted_mission_id_fkey foreign key (converted_mission_id) references public.missions(id) on delete restrict,
  constraint mission_requests_status_check
    check (status in ('new', 'to_qualify', 'info_requested', 'proposal_sent', 'accepted', 'declined', 'converted', 'archived')),
  constraint mission_requests_requester_name_check check (char_length(btrim(requester_name)) between 2 and 200),
  constraint mission_requests_contact_name_check check (char_length(btrim(contact_name)) between 2 and 200),
  constraint mission_requests_contact_role_check check (contact_role is null or char_length(contact_role) <= 200),
  constraint mission_requests_email_check
    check (char_length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint mission_requests_phone_check check (phone is null or char_length(phone) <= 50),
  constraint mission_requests_country_check check (char_length(btrim(country)) between 2 and 100),
  constraint mission_requests_domain_check
    check (domain in ('investment_financing', 'company_supplier', 'real_estate_construction', 'stock_goods',
      'commerce_distribution', 'project_infrastructure', 'international_development', 'other')),
  constraint mission_requests_description_check check (char_length(btrim(description)) between 10 and 5000),
  constraint mission_requests_questions_check
    check (case when jsonb_typeof(questions) = 'array' then jsonb_array_length(questions) <= 50 else false end),
  constraint mission_requests_questions_free_text_check
    check (questions_free_text is null or char_length(questions_free_text) <= 5000),
  constraint mission_requests_sites_check
    check (case when jsonb_typeof(sites) = 'array' then jsonb_array_length(sites) between 1 and 20 else false end),
  constraint mission_requests_deadline_option_check
    check (deadline_option in ('no_urgency', 'within_7_days', 'within_3_days', 'urgent')),
  constraint mission_requests_additional_info_check check (additional_info is null or char_length(additional_info) <= 5000),
  constraint mission_requests_consent_authorized_check check (consent_authorized),
  constraint mission_requests_consent_text_version_check check (char_length(btrim(consent_text_version)) between 1 and 50),
  constraint mission_requests_ip_hash_check check (ip_hash is null or char_length(ip_hash) <= 128),
  constraint mission_requests_internal_notes_check check (char_length(internal_notes) <= 10000),
  constraint mission_requests_pdf_sha256_check check (pdf_sha256 is null or pdf_sha256 ~ '^[0-9a-f]{64}$'),
  constraint mission_requests_single_site_check
    check (case when jsonb_typeof(sites) = 'array' then multi_site or jsonb_array_length(sites) = 1 else false end),
  constraint mission_requests_pdf_complete_check check (num_nonnulls(pdf_path, pdf_sha256, pdf_generated_at) in (0, 3)),
  constraint mission_requests_pdf_path_check check (pdf_path is null or pdf_path like id::text || '/pdf/%'),
  constraint mission_requests_converted_requires_link_check check (status <> 'converted' or converted_mission_id is not null),
  constraint mission_requests_link_requires_converted_check check (converted_mission_id is null or status in ('converted', 'archived'))
);

create table if not exists public.mission_request_files (
  id uuid not null default gen_random_uuid(),
  request_id uuid not null,
  file_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null,
  uploaded_at timestamptz not null default now(),
  constraint mission_request_files_pkey primary key (id),
  constraint mission_request_files_file_path_key unique (file_path),
  constraint mission_request_files_request_id_fkey foreign key (request_id) references public.mission_requests(id) on delete restrict,
  constraint mission_request_files_file_name_check check (char_length(btrim(file_name)) between 1 and 255),
  constraint mission_request_files_mime_type_check check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  constraint mission_request_files_file_size_check check (file_size > 0 and file_size <= 10485760),
  constraint mission_request_files_path_check check (file_path like request_id::text || '/files/%')
);

create table if not exists public.mission_request_events (
  id uuid not null default gen_random_uuid(),
  request_id uuid not null,
  event_type text not null,
  from_status text,
  to_status text,
  reason text,
  details jsonb not null default '{}'::jsonb,
  actor_id uuid,
  created_at timestamptz not null default now(),
  constraint mission_request_events_pkey primary key (id),
  constraint mission_request_events_request_id_fkey foreign key (request_id) references public.mission_requests(id) on delete cascade,
  constraint mission_request_events_actor_id_fkey foreign key (actor_id) references public.users(id) on delete set null,
  constraint mission_request_events_event_type_check check (event_type in ('created', 'status_changed', 'data_corrected')),
  constraint mission_request_events_from_status_check
    check (from_status is null or from_status in ('new', 'to_qualify', 'info_requested', 'proposal_sent', 'accepted', 'declined', 'converted', 'archived')),
  constraint mission_request_events_to_status_check
    check (to_status is null or to_status in ('new', 'to_qualify', 'info_requested', 'proposal_sent', 'accepted', 'declined', 'converted', 'archived'))
);

-- CREATE TABLE IF NOT EXISTS leaves an existing table untouched: fail if its columns, types or constraints differ.
do $$
declare
  problems text;
begin
  select string_agg(e.table_name || '.' || e.column_name || ' (' || e.data_type || ', nullable=' || e.is_nullable || ')', '; ')
  into problems
  from (values
    ('mission_requests', 'id', 'uuid', 'NO'),
    ('mission_requests', 'reference', 'text', 'NO'),
    ('mission_requests', 'status', 'text', 'NO'),
    ('mission_requests', 'client_id', 'uuid', 'YES'),
    ('mission_requests', 'requester_name', 'text', 'NO'),
    ('mission_requests', 'contact_name', 'text', 'NO'),
    ('mission_requests', 'contact_role', 'text', 'YES'),
    ('mission_requests', 'email', 'text', 'NO'),
    ('mission_requests', 'phone', 'text', 'YES'),
    ('mission_requests', 'country', 'text', 'NO'),
    ('mission_requests', 'domain', 'text', 'NO'),
    ('mission_requests', 'description', 'text', 'NO'),
    ('mission_requests', 'questions', 'jsonb', 'NO'),
    ('mission_requests', 'questions_free_text', 'text', 'YES'),
    ('mission_requests', 'multi_site', 'boolean', 'NO'),
    ('mission_requests', 'sites', 'jsonb', 'NO'),
    ('mission_requests', 'deadline_option', 'text', 'NO'),
    ('mission_requests', 'desired_date', 'date', 'YES'),
    ('mission_requests', 'additional_info', 'text', 'YES'),
    ('mission_requests', 'consent_authorized', 'boolean', 'NO'),
    ('mission_requests', 'consent_text_version', 'text', 'NO'),
    ('mission_requests', 'consent_at', 'timestamp with time zone', 'NO'),
    ('mission_requests', 'ip_hash', 'text', 'YES'),
    ('mission_requests', 'internal_notes', 'text', 'NO'),
    ('mission_requests', 'pdf_path', 'text', 'YES'),
    ('mission_requests', 'pdf_sha256', 'text', 'YES'),
    ('mission_requests', 'pdf_generated_at', 'timestamp with time zone', 'YES'),
    ('mission_requests', 'converted_mission_id', 'uuid', 'YES'),
    ('mission_requests', 'created_at', 'timestamp with time zone', 'NO'),
    ('mission_requests', 'updated_at', 'timestamp with time zone', 'NO'),
    ('mission_request_files', 'id', 'uuid', 'NO'),
    ('mission_request_files', 'request_id', 'uuid', 'NO'),
    ('mission_request_files', 'file_path', 'text', 'NO'),
    ('mission_request_files', 'file_name', 'text', 'NO'),
    ('mission_request_files', 'mime_type', 'text', 'NO'),
    ('mission_request_files', 'file_size', 'bigint', 'NO'),
    ('mission_request_files', 'uploaded_at', 'timestamp with time zone', 'NO'),
    ('mission_request_events', 'id', 'uuid', 'NO'),
    ('mission_request_events', 'request_id', 'uuid', 'NO'),
    ('mission_request_events', 'event_type', 'text', 'NO'),
    ('mission_request_events', 'from_status', 'text', 'YES'),
    ('mission_request_events', 'to_status', 'text', 'YES'),
    ('mission_request_events', 'reason', 'text', 'YES'),
    ('mission_request_events', 'details', 'jsonb', 'NO'),
    ('mission_request_events', 'actor_id', 'uuid', 'YES'),
    ('mission_request_events', 'created_at', 'timestamp with time zone', 'NO')
  ) as e(table_name, column_name, data_type, is_nullable)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = e.table_name and c.column_name = e.column_name
      and c.data_type = e.data_type and c.is_nullable = e.is_nullable
  );
  if problems is not null then
    raise exception 'Structure existante incompatible (colonnes absentes ou de type différent) : %', problems;
  end if;

  select string_agg(e.table_name || '.' || e.constraint_name, '; ') into problems
  from (values
    ('mission_requests', 'mission_requests_pkey'),
    ('mission_requests', 'mission_requests_reference_key'),
    ('mission_requests', 'mission_requests_client_id_fkey'),
    ('mission_requests', 'mission_requests_converted_mission_id_fkey'),
    ('mission_requests', 'mission_requests_status_check'),
    ('mission_requests', 'mission_requests_requester_name_check'),
    ('mission_requests', 'mission_requests_contact_name_check'),
    ('mission_requests', 'mission_requests_contact_role_check'),
    ('mission_requests', 'mission_requests_email_check'),
    ('mission_requests', 'mission_requests_phone_check'),
    ('mission_requests', 'mission_requests_country_check'),
    ('mission_requests', 'mission_requests_domain_check'),
    ('mission_requests', 'mission_requests_description_check'),
    ('mission_requests', 'mission_requests_questions_check'),
    ('mission_requests', 'mission_requests_questions_free_text_check'),
    ('mission_requests', 'mission_requests_sites_check'),
    ('mission_requests', 'mission_requests_deadline_option_check'),
    ('mission_requests', 'mission_requests_additional_info_check'),
    ('mission_requests', 'mission_requests_consent_authorized_check'),
    ('mission_requests', 'mission_requests_consent_text_version_check'),
    ('mission_requests', 'mission_requests_ip_hash_check'),
    ('mission_requests', 'mission_requests_internal_notes_check'),
    ('mission_requests', 'mission_requests_pdf_sha256_check'),
    ('mission_requests', 'mission_requests_single_site_check'),
    ('mission_requests', 'mission_requests_pdf_complete_check'),
    ('mission_requests', 'mission_requests_pdf_path_check'),
    ('mission_requests', 'mission_requests_converted_requires_link_check'),
    ('mission_requests', 'mission_requests_link_requires_converted_check'),
    ('mission_request_files', 'mission_request_files_pkey'),
    ('mission_request_files', 'mission_request_files_file_path_key'),
    ('mission_request_files', 'mission_request_files_request_id_fkey'),
    ('mission_request_files', 'mission_request_files_file_name_check'),
    ('mission_request_files', 'mission_request_files_mime_type_check'),
    ('mission_request_files', 'mission_request_files_file_size_check'),
    ('mission_request_files', 'mission_request_files_path_check'),
    ('mission_request_events', 'mission_request_events_pkey'),
    ('mission_request_events', 'mission_request_events_request_id_fkey'),
    ('mission_request_events', 'mission_request_events_actor_id_fkey'),
    ('mission_request_events', 'mission_request_events_event_type_check'),
    ('mission_request_events', 'mission_request_events_from_status_check'),
    ('mission_request_events', 'mission_request_events_to_status_check')
  ) as e(table_name, constraint_name)
  where not exists (
    select 1 from pg_constraint k
    where k.conname = e.constraint_name and k.conrelid = to_regclass('public.' || e.table_name)
  );
  if problems is not null then
    raise exception 'Structure existante incompatible (contraintes attendues absentes) : %', problems;
  end if;
end;
$$;

create index if not exists idx_mission_requests_status_created on public.mission_requests(status, created_at desc);
create index if not exists idx_mission_requests_created on public.mission_requests(created_at desc);
create index if not exists idx_mission_requests_email on public.mission_requests(lower(email));
create index if not exists idx_mission_requests_client on public.mission_requests(client_id) where client_id is not null;
create index if not exists idx_mission_requests_ip_hash on public.mission_requests(ip_hash, created_at desc) where ip_hash is not null;
create unique index if not exists idx_mission_requests_converted_mission
  on public.mission_requests(converted_mission_id) where converted_mission_id is not null;
create index if not exists idx_mission_request_files_request on public.mission_request_files(request_id);
create index if not exists idx_mission_request_events_request on public.mission_request_events(request_id, created_at desc);

create or replace function public.mission_requests_before_insert()
returns trigger language plpgsql security definer set search_path = public set row_security = off
as $$
declare
  sequence_value text;
begin
  if new.status is distinct from 'new' then
    raise exception 'Une nouvelle demande doit avoir le statut new';
  end if;
  if new.converted_mission_id is not null or new.pdf_path is not null or new.pdf_sha256 is not null or new.pdf_generated_at is not null then
    raise exception 'La mission liée et le PDF ne peuvent pas être définis à la création';
  end if;
  sequence_value := nextval('public.mission_request_reference_seq')::text;
  new.reference := 'DEM-' || to_char(timezone('UTC', now()), 'YYYY') || '-'
    || lpad(sequence_value, greatest(5, length(sequence_value)), '0');
  new.email := lower(btrim(new.email));
  new.consent_at := now();
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

-- Submitted data is frozen; only public.correct_mission_request() lifts the guard for correctable fields.
create or replace function public.mission_requests_before_update()
returns trigger language plpgsql security definer set search_path = public set row_security = off
as $$
declare
  correcting boolean := coalesce(current_setting('app.mission_request_correction', true), '') = 'on';
begin
  if new.id is distinct from old.id
    or new.reference is distinct from old.reference
    or new.created_at is distinct from old.created_at
    or new.consent_authorized is distinct from old.consent_authorized
    or new.consent_text_version is distinct from old.consent_text_version
    or new.consent_at is distinct from old.consent_at
    or new.ip_hash is distinct from old.ip_hash
    or (new.client_id is distinct from old.client_id and new.client_id is not null)
  then
    raise exception 'Ces champs de la demande sont immuables';
  end if;

  if not correcting and (
    new.requester_name is distinct from old.requester_name
    or new.contact_name is distinct from old.contact_name
    or new.contact_role is distinct from old.contact_role
    or new.email is distinct from old.email
    or new.phone is distinct from old.phone
    or new.country is distinct from old.country
    or new.domain is distinct from old.domain
    or new.description is distinct from old.description
    or new.questions is distinct from old.questions
    or new.questions_free_text is distinct from old.questions_free_text
    or new.multi_site is distinct from old.multi_site
    or new.sites is distinct from old.sites
    or new.deadline_option is distinct from old.deadline_option
    or new.desired_date is distinct from old.desired_date
    or new.additional_info is distinct from old.additional_info
  ) then
    raise exception 'Les données soumises ne peuvent être modifiées que par correction administrative historisée';
  end if;

  if old.pdf_path is not null and (
    new.pdf_path is distinct from old.pdf_path
    or new.pdf_sha256 is distinct from old.pdf_sha256
    or new.pdf_generated_at is distinct from old.pdf_generated_at
  ) then
    raise exception 'Le PDF de la demande est figé';
  end if;

  if old.converted_mission_id is not null and new.converted_mission_id is distinct from old.converted_mission_id then
    raise exception 'Le lien vers la mission ne peut pas être modifié';
  end if;

  new.email := lower(btrim(new.email));
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.mission_requests_log_event()
returns trigger language plpgsql security definer set search_path = public set row_security = off
as $$
declare
  actor uuid;
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then
    return null;
  end if;
  select u.id into actor from public.users u where u.id = auth.uid();
  if auth.uid() is not null and actor is null then
    raise exception 'Profil utilisateur introuvable : la modification ne peut pas être tracée';
  end if;
  if tg_op = 'INSERT' then
    insert into public.mission_request_events(request_id, event_type, to_status, details, actor_id)
    values (new.id, 'created', new.status, jsonb_build_object('authenticated', new.client_id is not null), actor);
  else
    insert into public.mission_request_events(request_id, event_type, from_status, to_status, details, actor_id)
    values (
      new.id, 'status_changed', old.status, new.status,
      case when new.converted_mission_id is not null
        then jsonb_build_object('converted_mission_id', new.converted_mission_id)
        else '{}'::jsonb end,
      actor
    );
  end if;
  return null;
end;
$$;

drop trigger if exists trg_mission_requests_before_insert on public.mission_requests;
create trigger trg_mission_requests_before_insert before insert on public.mission_requests
for each row execute function public.mission_requests_before_insert();

drop trigger if exists trg_mission_requests_before_update on public.mission_requests;
create trigger trg_mission_requests_before_update before update on public.mission_requests
for each row execute function public.mission_requests_before_update();

drop trigger if exists trg_mission_requests_log_event on public.mission_requests;
create trigger trg_mission_requests_log_event after insert or update on public.mission_requests
for each row execute function public.mission_requests_log_event();

-- Controlled administrative correction: admin only, reason required, before/after values recorded.
create or replace function public.correct_mission_request(p_request_id uuid, p_changes jsonb, p_reason text)
returns public.mission_requests
language plpgsql security definer set search_path = public set row_security = off
as $$
declare
  allowed constant text[] := array['requester_name', 'contact_name', 'contact_role', 'email', 'phone', 'country',
    'domain', 'description', 'questions', 'questions_free_text', 'multi_site', 'sites', 'deadline_option',
    'desired_date', 'additional_info'];
  invalid text;
  before_row public.mission_requests;
  after_row public.mission_requests;
  before_values jsonb;
  after_values jsonb;
  actor uuid;
  clean_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.is_scope_admin() then
    raise exception 'Accès réservé à l’administrateur' using errcode = '42501';
  end if;
  select u.id into actor from public.users u where u.id = auth.uid();
  if actor is null then
    raise exception 'Profil administrateur introuvable : la correction ne peut pas être tracée';
  end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb then
    raise exception 'Aucune correction fournie';
  end if;
  if char_length(clean_reason) not between 10 and 1000 then
    raise exception 'Le motif de correction doit contenir entre 10 et 1000 caractères';
  end if;

  select string_agg(t.changed_key, ', ') into invalid
  from jsonb_object_keys(p_changes) as t(changed_key)
  where t.changed_key <> all (allowed);
  if invalid is not null then
    raise exception 'Champs non modifiables : %', invalid;
  end if;

  select * into before_row from public.mission_requests where id = p_request_id for update;
  if not found then
    raise exception 'Demande introuvable';
  end if;

  perform set_config('app.mission_request_correction', 'on', true);
  update public.mission_requests set
    requester_name = case when p_changes ? 'requester_name' then p_changes ->> 'requester_name' else requester_name end,
    contact_name = case when p_changes ? 'contact_name' then p_changes ->> 'contact_name' else contact_name end,
    contact_role = case when p_changes ? 'contact_role' then p_changes ->> 'contact_role' else contact_role end,
    email = case when p_changes ? 'email' then p_changes ->> 'email' else email end,
    phone = case when p_changes ? 'phone' then p_changes ->> 'phone' else phone end,
    country = case when p_changes ? 'country' then p_changes ->> 'country' else country end,
    domain = case when p_changes ? 'domain' then p_changes ->> 'domain' else domain end,
    description = case when p_changes ? 'description' then p_changes ->> 'description' else description end,
    questions = case when p_changes ? 'questions' then p_changes -> 'questions' else questions end,
    questions_free_text = case when p_changes ? 'questions_free_text' then p_changes ->> 'questions_free_text' else questions_free_text end,
    multi_site = case when p_changes ? 'multi_site' then (p_changes ->> 'multi_site')::boolean else multi_site end,
    sites = case when p_changes ? 'sites' then p_changes -> 'sites' else sites end,
    deadline_option = case when p_changes ? 'deadline_option' then p_changes ->> 'deadline_option' else deadline_option end,
    desired_date = case when p_changes ? 'desired_date' then (p_changes ->> 'desired_date')::date else desired_date end,
    additional_info = case when p_changes ? 'additional_info' then p_changes ->> 'additional_info' else additional_info end
  where id = p_request_id
  returning * into after_row;
  perform set_config('app.mission_request_correction', 'off', true);

  select jsonb_object_agg(t.changed_key, to_jsonb(before_row) -> t.changed_key),
    jsonb_object_agg(t.changed_key, to_jsonb(after_row) -> t.changed_key)
  into before_values, after_values
  from jsonb_object_keys(p_changes) as t(changed_key);
  if before_values = after_values then
    raise exception 'Aucune valeur n’a été modifiée';
  end if;

  insert into public.mission_request_events(request_id, event_type, reason, details, actor_id)
  values (
    p_request_id, 'data_corrected', clean_reason,
    jsonb_build_object('before', before_values, 'after', after_values),
    actor
  );
  return after_row;
end;
$$;

revoke all on function public.correct_mission_request(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.correct_mission_request(uuid, jsonb, text) to authenticated;

alter table public.mission_requests enable row level security;
alter table public.mission_request_files enable row level security;
alter table public.mission_request_events enable row level security;

revoke all on public.mission_requests, public.mission_request_files, public.mission_request_events from anon, authenticated;
revoke all on sequence public.mission_request_reference_seq from public, anon, authenticated;
grant select on public.mission_requests, public.mission_request_files, public.mission_request_events to authenticated;
grant update (status, internal_notes, converted_mission_id) on public.mission_requests to authenticated;

drop policy if exists "Admins read mission requests" on public.mission_requests;
create policy "Admins read mission requests" on public.mission_requests for select to authenticated
  using (public.is_scope_admin());
drop policy if exists "Admins manage mission request workflow" on public.mission_requests;
create policy "Admins manage mission request workflow" on public.mission_requests for update to authenticated
  using (public.is_scope_admin()) with check (public.is_scope_admin());

drop policy if exists "Admins read mission request files" on public.mission_request_files;
create policy "Admins read mission request files" on public.mission_request_files for select to authenticated
  using (public.is_scope_admin());

drop policy if exists "Admins read mission request events" on public.mission_request_events;
create policy "Admins read mission request events" on public.mission_request_events for select to authenticated
  using (public.is_scope_admin());

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('mission-request-files', 'mission-request-files', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- A pre-existing bucket must already match the intended configuration; nothing is changed silently.
do $$
declare
  b storage.buckets%rowtype;
begin
  select * into b from storage.buckets where id = 'mission-request-files';
  if not found then
    raise exception 'Le bucket mission-request-files est introuvable après sa création';
  end if;
  if b.public then
    raise exception 'Le bucket mission-request-files existe déjà et est public : le rendre privé avant de continuer';
  end if;
  if b.file_size_limit is distinct from 10485760
    or b.allowed_mime_types is distinct from array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
  then
    raise exception 'Le bucket mission-request-files existe avec des limites différentes de celles prévues : les corriger avant de continuer';
  end if;
end;
$$;

drop policy if exists "Admins read mission request files" on storage.objects;
create policy "Admins read mission request files" on storage.objects for select to authenticated
  using (bucket_id = 'mission-request-files' and public.is_scope_admin());

-- Final guard: fail the migration if the resulting security posture is not the intended one.
do $$
declare
  problems text;
  request_tables constant text[] := array['mission_requests', 'mission_request_files', 'mission_request_events'];
begin
  select string_agg(c.relname, ', ') into problems
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = any (request_tables) and not c.relrowsecurity;
  if problems is not null then
    raise exception 'RLS désactivé sur : %', problems;
  end if;

  select string_agg(t.table_name, ', ') into problems
  from unnest(request_tables) as t(table_name)
  where has_table_privilege('anon', ('public.' || t.table_name)::text, 'select,insert,update,delete,truncate,references,trigger')
    or has_any_column_privilege('anon', ('public.' || t.table_name)::text, 'select,insert,update,references');
  if problems is not null then
    raise exception 'Le rôle anon a des droits sur : %', problems;
  end if;

  select string_agg(t.table_name, ', ') into problems
  from unnest(request_tables) as t(table_name)
  where has_table_privilege('authenticated', ('public.' || t.table_name)::text, 'insert,delete,truncate,references,trigger')
    or not has_table_privilege('authenticated', ('public.' || t.table_name)::text, 'select');
  if problems is not null then
    raise exception 'Droits authenticated inattendus sur : %', problems;
  end if;

  select string_agg(t.table_name, ', ') into problems
  from unnest(array['mission_request_files', 'mission_request_events']) as t(table_name)
  where has_any_column_privilege('authenticated', ('public.' || t.table_name)::text, 'update');
  if problems is not null then
    raise exception 'Mise à jour autorisée à authenticated sur : %', problems;
  end if;

  select string_agg(c.column_name::text, ', ') into problems
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'mission_requests'
    and has_column_privilege('authenticated', 'public.mission_requests'::text, c.column_name::text, 'update')
    and c.column_name::text <> all (array['status', 'internal_notes', 'converted_mission_id']);
  if problems is not null then
    raise exception 'Colonnes de mission_requests modifiables par authenticated : %', problems;
  end if;

  select string_agg(t.table_name, ', ') into problems
  from unnest(request_tables) as t(table_name)
  where not has_table_privilege('service_role', ('public.' || t.table_name)::text, 'select')
    or not has_table_privilege('service_role', ('public.' || t.table_name)::text, 'insert')
    or (t.table_name = 'mission_requests' and not has_table_privilege('service_role', 'public.mission_requests'::text, 'update'));
  if problems is not null then
    raise exception 'Le rôle service_role n''a pas les droits nécessaires sur : %', problems;
  end if;

  if has_function_privilege('anon', 'public.correct_mission_request(uuid, jsonb, text)'::text, 'execute')
    or not has_function_privilege('authenticated', 'public.correct_mission_request(uuid, jsonb, text)'::text, 'execute')
  then
    raise exception 'Droits d''exécution incorrects sur correct_mission_request';
  end if;

  select string_agg(p.tablename || ': ' || p.policyname, ', ') into problems
  from pg_policies p
  where p.schemaname = 'public' and p.tablename = any (request_tables)
    and (
      p.roles is distinct from array['authenticated']::name[]
      or (p.tablename::text, p.policyname::text) not in (
        ('mission_requests', 'Admins read mission requests'),
        ('mission_requests', 'Admins manage mission request workflow'),
        ('mission_request_files', 'Admins read mission request files'),
        ('mission_request_events', 'Admins read mission request events')
      )
    );
  if problems is not null then
    raise exception 'Politiques RLS inattendues : %', problems;
  end if;

  select string_agg(p.policyname::text, ', ') into problems
  from pg_policies p
  where p.schemaname = 'storage' and p.tablename = 'objects'
    and (coalesce(p.qual, '') like '%mission-request-files%' or coalesce(p.with_check, '') like '%mission-request-files%')
    and (p.policyname::text <> 'Admins read mission request files' or p.cmd <> 'SELECT');
  if problems is not null then
    raise exception 'Politiques storage inattendues sur mission-request-files : %', problems;
  end if;
end;
$$;

notify pgrst, 'reload schema';
