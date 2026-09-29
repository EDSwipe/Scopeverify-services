-- Créer les tables pour le Pipeline de ventes
-- Exécutez ce SQL dans votre dashboard Supabase (SQL Editor)

-- Table des pipelines de ventes
CREATE TABLE IF NOT EXISTS sales_pipelines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des étapes de pipeline
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID REFERENCES sales_pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  color TEXT DEFAULT '#6c757d',
  probability INTEGER DEFAULT 0, -- Pourcentage de probabilité de conversion
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des opportunités de vente (leads/deals)
CREATE TABLE IF NOT EXISTS sales_opportunities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL,
  pipeline_id UUID REFERENCES sales_pipelines(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  value NUMERIC, -- Valeur estimée de l'opportunité
  currency TEXT DEFAULT 'EUR',
  expected_close_date DATE,
  actual_close_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'won', 'lost')),
  lost_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  assigned_to UUID REFERENCES users(id)
);

-- Table des activités sur les opportunités
CREATE TABLE IF NOT EXISTS opportunity_activities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID REFERENCES sales_opportunities(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note', 'task')),
  description TEXT,
  outcome TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_sales_pipelines_is_default ON sales_pipelines(is_default);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline_id ON pipeline_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_order_index ON pipeline_stages(pipeline_id, order_index);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_contact_id ON sales_opportunities(contact_id);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_pipeline_id ON sales_opportunities(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_stage_id ON sales_opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_status ON sales_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_sales_opportunities_assigned_to ON sales_opportunities(assigned_to);
CREATE INDEX IF NOT EXISTS idx_opportunity_activities_opportunity_id ON opportunity_activities(opportunity_id);

-- Insérer un pipeline par défaut avec des étapes standards
INSERT INTO sales_pipelines (name, description, is_default) VALUES
  ('Pipeline par défaut', 'Pipeline de vente standard', true)
ON CONFLICT DO NOTHING;

-- Insérer les étapes par défaut pour le pipeline
INSERT INTO pipeline_stages (pipeline_id, name, order_index, color, probability) VALUES
  ((SELECT id FROM sales_pipelines WHERE is_default = true LIMIT 1), 'Nouveau', 1, '#6c757d', 10),
  ((SELECT id FROM sales_pipelines WHERE is_default = true LIMIT 1), 'Qualifié', 2, '#17a2b8', 25),
  ((SELECT id FROM sales_pipelines WHERE is_default = true LIMIT 1), 'Proposition envoyée', 3, '#ffc107', 50),
  ((SELECT id FROM sales_pipelines WHERE is_default = true LIMIT 1), 'Négociation', 4, '#fd7e14', 75),
  ((SELECT id FROM sales_pipelines WHERE is_default = true LIMIT 1), 'Gagné', 5, '#28a745', 100),
  ((SELECT id FROM sales_pipelines WHERE is_default = true LIMIT 1), 'Perdu', 6, '#dc3545', 0)
ON CONFLICT DO NOTHING;
