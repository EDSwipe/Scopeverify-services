-- MISSION MANAGEMENT SYSTEM SCHEMA
-- This migration adds support for clients, collaborators, missions, and assignments

-- 1. USERS TABLE (extended Supabase auth integration)
create table if not exists public.users (
  id uuid references auth.users(id) primary key on delete cascade,
  email text unique not null,
  role text not null check (role in ('admin', 'client', 'collaborator')),
  full_name text,
  company text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. MISSIONS TABLE
create table if not exists public.missions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  description text,
  mission_type text not null check (mission_type in (
    'simple_visit',
    'verification',
    'supplier_visit',
    'technical_mission',
    'field_day',
    'custom'
  )),
  location text not null,
  status text not null default 'draft' check (status in (
    'draft',
    'submitted',
    'accepted',
    'in_progress',
    'completed',
    'cancelled'
  )),
  requirements jsonb default '{}', -- flexible requirements field
  budget text,
  assigned_to uuid references public.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. MISSION ASSIGNMENTS TABLE (audit trail)
create table if not exists public.mission_assignments (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  collaborator_id uuid not null references public.users(id) on delete cascade,
  assigned_by uuid not null references public.users(id), -- admin who assigned
  assignment_status text not null default 'assigned' check (assignment_status in (
    'assigned',
    'in_progress',
    'completed',
    'cancelled'
  )),
  assigned_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz,
  notes text
);

-- 4. MISSION DOCUMENTS TABLE
create table if not exists public.mission_documents (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  file_path text not null, -- Supabase Storage path
  file_name text not null,
  file_type text,
  file_size integer,
  uploaded_by uuid not null references public.users(id),
  uploaded_at timestamptz default now()
);

-- 5. ENABLE RLS ON ALL TABLES
alter table public.users enable row level security;
alter table public.missions enable row level security;
alter table public.mission_assignments enable row level security;
alter table public.mission_documents enable row level security;

-- 6. USERS POLICIES
-- Admin can see all users
drop policy if exists "Admins can view all users" on public.users;
create policy "Admins can view all users" on public.users
  for select using (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr');

-- Users can see their own profile
drop policy if exists "Users can view their own profile" on public.users;
create policy "Users can view their own profile" on public.users
  for select using (auth.uid() = id);

-- Admin can update users
drop policy if exists "Admins can update users" on public.users;
create policy "Admins can update users" on public.users
  for update using (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr');

-- Users can update their own profile
drop policy if exists "Users can update their own profile" on public.users;
create policy "Users can update their own profile" on public.users
  for update using (auth.uid() = id);

-- 7. MISSIONS POLICIES
-- Clients can see their own missions
drop policy if exists "Clients can view own missions" on public.missions;
create policy "Clients can view own missions" on public.missions
  for select using (auth.uid() = client_id);

-- Collaborators can see missions assigned to them
drop policy if exists "Collaborators can view assigned missions" on public.missions;
create policy "Collaborators can view assigned missions" on public.missions
  for select using (
    auth.uid() = assigned_to
    or exists (
      select 1 from public.mission_assignments
      where mission_id = id and collaborator_id = auth.uid()
    )
  );

-- Admin can see all missions
drop policy if exists "Admins can view all missions" on public.missions;
create policy "Admins can view all missions" on public.missions
  for select using (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr');

-- Clients can create missions
drop policy if exists "Clients can create missions" on public.missions;
create policy "Clients can create missions" on public.missions
  for insert with check (auth.uid() = client_id);

-- Clients can update their own missions (only if still draft)
drop policy if exists "Clients can update own draft missions" on public.missions;
create policy "Clients can update own draft missions" on public.missions
  for update using (auth.uid() = client_id and status = 'draft');

-- Admin can update all missions
drop policy if exists "Admins can update all missions" on public.missions;
create policy "Admins can update all missions" on public.missions
  for update using (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr');

-- Collaborators can update status of assigned missions
drop policy if exists "Collaborators can update assigned mission status" on public.missions;
create policy "Collaborators can update assigned mission status" on public.missions
  for update using (auth.uid() = assigned_to) with check (auth.uid() = assigned_to);

-- 8. MISSION_ASSIGNMENTS POLICIES
-- Admin can manage all assignments
drop policy if exists "Admins can manage assignments" on public.mission_assignments;
create policy "Admins can manage assignments" on public.mission_assignments
  for all using (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr');

-- Collaborators can view their own assignments
drop policy if exists "Collaborators can view own assignments" on public.mission_assignments;
create policy "Collaborators can view own assignments" on public.mission_assignments
  for select using (auth.uid() = collaborator_id);

-- Collaborators can update their assignment status
drop policy if exists "Collaborators can update own assignment status" on public.mission_assignments;
create policy "Collaborators can update own assignment status" on public.mission_assignments
  for update using (auth.uid() = collaborator_id);

-- 9. MISSION_DOCUMENTS POLICIES
-- Anyone involved in mission can view documents
drop policy if exists "View mission documents" on public.mission_documents;
create policy "View mission documents" on public.mission_documents
  for select using (
    exists (
      select 1 from public.missions
      where id = mission_id and (client_id = auth.uid() or assigned_to = auth.uid())
    )
    or auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr'
  );

-- Collaborators and client can upload documents
drop policy if exists "Upload mission documents" on public.mission_documents;
create policy "Upload mission documents" on public.mission_documents
  for insert with check (
    exists (
      select 1 from public.missions m
      where m.id = mission_id and (m.client_id = auth.uid() or m.assigned_to = auth.uid())
    )
    or auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr'
  );

-- 10. TRIGGERS FOR UPDATED_AT
create or replace function update_missions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists missions_updated_at on public.missions;
create trigger missions_updated_at
before update on public.missions
for each row
execute function update_missions_updated_at();

-- 11. INDEXES FOR PERFORMANCE
create index if not exists idx_missions_client_id on public.missions(client_id);
create index if not exists idx_missions_assigned_to on public.missions(assigned_to);
create index if not exists idx_missions_status on public.missions(status);
create index if not exists idx_mission_assignments_mission_id on public.mission_assignments(mission_id);
create index if not exists idx_mission_assignments_collaborator_id on public.mission_assignments(collaborator_id);
create index if not exists idx_mission_documents_mission_id on public.mission_documents(mission_id);

-- Notify PostgREST of schema changes
notify pgrst, 'reload schema';
