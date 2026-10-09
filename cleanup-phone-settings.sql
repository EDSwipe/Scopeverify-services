-- Supprimer les paramètres d'affichage téléphone ajoutés
-- Exécutez ce SQL dans votre dashboard Supabase (SQL Editor)

DELETE FROM site_settings WHERE key IN ('phone_display_enabled', 'whatsapp_display_enabled');