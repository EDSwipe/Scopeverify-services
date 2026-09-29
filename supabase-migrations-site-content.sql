-- Créer la table site_content pour gérer les textes du site
-- Exécutez ce SQL dans votre dashboard Supabase (SQL Editor)

CREATE TABLE IF NOT EXISTS site_content (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section TEXT NOT NULL, -- hero, intro, missions, process, deliverables, limits, contact
  key TEXT NOT NULL, -- hero_title, hero_subtitle, intro_tag, etc.
  language TEXT NOT NULL CHECK (language IN ('fr', 'en')),
  content TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  UNIQUE(section, key, language)
);

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_site_content_section ON site_content(section);
CREATE INDEX IF NOT EXISTS idx_site_content_language ON site_content(language);
CREATE INDEX IF NOT EXISTS idx_site_content_section_key_language ON site_content(section, key, language);

-- Insérer le contenu initial en français
INSERT INTO site_content (section, key, language, content) VALUES
  -- Hero section
  ('hero', 'eyebrow', 'fr', 'Présentation de service · Field Verification'),
  ('hero', 'title_1', 'fr', 'Votre relais indépendant'),
  ('hero', 'title_2', 'fr', 'sur le terrain.'),
  ('hero', 'text', 'fr', 'Vous ne pouvez pas être sur place ? Nous y allons pour vous. SCOPE-VERIFY constate, documente et rapporte les éléments définis dans votre cahier des charges.'),
  ('hero', 'action', 'fr', 'Définir une mission'),
  ('hero', 'field', 'fr', 'VOS YEUX SUR LE TERRAIN'),
  ('hero', 'footer', 'fr', 'Constater · Documenter · Rapporter'),
  ('hero', 'country', 'fr', 'FRANCE'),
  
  -- Intro section
  ('intro', 'tag', 'fr', 'Le problème · Notre réponse'),
  ('intro', 'title_1', 'fr', 'À distance, certaines décisions nécessitent simplement…'),
  ('intro', 'title_2', 'fr', 'd''être sur place.'),
  ('intro', 'text', 'fr', 'Le problème n''est pas de savoir quoi vérifier. Le problème est de pouvoir être physiquement sur place. Nous devenons vos yeux sur le terrain, afin de vous transmettre des faits documentés avant votre décision.'),
  ('intro', 'discover', 'fr', 'Découvrir nos missions'),
  
  -- Missions section
  ('missions', 'tag', 'fr', 'Nos missions'),
  ('missions', 'subtitle', 'fr', 'Une mission. Un cahier des charges. Un rapport exploitable.'),
  
  -- Process section
  ('process', 'tag', 'fr', 'Comment ça marche'),
  ('process', 'title_1', 'fr', 'De la demande'),
  ('process', 'title_2', 'fr', 'au rapport.'),
  ('process', 'note', 'fr', 'Vous n''avez aucune logistique terrain à gérer : déplacement, prise de rendez-vous et exécution sont de notre côté.'),
  
  -- Deliverables section
  ('deliverables', 'tag', 'fr', 'Le livrable'),
  ('deliverables', 'title_1', 'fr', 'Vous ne recevez pas simplement des'),
  ('deliverables', 'title_2', 'fr', 'photos.'),
  ('deliverables', 'text', 'fr', 'Chaque observation importante est reliée à un élément de preuve lorsque celui-ci est disponible.'),
  
  -- Limits section
  ('limits', 'tag', 'fr', 'Nos limites = notre fiabilité'),
  ('limits', 'title_1', 'fr', 'Une mission indépendante, avec un cadre'),
  ('limits', 'title_2', 'fr', 'clair.'),
  ('limits', 'text', 'fr', 'Nous constatons et documentons les éléments définis dans le cahier des charges. Notre rôle est de vous donner une vision fiable de ce qui peut être constaté sur le terrain.'),
  ('limits', 'more', 'fr', 'Nous ne nous substituons pas à un expert technique, un auditeur, un organisme de certification, un contrôleur réglementaire ou un professionnel habilité. Lorsqu''une qualification est nécessaire, la mission est complétée par un spécialiste.'),
  
  -- Contact section
  ('contact', 'tag', 'fr', 'Passons à l''action'),
  ('contact', 'title_1', 'fr', 'Besoin de quelqu''un'),
  ('contact', 'title_2', 'fr', 'sur le terrain ?'),
  ('contact', 'text', 'fr', 'Remplissez le formulaire ci-dessous ou contactez-nous directement par email.'),
  ('contact', 'phone_label', 'fr', 'Téléphone'),
  ('contact', 'send', 'fr', 'Envoyer'),
  ('contact', 'success', 'fr', 'Demande envoyée. Nous vous répondrons rapidement.'),
  ('contact', 'disabled_message', 'fr', 'Le formulaire de mission est temporairement désactivé. Veuillez nous contacter par email pour toute demande de mission.'),
  
  -- Footer
  ('footer', 'text', 'fr', 'Tous droits réservés.')
