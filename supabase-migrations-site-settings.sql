-- Créer la table site_settings pour les paramètres globaux
-- Exécutez ce SQL dans votre dashboard Supabase (SQL Editor)

CREATE TABLE IF NOT EXISTS site_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insérer les paramètres par défaut pour toutes les fonctionnalités
INSERT INTO site_settings (key, value) VALUES
  ('public_registration_enabled', 'true'),
  ('mission_form_enabled', 'true'),
  ('crm_enabled', 'false'),
  ('sales_pipeline_enabled', 'false'),
  ('invoices_enabled', 'false'),
  ('segmentation_enabled', 'false'),
  ('marketing_automation_enabled', 'false'),
  ('calendar_enabled', 'false'),
  ('document_management_enabled', 'false'),
  ('advanced_notifications_enabled', 'false'),
  ('reporting_enabled', 'false'),
  ('audit_logs_enabled', 'false'),
  ('skills_management_enabled', 'false'),
  ('availability_enabled', 'false'),
  ('feedback_enabled', 'false')
ON CONFLICT (key) DO NOTHING;
