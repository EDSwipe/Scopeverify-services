-- Run this in the Supabase SQL editor and paste back both result sets.

-- 1) Which table(s) does this trigger actually exist on?
select event_object_table, trigger_name, action_timing, event_manipulation
from information_schema.triggers
where trigger_name = 'trg_mission_update_guard';

-- 2) Does public.missions actually have the validation_status / validation_notes columns?
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'missions'
order by ordinal_position;
