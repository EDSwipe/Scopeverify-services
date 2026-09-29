-- Créer les tables pour le Calendrier partagé
-- Exécutez ce SQL dans votre dashboard Supabase (SQL Editor)

-- Table des événements de calendrier
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT DEFAULT 'mission' CHECK (event_type IN ('mission', 'meeting', 'availability', 'holiday', 'other')),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  all_day BOOLEAN DEFAULT false,
  location TEXT,
  mission_id UUID REFERENCES missions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  color TEXT DEFAULT '#007bff',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Table des disponibilités des collaborateurs
CREATE TABLE IF NOT EXISTS collaborator_availability (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_available BOOLEAN DEFAULT true,
  start_time TIME,
  end_time TIME,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_end_date ON calendar_events(end_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_mission_id ON calendar_events(mission_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_type ON calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_collaborator_availability_user_id ON collaborator_availability(user_id);
CREATE INDEX IF NOT EXISTS idx_collaborator_availability_date ON collaborator_availability(date);
CREATE INDEX IF NOT EXISTS idx_collaborator_availability_is_available ON collaborator_availability(is_available);
