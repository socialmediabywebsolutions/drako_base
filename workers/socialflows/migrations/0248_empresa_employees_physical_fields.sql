-- Applies to: SOCIAL_DB (saas_socialflows_prod_db)
-- Campos físicos detallados por empleado, al mismo nivel que socialcors_physical_profile
-- (influencer) — permite a SDXL generar imágenes precisas de cada miembro del equipo
-- de una cuenta empresa.
ALTER TABLE saas_empresa_employees ADD COLUMN age INTEGER;
ALTER TABLE saas_empresa_employees ADD COLUMN height_cm INTEGER;
ALTER TABLE saas_empresa_employees ADD COLUMN weight_kg INTEGER;
ALTER TABLE saas_empresa_employees ADD COLUMN gender TEXT CHECK (gender IN ('hombre','mujer','no_binario'));
ALTER TABLE saas_empresa_employees ADD COLUMN skin_tone TEXT CHECK (skin_tone IN ('muy_clara','clara','media','olivacea','morena','oscura','muy_oscura'));
ALTER TABLE saas_empresa_employees ADD COLUMN hair_color TEXT;
ALTER TABLE saas_empresa_employees ADD COLUMN hair_style TEXT CHECK (hair_style IN ('liso','ondulado','rizado','muy_rizado_afro'));
ALTER TABLE saas_empresa_employees ADD COLUMN hair_length TEXT CHECK (hair_length IN ('rapado','muy_corto','corto','medio','largo','muy_largo'));
ALTER TABLE saas_empresa_employees ADD COLUMN eye_color TEXT;
ALTER TABLE saas_empresa_employees ADD COLUMN body_constitution TEXT CHECK (body_constitution IN ('ectomorfo','mesomorfo','endomorfo','mixto'));
ALTER TABLE saas_empresa_employees ADD COLUMN face_shape TEXT;
ALTER TABLE saas_empresa_employees ADD COLUMN tattoos TEXT;
ALTER TABLE saas_empresa_employees ADD COLUMN beard TEXT;
