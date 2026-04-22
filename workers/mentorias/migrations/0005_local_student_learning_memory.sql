CREATE TABLE IF NOT EXISTS mentoria_student_learning_memory (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  student_profile_id TEXT NOT NULL,
  strongest_subjects_json TEXT NOT NULL DEFAULT '[]',
  weakest_subjects_json TEXT NOT NULL DEFAULT '[]',
  preferred_explanation_style TEXT NOT NULL DEFAULT 'text_step_by_step',
  average_response_speed TEXT NOT NULL DEFAULT 'medium',
  confidence_trend TEXT NOT NULL DEFAULT 'stable',
  frustration_trend TEXT NOT NULL DEFAULT 'stable',
  consistency_trend TEXT NOT NULL DEFAULT 'stable',
  repetition_risk_signals_json TEXT NOT NULL DEFAULT '[]',
  motivation_pattern TEXT NOT NULL DEFAULT 'steady',
  best_session_length INTEGER NOT NULL DEFAULT 20,
  best_session_time_window TEXT NOT NULL DEFAULT 'unknown',
  last_adaptation_summary_json TEXT NOT NULL DEFAULT '{}',
  style_evidence_json TEXT NOT NULL DEFAULT '{}',
  time_window_evidence_json TEXT NOT NULL DEFAULT '{}',
  adaptation_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (student_profile_id) REFERENCES student_profiles(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mentoria_student_learning_memory_tenant_student
  ON mentoria_student_learning_memory(tenant_id, student_profile_id);
