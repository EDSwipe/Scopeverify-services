create table if not exists public.prices (
  id integer primary key,
  title_fr text not null,
  title_en text not null,
  description_fr text not null,
  description_en text not null,
  amount text not null
);

alter table public.prices enable row level security;
drop policy if exists "Public can read pricing" on public.prices;
drop policy if exists "Only SCOPE VERIFY admin can manage pricing" on public.prices;
create policy "Public can read pricing" on public.prices for select using (true);
create policy "Only SCOPE VERIFY admin can manage pricing" on public.prices for all using (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr') with check (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr');

insert into public.prices (id, title_fr, title_en, description_fr, description_en, amount) values
(1, 'Visite simple + photos', 'Simple visit + photos', 'Constat d’existence, activité visible, reportage photographique daté.', 'Site existence, visible activity, dated photographic report.', '350 EUR'),
(2, 'Field Verification', 'Field Verification', 'Mission structurée sur checklist, observations et rapport documenté.', 'Checklist-based mission, observations and documented report.', '500 EUR'),
(3, 'Visite fournisseur / production', 'Supplier / production visit', 'Site, équipements, activité constatée, commande et préparation avant expédition.', 'Site, equipment, observed activity, order and pre-shipment preparation.', '700 EUR'),
(4, 'Mission technique avec relevés', 'Technical mission with records', 'Dimensions, quantités, références et données accessibles sur site.', 'Dimensions, quantities, references and data accessible on site.', '800 EUR'),
(5, 'Journée terrain', 'Field day', 'Une journée complète à votre disposition, plusieurs points ou plusieurs sites.', 'A full day at your disposal, covering several points or sites.', '600 EUR')
on conflict (id) do nothing;

create table if not exists public.contact_requests (
  id bigint generated always as identity primary key,
  name text not null,
  company text,
  email text not null,
  phone text,
  mission text not null,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  page text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.site_settings (
  key text primary key,
  value text not null
);

alter table public.contact_requests enable row level security;
alter table public.page_views enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "Anyone can submit a contact request" on public.contact_requests;
drop policy if exists "Only SCOPE VERIFY admin reads requests" on public.contact_requests;
drop policy if exists "Only SCOPE VERIFY admin updates requests" on public.contact_requests;
drop policy if exists "Only SCOPE VERIFY admin deletes requests" on public.contact_requests;
drop policy if exists "Anyone can record a page view" on public.page_views;
drop policy if exists "Only SCOPE VERIFY admin reads page views" on public.page_views;
drop policy if exists "Public can read site settings" on public.site_settings;
drop policy if exists "Only SCOPE VERIFY admin manages settings" on public.site_settings;
create policy "Anyone can submit a contact request" on public.contact_requests for insert with check (true);
create policy "Only SCOPE VERIFY admin reads requests" on public.contact_requests for select using (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr');
create policy "Only SCOPE VERIFY admin updates requests" on public.contact_requests for update using (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr');
create policy "Only SCOPE VERIFY admin deletes requests" on public.contact_requests for delete using (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr');
create policy "Anyone can record a page view" on public.page_views for insert with check (true);
create policy "Only SCOPE VERIFY admin reads page views" on public.page_views for select using (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr');
create policy "Public can read site settings" on public.site_settings for select using (true);
create policy "Only SCOPE VERIFY admin manages settings" on public.site_settings for all using (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr') with check (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr');

insert into public.site_settings (key, value) values
('contact_email', 'contact@scopeverify-services.com'),
('contact_phone', '+33 (7) 69 96 07 66'),
('service_area', 'France et international')
on conflict (key) do nothing;

notify pgrst, 'reload schema';