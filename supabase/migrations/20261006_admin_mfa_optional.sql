-- Keep MFA optional for now while preserving the tightened admin RLS policies.
create or replace function public.is_scope_admin()
returns boolean language sql stable security definer set search_path = public set row_security = off
as $$
  select coalesce(auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr', false)
    or exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role = 'admin' and u.is_active = true
    );
$$;

notify pgrst, 'reload schema';