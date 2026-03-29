import type { StudentProfile } from "@/lib/mentoria/types";

export type LearningProfile = {
  stage: "primary" | "eso" | "bachillerato";
  tone: "playful" | "guided" | "direct";
  explanationStyle: "simple" | "structured" | "analytical";
};

function normalizeSchoolYear(schoolYear: string): string {
  return schoolYear.trim().toLowerCase();
}

export function resolveLearningStage(profile: Pick<StudentProfile, "schoolYear" | "age">): LearningProfile["stage"] {
  const normalizedYear = normalizeSchoolYear(profile.schoolYear);
  if (normalizedYear.includes("bachillerato")) return "bachillerato";
  if (normalizedYear.includes("eso")) return "eso";
  if (normalizedYear.includes("primaria")) return "primary";
  if (profile.age >= 16) return "bachillerato";
  if (profile.age >= 12) return "eso";
  return "primary";
}

export function getLearningProfile(profile: Pick<StudentProfile, "schoolYear" | "age">): LearningProfile {
  const stage = resolveLearningStage(profile);
  if (stage === "primary") {
    return {
      stage,
      tone: "playful",
      explanationStyle: "simple",
    };
  }

  if (stage === "eso") {
    return {
      stage,
      tone: "guided",
      explanationStyle: "structured",
    };
  }

  return {
    stage,
    tone: "direct",
    explanationStyle: "analytical",
  };
}
