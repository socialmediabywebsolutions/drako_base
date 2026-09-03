ALTER TABLE socialcors_physical_profile ADD COLUMN hair_texture TEXT CHECK (hair_texture IN ('liso','ondulado','rizado','muy_rizado','con_mechas','con_highlights'));
ALTER TABLE socialcors_physical_profile ADD COLUMN reference_face_r2_key TEXT;
