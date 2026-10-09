-- CMS controls required by the public site and Admin dashboard.
-- Run after supabase-migrations-site-content.sql and supabase/setup.sql.

alter table public.prices
  add column if not exists is_visible boolean not null default true;

insert into public.site_settings (key, value) values
  ('phone_display_enabled', 'true'),
  ('whatsapp_number', '+33 (0) 7 69 96 07 66'),
  ('whatsapp_display_enabled', 'false')
on conflict (key) do nothing;

create table if not exists public.site_content (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  key text not null,
  language text not null check (language in ('fr', 'en')),
  content text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id),
  unique (section, key, language)
);

alter table public.site_content enable row level security;
drop policy if exists "Public can read site content" on public.site_content;
drop policy if exists "Only SCOPE VERIFY admin manages site content" on public.site_content;
create policy "Public can read site content" on public.site_content
  for select using (true);
create policy "Only SCOPE VERIFY admin manages site content" on public.site_content
  for all
  using (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr')
  with check (auth.jwt() ->> 'email' = 'sotbirida@yahoo.fr');

grant select on public.site_content to anon, authenticated;
grant insert, update, delete on public.site_content to authenticated;

insert into public.site_content (section, key, language, content) values
  ('missions', 'item_1_title', 'fr', 'Fournisseur / Partenaire'),
  ('missions', 'item_1_description', 'fr', 'Existence du site, activité constatée, équipements visibles, effectif présent, environnement de production, documents accessibles et photographies.'),
  ('missions', 'item_2_title', 'fr', 'Commande / Production'),
  ('missions', 'item_2_description', 'fr', 'Références, quantités, dimensions, état apparent, conditionnement, avancement, préparation avant expédition et preuves photographiques.'),
  ('missions', 'item_3_title', 'fr', 'Projet / Implantation'),
  ('missions', 'item_3_description', 'fr', 'Visite du site, état d’avancement, environnement, équipements présents, configuration générale et relevés photographiques.'),
  ('missions', 'item_4_title', 'fr', 'Mission sur mesure'),
  ('missions', 'item_4_description', 'fr', 'Toute mission définie précisément par un cahier des charges terrain. Vous listez les points à vérifier, nous les traitons un par un.'),
  ('process', 'step_1_title', 'fr', 'Brief'),
  ('process', 'step_1_text', 'fr', 'Vous définissez l’objectif et les points à vérifier.'),
  ('process', 'step_2_title', 'fr', 'Préparation'),
  ('process', 'step_2_text', 'fr', 'Nous transformons la demande en checklist terrain.'),
  ('process', 'step_3_title', 'fr', 'Visite'),
  ('process', 'step_3_text', 'fr', 'Déplacement sur site et réalisation de la mission.'),
  ('process', 'step_4_title', 'fr', 'Documentation'),
  ('process', 'step_4_text', 'fr', 'Photos, relevés, observations et éléments autorisés.'),
  ('process', 'step_5_title', 'fr', 'Rapport'),
  ('process', 'step_5_text', 'fr', 'Un rapport clair, avec les preuves associées.'),
  ('deliverables', 'item_1', 'fr', 'Rapport PDF et synthèse de mission'),
  ('deliverables', 'item_2', 'fr', 'Checklist complétée, point par point'),
  ('deliverables', 'item_3', 'fr', 'Observations factuelles et écarts constatés'),
  ('deliverables', 'item_4', 'fr', 'Photographies originales et relevés effectués'),
  ('deliverables', 'item_5', 'fr', 'Documents accessibles et autorisés'),
  ('deliverables', 'item_6', 'fr', 'Points nécessitant éventuellement un spécialiste'),
  ('pricing', 'tag', 'fr', 'Tarifs indicatifs'),
  ('pricing', 'subtitle', 'fr', 'Chaque mission est adaptée à votre cahier des charges.'),
  ('pricing', 'from', 'fr', 'À partir de '),
  ('pricing', 'note', 'fr', 'Tarifs indicatifs, hors frais de déplacement et prestations spécifiques.'),
  ('contact', 'label_name', 'fr', 'Nom'),
  ('contact', 'label_company', 'fr', 'Entreprise'),
  ('contact', 'label_email', 'fr', 'Email'),
  ('contact', 'label_phone', 'fr', 'Téléphone'),
  ('contact', 'label_mission', 'fr', 'Mission'),
  ('contact', 'placeholder_name', 'fr', 'Votre nom'),
  ('contact', 'placeholder_company', 'fr', 'Votre entreprise'),
  ('contact', 'placeholder_email', 'fr', 'votre@email.com'),
  ('contact', 'placeholder_mission', 'fr', 'Décrivez votre mission...'),
  ('missions', 'item_1_title', 'en', 'Supplier / Partner'),
  ('missions', 'item_1_description', 'en', 'Site existence, observed activity, visible equipment, staff present, production environment, accessible documents and photographs.'),
  ('missions', 'item_2_title', 'en', 'Order / Production'),
  ('missions', 'item_2_description', 'en', 'References, quantities, dimensions, apparent condition, packaging, progress, pre-shipment preparation and photographic evidence.'),
  ('missions', 'item_3_title', 'en', 'Project / Site'),
  ('missions', 'item_3_description', 'en', 'Site visit, progress status, environment, equipment present, general configuration and photographic records.'),
  ('missions', 'item_4_title', 'en', 'Custom mission'),
  ('missions', 'item_4_description', 'en', 'Any mission precisely defined by an on-site scope of work. You list the items to check; we handle them one by one.'),
  ('process', 'step_1_title', 'en', 'Brief'),
  ('process', 'step_1_text', 'en', 'You define the objective and items to check.'),
  ('process', 'step_2_title', 'en', 'Preparation'),
  ('process', 'step_2_text', 'en', 'We turn the request into a field checklist.'),
  ('process', 'step_3_title', 'en', 'Visit'),
  ('process', 'step_3_text', 'en', 'Travel to the site and carry out the mission.'),
  ('process', 'step_4_title', 'en', 'Documentation'),
  ('process', 'step_4_text', 'en', 'Photos, records, observations and authorized items.'),
  ('process', 'step_5_title', 'en', 'Report'),
  ('process', 'step_5_text', 'en', 'A clear report, with supporting evidence.'),
  ('deliverables', 'item_1', 'en', 'PDF report and mission summary'),
  ('deliverables', 'item_2', 'en', 'Checklist completed, point by point'),
  ('deliverables', 'item_3', 'en', 'Factual observations and noted discrepancies'),
  ('deliverables', 'item_4', 'en', 'Original photographs and records taken'),
  ('deliverables', 'item_5', 'en', 'Accessible and authorized documents'),
  ('deliverables', 'item_6', 'en', 'Items that may require a specialist'),
  ('pricing', 'tag', 'en', 'Indicative pricing'),
  ('pricing', 'subtitle', 'en', 'Each mission is tailored to your scope of work.'),
  ('pricing', 'from', 'en', 'From '),
  ('pricing', 'note', 'en', 'Indicative prices, excluding travel expenses and specific services.'),
  ('contact', 'label_name', 'en', 'Name'),
  ('contact', 'label_company', 'en', 'Company'),
  ('contact', 'label_email', 'en', 'Email'),
  ('contact', 'label_phone', 'en', 'Phone'),
  ('contact', 'label_mission', 'en', 'Mission'),
  ('contact', 'placeholder_name', 'en', 'Your name'),
  ('contact', 'placeholder_company', 'en', 'Your company'),
  ('contact', 'placeholder_email', 'en', 'your@email.com'),
  ('contact', 'placeholder_mission', 'en', 'Describe your mission...')
on conflict (section, key, language) do nothing;

notify pgrst, 'reload schema';