ON CONFLICT (section, key, language) DO NOTHING;

-- Insérer le contenu initial en anglais
INSERT INTO site_content (section, key, language, content) VALUES
  -- Hero section
  ('hero', 'eyebrow', 'en', 'Service presentation · Field Verification'),
  ('hero', 'title_1', 'en', 'Your independent representative'),
  ('hero', 'title_2', 'en', 'on the ground.'),
  ('hero', 'text', 'en', 'Cannot be on site? We go for you. SCOPE-VERIFY observes, documents and reports the items defined in your scope of work.'),
  ('hero', 'action', 'en', 'Define a mission'),
  ('hero', 'field', 'en', 'YOUR EYES ON THE GROUND'),
  ('hero', 'footer', 'en', 'Observe · Document · Report'),
  ('hero', 'country', 'en', 'FRANCE'),
  
  -- Intro section
  ('intro', 'tag', 'en', 'The issue · Our response'),
  ('intro', 'title_1', 'en', 'From a distance, some decisions simply require…'),
  ('intro', 'title_2', 'en', 'being on site.'),
  ('intro', 'text', 'en', 'The issue is not knowing what to check. The issue is being physically present. We become your eyes on the ground, giving you documented facts before you decide.'),
  ('intro', 'discover', 'en', 'Explore our missions'),
  
  -- Missions section
  ('missions', 'tag', 'en', 'Our missions'),
  ('missions', 'subtitle', 'en', 'One mission. One scope of work. One actionable report.'),
  
  -- Process section
  ('process', 'tag', 'en', 'How it works'),
  ('process', 'title_1', 'en', 'From request'),
  ('process', 'title_2', 'en', 'to report.'),
  ('process', 'note', 'en', 'You have no field logistics to manage: travel, appointment scheduling and execution are our responsibility.'),
  
  -- Deliverables section
  ('deliverables', 'tag', 'en', 'What you receive'),
  ('deliverables', 'title_1', 'en', 'You do not simply receive'),
  ('deliverables', 'title_2', 'en', 'photos.'),
  ('deliverables', 'text', 'en', 'Every important observation is linked to supporting evidence whenever it is available.'),
  
  -- Limits section
  ('limits', 'tag', 'en', 'Our limits = our reliability'),
  ('limits', 'title_1', 'en', 'An independent mission,'),
  ('limits', 'title_2', 'en', 'with a clear framework.'),
  ('limits', 'text', 'en', 'We observe and document the items defined in the scope of work. Our role is to give you a reliable view of what can be observed on site.'),
  ('limits', 'more', 'en', 'We do not replace a technical expert, auditor, certification body, regulatory inspector or licensed professional. When a specific qualification is required, the mission is complemented by a specialist.'),
  
  -- Contact section
  ('contact', 'tag', 'en', 'Let''s take action'),
  ('contact', 'title_1', 'en', 'Need someone'),
  ('contact', 'title_2', 'en', 'on the ground?'),
  ('contact', 'text', 'en', 'Fill out the form below or contact us directly by email.'),
  ('contact', 'phone_label', 'en', 'Phone'),
  ('contact', 'send', 'en', 'Send'),
  ('contact', 'success', 'en', 'Request sent. We will respond quickly.'),
  ('contact', 'disabled_message', 'en', 'The mission form is temporarily disabled. Please contact us by email for any mission request.'),
  
  -- Footer
  ('footer', 'text', 'en', 'All rights reserved.')
ON CONFLICT (section, key, language) DO NOTHING;
