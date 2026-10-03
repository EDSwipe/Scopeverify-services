-- Migration pour la gestion des documents juridiques
-- Création de la table legal_documents et du bucket de stockage

-- Création de la table pour stocker les métadonnées des documents juridiques
CREATE TABLE IF NOT EXISTS legal_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type VARCHAR(50) NOT NULL CHECK (type IN ('mentions_legales', 'cgu', 'cgv', 'rgpd', 'cookies', 'autre')),
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Création d'un index sur le type pour faciliter les recherches
CREATE INDEX IF NOT EXISTS idx_legal_documents_type ON legal_documents(type);
CREATE INDEX IF NOT EXISTS idx_legal_documents_updated_at ON legal_documents(updated_at DESC);

-- Activer Row Level Security
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;

-- Politique RLS: seul les admins et moderators peuvent lire
CREATE POLICY "Admins and moderators can view legal documents"
  ON legal_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'moderator')
    )
  );

-- Politique RLS: seul les admins peuvent insérer
CREATE POLICY "Admins can insert legal documents"
  ON legal_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Politique RLS: seul les admins peuvent mettre à jour
CREATE POLICY "Admins can update legal documents"
  ON legal_documents FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Politique RLS: seul les admins peuvent supprimer
CREATE POLICY "Admins can delete legal documents"
  ON legal_documents FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Note: Le bucket de stockage 'legal-documents' doit être créé manuellement dans la console Supabase
-- avec les politiques RLS appropriées pour permettre aux admins de télécharger et supprimer les fichiers
