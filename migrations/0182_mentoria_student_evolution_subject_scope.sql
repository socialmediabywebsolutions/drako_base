ALTER TABLE mentoria_student_evolution
ADD COLUMN subject_slug TEXT NOT NULL DEFAULT 'general';

UPDATE mentoria_student_evolution
SET subject_slug = 'general'
WHERE subject_slug IS NULL OR TRIM(subject_slug) = '';

DROP INDEX IF EXISTS idx_mentoria_student_evolution_tenant_student;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_student_evolution_tenant_student_subject
ON mentoria_student_evolution(tenant_id, student_profile_id, subject_slug);
