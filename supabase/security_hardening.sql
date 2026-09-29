-- SECURITY HARDENING MIGRATION
-- Run this in the Supabase SQL editor AFTER migration_mission_system.sql.
-- It closes privilege-escalation gaps that existed in the original RLS policies:
--   1. A client/collaborator could UPDATE their own users row and set role='admin'.
--   2. A signed-up user could INSERT their own users row with role='admin'.
--   3. A collaborator could UPDATE any column on a mission assigned to them
--      (validation_status, validation_notes, client_id, assigned_to, budget...),
--      bypassing the admin validation workflow entirely.
-- These triggers enforce the rules at the database level, regardless of what
-- the frontend does, so they hold even if the client code has a bug or is bypassed.

-- 1. USERS: block self-escalation on insert
-- v2 (2026-09-13): v1 had no admin bypass, so it also blocked the ADMIN from
-- creating collaborator/client profile rows (new.id is always different from
-- auth.uid() in that case) — this broke "Créer collaborateur" and the new
-- "Créer une mission pour un client" flow with a policy violation.
create or replace function public.users_insert_guard()
returns trigger as $$
begin
  if auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr' then
    new.is_active := true;
    return new; -- admin may create profile rows for other users (collaborators/clients)
  end if;

  if new.id is distinct from auth.uid() then
    raise exception 'Vous ne pouvez créer que votre propre profil';
  end if;
  if new.role = 'admin' then
    raise exception 'Le rôle admin ne peut pas être auto-attribué';
  end if;
  new.is_active := true;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_users_insert_guard on public.users;
create trigger trg_users_insert_guard
before insert on public.users
for each row execute function public.users_insert_guard();

-- 2. USERS: block role / is_active / email tampering on update
create or replace function public.users_update_guard()
returns trigger as $$
begin
  if auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr' then
    return new; -- admin may edit everything
  end if;

  if new.role is distinct from old.role
    or new.is_active is distinct from old.is_active
    or new.email is distinct from old.email
  then
    raise exception 'Modification non autorisée sur ce champ';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_users_update_guard on public.users;
create trigger trg_users_update_guard
before update on public.users
for each row execute function public.users_update_guard();

-- 3. MISSIONS: restrict what a non-admin can change, and auto-manage the
-- validation workflow so a collaborator can never self-validate their work.
-- v2 (2026-09-13): only guards the truly sensitive columns (validation_status,
-- validation_notes, client_id, assigned_to). The first version also blocked
-- title/description/mission_type/location/budget for every non-admin, which
-- incorrectly broke a client editing their own draft mission via MissionForm.
create or replace function public.mission_update_guard()
returns trigger as $$
declare
  is_admin boolean;
begin
  is_admin := auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr';

  if not is_admin then
    if new.validation_status is distinct from old.validation_status
      or new.validation_notes is distinct from old.validation_notes
    then
      raise exception 'Seul un administrateur peut modifier la validation';
    end if;

    if new.client_id is distinct from old.client_id
      or new.assigned_to is distinct from old.assigned_to
    then
      raise exception 'Seul un administrateur peut réaffecter cette mission';
    end if;
  end if;

  -- Whenever a mission is (re)submitted as completed, automatically reset
  -- the validation workflow to "pending" so it always needs a fresh admin review.
  -- v3 (2026-09-13): use '' instead of null for validation_notes — the column
  -- has a NOT NULL constraint (default ''), so assigning null here raised a
  -- 23502 not_null_violation (HTTP 400) every time a mission was closed.
  if new.status = 'completed' and old.status is distinct from new.status then
    new.validation_status := 'pending';
    new.validation_notes := '';
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_mission_update_guard on public.missions;
create trigger trg_mission_update_guard
before update on public.missions
for each row execute function public.mission_update_guard();

-- 4. MISSIONS: allow the admin to create a mission on behalf of any client.
-- The original migration only had "Clients can create missions" (with check
-- auth.uid() = client_id), which blocks the admin from inserting a mission
-- whose client_id is someone else's — this caused a 403 when using the
-- "Créer une mission pour un client" feature in AdminDashboard.
drop policy if exists "Admins can create missions" on public.missions;
create policy "Admins can create missions" on public.missions
  for insert with check (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr');

notify pgrst, 'reload schema';

