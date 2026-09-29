-- Migration pour ajouter validation_status et validation_notes aux missions
-- Exécutez ce SQL dans votre dashboard Supabase (SQL Editor)

-- Ajouter les colonnes de validation à la table missions
ALTER TABLE missions 
ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validated', 'rejected')),
ADD COLUMN IF NOT EXISTS validation_notes TEXT;

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_missions_validation_status ON missions(validation_status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_to ON support_tickets(assigned_to);

-- Créer la table site_settings pour les paramètres globaux
CREATE TABLE IF NOT EXISTS site_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insérer le paramètre par défaut pour l'inscription publique
INSERT INTO site_settings (key, value) 
VALUES ('public_registration_enabled', 'true')
ON CONFLICT (key) DO NOTHING;