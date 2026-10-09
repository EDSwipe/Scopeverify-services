-- Repair missing partner signup policies and moderator mission-update guard.
-- Safe to re-run. Does not modify application data.
-- Run in Supabase SQL Editor on the project already containing the partner-network tables.

begin;

-- The partner intake and regular client signup both insert the authenticated user's profile.
drop policy if exists "Users can insert own allowed profile" on public.users;
create policy "Users can insert own allowed profile" on public.users for insert to authenticated
  with check (auth.uid() = id and role in ('client', 'partner'));

drop policy if exists "Configured admin can insert user profiles" on public.users;
create policy "Configured admin can insert user profiles" on public.users for insert to authenticated
  with check (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr');

-- The previous hardening trigger allowed only the fixed admin email to change assignments.
-- Keep its client/collaborator restrictions, but let an active admin or moderator manage them.
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

drop trigger if exists trg_mission_update_guard on public.missions;
create trigger trg_mission_update_guard before update on public.missions
for each row execute function public.mission_update_guard();

notify pgrst, 'reload schema';
commit;
