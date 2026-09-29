-- Créer les tables CRM pour la gestion des contacts et interactions
-- Exécutez ce SQL dans votre dashboard Supabase (SQL Editor)

-- Table des contacts CRM
CREATE TABLE IF NOT EXISTS crm_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id), -- Lien avec l'utilisateur si c'est un client existant
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  company TEXT,
  position TEXT,
  status TEXT DEFAULT 'prospect' CHECK (status IN ('prospect', 'client', 'inactive', 'lost')),
  source TEXT, -- Comment ils ont été contactés (référence, site web, etc.)
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Table des interactions avec les contacts
CREATE TABLE IF NOT EXISTS crm_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note', 'task')),
  subject TEXT,
  description TEXT,
  outcome TEXT, -- Résultat de l'interaction
  next_action TEXT, -- Action à suivre
  next_action_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Table des tâches CRM
CREATE TABLE IF NOT EXISTS crm_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES crm_contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_crm_contacts_user_id ON crm_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_status ON crm_contacts(status);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_company ON crm_contacts(company);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_contact_id ON crm_interactions(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_type ON crm_interactions(type);
CREATE INDEX IF NOT EXISTS idx_crm_interactions_created_at ON crm_interactions(created_at);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_contact_id ON crm_tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON crm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned_to ON crm_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due_date ON crm_tasks(due_date);
