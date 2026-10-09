-- Diagnostic Scope-Verify: partner network, mission integration, RLS and admin login.
-- Read-only: this script performs SELECTs only and does not create or alter database objects.
-- Run in the Supabase SQL Editor of the same project used by the application.

with
expected_tables(schema_name, table_name) as (
  values
    ('public', 'users'),
    ('public', 'missions'),
    ('public', 'mission_assignments'),
    ('public', 'mission_documents'),
    ('public', 'contact_requests'),
    ('public', 'site_content'),
    ('public', 'partner_profiles'),
    ('public', 'partner_public_directory'),
    ('public', 'partner_documents'),
    ('public', 'partner_history')
),
table_results as (
  select
    'Tables'::text as section,
    e.schema_name || '.' || e.table_name as object_name,
    case when t.table_name is null then 'MANQUANT' else 'OK' end::text as status,
    case when t.table_name is null then 'Table absente' else 'Table présente' end::text as details
  from expected_tables e
  left join information_schema.tables t
    on t.table_schema = e.schema_name and t.table_name = e.table_name
),
expected_columns(schema_name, table_name, column_name) as (
  values
    ('public', 'users', 'id'),
    ('public', 'users', 'email'),
    ('public', 'users', 'role'),
    ('public', 'users', 'is_active'),
    ('public', 'missions', 'requested_deadline'),
    ('public', 'missions', 'partner_profile_id'),
    ('public', 'partner_profiles', 'user_id'),
    ('public', 'partner_profiles', 'business_name'),
    ('public', 'partner_profiles', 'contact_email'),
    ('public', 'partner_profiles', 'qualification_data'),
    ('public', 'partner_profiles', 'status'),
    ('public', 'partner_profiles', 'internal_notes'),
    ('public', 'partner_profiles', 'is_public'),
    ('public', 'partner_public_directory', 'is_visible'),
    ('public', 'partner_public_directory', 'public_name'),
    ('public', 'partner_documents', 'file_path'),
    ('public', 'partner_documents', 'document_type'),
    ('public', 'partner_documents', 'expires_at'),
    ('public', 'partner_history', 'event'),
    ('public', 'contact_requests', 'mission'),
    ('public', 'site_content', 'content')
),
column_results as (
  select
    'Colonnes'::text as section,
    e.schema_name || '.' || e.table_name || '.' || e.column_name as object_name,
    case when c.column_name is null then 'MANQUANT' else 'OK' end::text as status,
    case when c.column_name is null then 'Colonne absente' else 'Colonne présente' end::text as details
  from expected_columns e
  left join information_schema.columns c
    on c.table_schema = e.schema_name
   and c.table_name = e.table_name
   and c.column_name = e.column_name
),
expected_rls(schema_name, table_name) as (
  values
    ('public', 'users'),
    ('public', 'missions'),
    ('public', 'mission_assignments'),
    ('public', 'mission_documents'),
    ('public', 'partner_profiles'),
    ('public', 'partner_public_directory'),
    ('public', 'partner_documents'),
    ('public', 'partner_history')
),
rls_results as (
  select
    'RLS'::text as section,
    e.schema_name || '.' || e.table_name as object_name,
    case when c.relrowsecurity then 'OK' else 'MANQUANT' end::text as status,
    case when c.relrowsecurity then 'RLS activé' else 'RLS absent ou table absente' end::text as details
  from expected_rls e
  left join pg_namespace n on n.nspname = e.schema_name
  left join pg_class c on c.relnamespace = n.oid and c.relname = e.table_name
),
expected_functions(function_name) as (
  values
    ('is_scope_admin_or_moderator'),
    ('has_active_work_access'),
    ('users_insert_guard'),
    ('users_update_guard'),
    ('sync_partner_access'),
    ('sync_partner_public_directory'),
    ('log_partner_status_change')
),
function_results as (
  select
    'Fonctions'::text as section,
    'public.' || e.function_name || '()' as object_name,
    case when p.oid is null then 'MANQUANT' else 'OK' end::text as status,
    case when p.oid is null then 'Fonction absente' else 'Fonction présente' end::text as details
  from expected_functions e
  left join pg_proc p on p.pronamespace = 'public'::regnamespace and p.proname = e.function_name
),
mission_guard_result as (
  select
    'Autorisation mission'::text as section,
    'public.mission_update_guard() / delegation admin-modérateur'::text as object_name,
    case when pg_get_functiondef(p.oid) like '%is_scope_admin_or_moderator%'
      then 'OK' else 'À CORRIGER' end::text as status,
    case when pg_get_functiondef(p.oid) like '%is_scope_admin_or_moderator%'
      then 'Le garde-fou délègue aux rôles admin/moderator actifs'
      else 'Le garde-fou historique vérifie probablement uniquement l’adresse admin; un modérateur ne pourra pas affecter une mission'
    end::text as details
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname = 'mission_update_guard'
  union all
  select
    'Autorisation mission'::text,
    'public.mission_update_guard() / delegation admin-modérateur'::text,
    'MANQUANT'::text,
    'Le garde-fou historique des missions est absent'::text
  where not exists (
    select 1 from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'mission_update_guard'
  )
),
expected_triggers(table_name, trigger_name) as (
  values
    ('users', 'trg_users_insert_guard'),
    ('users', 'trg_users_update_guard'),
    ('partner_profiles', 'trg_sync_partner_access'),
    ('partner_profiles', 'trg_sync_partner_public_directory'),
    ('partner_profiles', 'trg_log_partner_status_change')
),
trigger_results as (
  select
    'Triggers'::text as section,
    'public.' || e.table_name || '.' || e.trigger_name as object_name,
    case when t.oid is null then 'MANQUANT' else 'OK' end::text as status,
    case when t.oid is null then 'Trigger absent' else 'Trigger présent et actif' end::text as details
  from expected_triggers e
  left join pg_class c on c.relnamespace = 'public'::regnamespace and c.relname = e.table_name
  left join pg_trigger t on t.tgrelid = c.oid and t.tgname = e.trigger_name and not t.tgisinternal
),
expected_policies(schema_name, table_name, policy_name) as (
  values
    ('public', 'users', 'Users can insert own allowed profile'),
    ('public', 'users', 'Configured admin can insert user profiles'),
    ('public', 'partner_profiles', 'Partner users read own profile'),
    ('public', 'partner_profiles', 'Partner applicants create own profile'),
    ('public', 'partner_profiles', 'Partner users update own pending profile'),
    ('public', 'partner_profiles', 'Admins and moderators manage partner profiles'),
    ('public', 'partner_public_directory', 'Public sees only selected directory fields'),
    ('public', 'partner_documents', 'Applicants read own partner documents'),
    ('public', 'partner_documents', 'Applicants upload own partner documents'),
    ('public', 'partner_documents', 'Admins and moderators manage partner documents'),
    ('public', 'partner_history', 'Admins and moderators read partner history'),
    ('public', 'partner_history', 'Admins and moderators add partner history'),
    ('public', 'missions', 'Active account workflow guard missions'),
    ('public', 'missions', 'Admins and moderators view all missions'),
    ('public', 'missions', 'Admins and moderators assign partner missions'),
    ('public', 'mission_assignments', 'Active account workflow guard assignments'),
    ('public', 'mission_documents', 'Active account workflow guard mission documents'),
    ('storage', 'objects', 'Partner applicants upload qualification files'),
    ('storage', 'objects', 'Partner applicants read qualification files'),
    ('storage', 'objects', 'Admins and moderators manage qualification files'),
    ('storage', 'objects', 'Public reads selected partner logos'),
    ('storage', 'objects', 'Admins and moderators manage partner logos')
),
policy_results as (
  select
    'Politiques RLS'::text as section,
    e.schema_name || '.' || e.table_name || ' / ' || e.policy_name as object_name,
    case when p.policyname is null then 'MANQUANT' else 'OK' end::text as status,
    case when p.policyname is null then 'Politique absente' else 'Politique présente' end::text as details
  from expected_policies e
  left join pg_policies p
    on p.schemaname = e.schema_name
   and p.tablename = e.table_name
   and p.policyname = e.policy_name
),
expected_buckets(bucket_name, expected_public) as (
  values ('partner-documents', false), ('partner-public-assets', true)
),
bucket_results as (
  select
    'Storage'::text as section,
    e.bucket_name as object_name,
    case when b.id is null then 'MANQUANT'
         when b.public = e.expected_public then 'OK'
         else 'À CORRIGER' end::text as status,
    case when b.id is null then 'Bucket absent'
         when b.public = e.expected_public and b.public then 'Bucket présent et public (logos sélectionnés)'
         when b.public = e.expected_public then 'Bucket présent et privé (justificatifs)'
         else 'Visibilité différente de celle attendue' end::text as details
  from expected_buckets e
  left join storage.buckets b on b.id = e.bucket_name
),
role_constraint_result as (
  select
    'Rôles'::text as section,
    'public.users.users_role_check'::text as object_name,
    case when exists (
      select 1 from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      where t.relnamespace = 'public'::regnamespace
        and t.relname = 'users'
        and c.conname = 'users_role_check'
        and pg_get_constraintdef(c.oid) like '%moderator%'
        and pg_get_constraintdef(c.oid) like '%partner%'
    ) then 'OK' else 'MANQUANT' end::text as status,
    'La contrainte doit autoriser admin, moderator, client, collaborator et partner'::text as details
),
admin_result as (
  select
    'Compte admin'::text as section,
    'sotbirida@yahoo.fr'::text as object_name,
    case
      when not exists (select 1 from auth.users au where lower(au.email) = 'sotbirida@yahoo.fr') then 'MANQUANT'
      when not exists (
        select 1 from auth.users au join public.users u on u.id = au.id
        where lower(au.email) = 'sotbirida@yahoo.fr' and u.role = 'admin' and u.is_active = true
      ) then 'À CORRIGER'
      else 'OK'
    end::text as status,
    case
      when not exists (select 1 from auth.users au where lower(au.email) = 'sotbirida@yahoo.fr') then 'Compte absent de Supabase Auth'
      when not exists (
        select 1 from auth.users au join public.users u on u.id = au.id
        where lower(au.email) = 'sotbirida@yahoo.fr' and u.role = 'admin' and u.is_active = true
      ) then 'Auth existe, mais le profil public.users admin actif est absent ou incorrect'
      else 'Auth et profil admin actif présents'
    end::text as details
)
select section, object_name, status, details from table_results
union all select section, object_name, status, details from column_results
union all select section, object_name, status, details from rls_results
union all select section, object_name, status, details from function_results
union all select section, object_name, status, details from mission_guard_result
union all select section, object_name, status, details from trigger_results
union all select section, object_name, status, details from policy_results
union all select section, object_name, status, details from bucket_results
union all select section, object_name, status, details from role_constraint_result
union all select section, object_name, status, details from admin_result
order by section, object_name;
