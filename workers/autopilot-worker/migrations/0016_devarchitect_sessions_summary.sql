-- Añade columna summary para sesiones DevArchitect
ALTER TABLE devarchitect_sessions
  ADD COLUMN summary TEXT DEFAULT NULL;
