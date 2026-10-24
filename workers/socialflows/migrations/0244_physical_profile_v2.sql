ALTER TABLE socialcors_physical_profile ADD COLUMN gender TEXT CHECK (gender IN ('mujer','hombre','no_binario','prefiero_no_decir'));
ALTER TABLE socialcors_physical_profile ADD COLUMN cup_size TEXT CHECK (cup_size IN ('AA','A','B','C','D','DD','E','F'));
ALTER TABLE socialcors_physical_profile ADD COLUMN body_constitution TEXT CHECK (body_constitution IN ('ectomorfo','mesomorfo','endomorfo','mixto'));
ALTER TABLE socialcors_physical_profile ADD COLUMN face_shape TEXT CHECK (face_shape IN ('ovalada','redonda','cuadrada','corazon','alargada'));
ALTER TABLE socialcors_physical_profile ADD COLUMN eye_color TEXT CHECK (eye_color IN ('marrones','verdes','azules','grises','miel','negros','heterocromia'));
ALTER TABLE socialcors_physical_profile ADD COLUMN content_visual_style TEXT;
ALTER TABLE socialcors_physical_profile ADD COLUMN tattoos TEXT;
ALTER TABLE socialcors_physical_profile ADD COLUMN beard TEXT CHECK (beard IN ('sin_barba','corta','larga','bigote'));
ALTER TABLE socialcors_physical_profile ADD COLUMN hair_style TEXT;
ALTER TABLE socialcors_physical_profile ADD COLUMN hair_color_base TEXT;

-- El BLOQUE D del perfil físico (ver profile/page.tsx) amplía "Largo de cabello" a 6 opciones
-- (rapado/muy_corto/corto/medio/largo/muy_largo), pero el CHECK original de hair_length
-- (migración 0241) solo permitía corto/medio/largo. SQLite no soporta ALTER de un CHECK
-- existente, así que la tabla se reconstruye para ampliarlo — el resto de columnas y
-- constraints se preservan tal cual.
CREATE TABLE socialcors_physical_profile_new (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  reference_image_url TEXT,
  height_cm INTEGER,
  weight_kg REAL,
  body_type TEXT CHECK (body_type IN ('atletica','fibrada','normal','curvilinea','musculosa')),
  chest_cm INTEGER,
  waist_cm INTEGER,
  hips_cm INTEGER,
  fitness_style TEXT CHECK (fitness_style IN ('competicion','funcional','crossfit','yoga','pilates','lifestyle','running')),
  skin_tone TEXT,
  hair_color TEXT,
  hair_length TEXT CHECK (hair_length IN ('rapado','muy_corto','corto','medio','largo','muy_largo')),
  extra_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  fitness_styles_json TEXT,
  hair_texture TEXT CHECK (hair_texture IN ('liso','ondulado','rizado','muy_rizado','con_mechas','con_highlights')),
  reference_face_r2_key TEXT,
  gender TEXT CHECK (gender IN ('mujer','hombre','no_binario','prefiero_no_decir')),
  cup_size TEXT CHECK (cup_size IN ('AA','A','B','C','D','DD','E','F')),
  body_constitution TEXT CHECK (body_constitution IN ('ectomorfo','mesomorfo','endomorfo','mixto')),
  face_shape TEXT CHECK (face_shape IN ('ovalada','redonda','cuadrada','corazon','alargada')),
  eye_color TEXT CHECK (eye_color IN ('marrones','verdes','azules','grises','miel','negros','heterocromia')),
  content_visual_style TEXT,
  tattoos TEXT,
  beard TEXT CHECK (beard IN ('sin_barba','corta','larga','bigote')),
  hair_style TEXT,
  hair_color_base TEXT
);

INSERT INTO socialcors_physical_profile_new (
  id, tenant_id, reference_image_url, height_cm, weight_kg, body_type, chest_cm, waist_cm, hips_cm,
  fitness_style, skin_tone, hair_color, hair_length, extra_notes, created_at, updated_at,
  fitness_styles_json, hair_texture, reference_face_r2_key, gender, cup_size, body_constitution,
  face_shape, eye_color, content_visual_style, tattoos, beard, hair_style, hair_color_base
)
SELECT
  id, tenant_id, reference_image_url, height_cm, weight_kg, body_type, chest_cm, waist_cm, hips_cm,
  fitness_style, skin_tone, hair_color, hair_length, extra_notes, created_at, updated_at,
  fitness_styles_json, hair_texture, reference_face_r2_key, gender, cup_size, body_constitution,
  face_shape, eye_color, content_visual_style, tattoos, beard, hair_style, hair_color_base
FROM socialcors_physical_profile;

DROP TABLE socialcors_physical_profile;
ALTER TABLE socialcors_physical_profile_new RENAME TO socialcors_physical_profile;
