import fs from "node:fs";

const servicePath = String.raw`\\wsl$\Ubuntu-22.04\home\drako\workspace\drako_base\src\lib\mentoria\service.ts`;

function replaceBetween(source, startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`Start marker not found: ${startMarker}`);
  }
  const end = source.indexOf(endMarker, start);
  if (end === -1) {
    throw new Error(`End marker not found: ${endMarker}`);
  }
  return source.slice(0, start) + replacement + source.slice(end);
}

let service = fs.readFileSync(servicePath, "utf8");

service = replaceBetween(
  service,
  "  private async resolveStudentForActor(actor: MentoriaSessionActor): Promise<StudentProfile | null> {",
  "  private async syncUserContext(\n",
`  private async resolveStudentForActor(
    actor: MentoriaSessionActor,
    options?: { studentProfileId?: string | null; fallbackToFirstAccessible?: boolean },
  ): Promise<StudentProfile | null> {
    const requestedStudentProfileId = options?.studentProfileId?.trim() || "";
    const directStudent = await this.repository.getStudentProfileByUser(actor.tenantId, actor.userId);
    if (directStudent) {
      if (requestedStudentProfileId && directStudent.id !== requestedStudentProfileId) {
        throw new Error("STUDENT_ACCESS_DENIED");
      }
      return directStudent;
    }

    const accessibleStudents = await this.repository.listGuardianAccessibleStudents(actor.tenantId, actor.userId).catch(() => []);
    if (accessibleStudents.length === 0) {
      return null;
    }

    if (requestedStudentProfileId) {
      const explicitAccess = accessibleStudents.find((item) => item.studentProfileId === requestedStudentProfileId || item.studentId === requestedStudentProfileId) ?? null;
      if (!explicitAccess) {
        throw new Error("STUDENT_ACCESS_DENIED");
      }
      return this.repository.getStudentProfileById(actor.tenantId, explicitAccess.studentProfileId);
    }

    if (options?.fallbackToFirstAccessible === false) {
      return null;
    }

    const prioritizedStudents = [...accessibleStudents].sort((left, right) => {
      if (left.isPrimaryContact !== right.isPrimaryContact) {
        return Number(right.isPrimaryContact) - Number(left.isPrimaryContact);
      }

      const leftCreatedAt = Date.parse(left.createdAt);
      const rightCreatedAt = Date.parse(right.createdAt);
      const leftTime = Number.isFinite(leftCreatedAt) ? leftCreatedAt : 0;
      const rightTime = Number.isFinite(rightCreatedAt) ? rightCreatedAt : 0;
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      return left.studentProfileId.localeCompare(right.studentProfileId);
    });

    for (const access of prioritizedStudents) {
      const student = await this.repository.getStudentProfileById(actor.tenantId, access.studentProfileId);
      if (student) {
        return student;
      }
    }

    return null;
  }

  private async syncUserContext(
`);

service = service.replace(
  `  async getProfile(actor: MentoriaSessionActor): Promise<StudentProfile | null> {\n    await this.repository.seedSubjects(actor.tenantId);\n    return this.resolveStudentForActor(actor);\n  }`,
  `  async getProfile(actor: MentoriaSessionActor, studentProfileId?: string): Promise<StudentProfile | null> {\n    await this.repository.seedSubjects(actor.tenantId);\n    return this.resolveStudentForActor(actor, { studentProfileId });\n  }`,
);

service = service.replace(
  `  async requireOnboardedStudent(actor: MentoriaSessionActor): Promise<StudentProfile> {\n    const student = await this.getProfile(actor);\n    if (!student || !student.onboardingCompleted) {\n      throw new Error("ONBOARDING_REQUIRED");\n    }\n    return student;\n  }`,
  `  async requireOnboardedStudent(actor: MentoriaSessionActor, studentProfileId?: string): Promise<StudentProfile> {\n    const student = await this.getProfile(actor, studentProfileId);\n    if (!student || !student.onboardingCompleted) {\n      throw new Error("ONBOARDING_REQUIRED");\n    }\n    return student;\n  }`,
);

service = replaceBetween(
  service,
  `  async getOnboardingState(actor: MentoriaSessionActor): Promise<MentoriaOnboardingState> {\n`,
  `  async requireOnboardedStudent(actor: MentoriaSessionActor, studentProfileId?: string): Promise<StudentProfile> {\n`,
`  async getOnboardingState(actor: MentoriaSessionActor): Promise<MentoriaOnboardingState> {
    await this.repository.seedSubjects(actor.tenantId);
    const primaryGuardian = actor.email
      ? await this.familyRepository.getGuardianByFamilyAndEmail(actor.tenantId, actor.email)
      : null;
    const student = await this.resolveStudentForActor(actor);
    const familyStudents = await this.repository.listStudentsForTenant(actor.tenantId);
    const subjects = await this.repository.listSubjects(actor.tenantId);
    const canonical = student ? await this.getCanonicalFamilyContract(actor, student) : {
      family: await this.familyRepository.getFamilyById(actor.tenantId),
      primaryGuardian,
      secondaryGuardians: primaryGuardian ? [] : await this.familyRepository.listGuardiansByFamily(actor.tenantId).then((guardians) => guardians.filter((guardian) => guardian.systemRole !== "primary_guardian")),
      guardianStudentAccess: [] as MentoriaGuardianStudentAccess[],
    };
    if (!student) {
      return {
        sessionEmail: actor.email ?? null,
        primaryGuardian: primaryGuardian
          ? {
              fullName: primaryGuardian.name ?? "",
              relation: primaryGuardian.familyRelation,
            }
          : null,
        student: null,
        profile: null,
        familyStudents,
        subjects,
        studentSubjects: [],
        family: canonical.family,
        secondaryGuardians: canonical.secondaryGuardians,
        guardianStudentAccess: canonical.guardianStudentAccess,
        sessionContext: this.buildSessionContext(actor, null, canonical),
      };
    }
    const studentSubjects = await this.repository.listStudentSubjects(actor.tenantId, student.id);
    return {
      sessionEmail: actor.email ?? null,
      primaryGuardian: primaryGuardian
        ? {
            fullName: primaryGuardian.name ?? "",
            relation: primaryGuardian.familyRelation,
          }
        : null,
      student,
      profile: student,
      familyStudents,
      subjects,
      studentSubjects,
      family: canonical.family,
      secondaryGuardians: canonical.secondaryGuardians,
      guardianStudentAccess: canonical.guardianStudentAccess,
      sessionContext: this.buildSessionContext(actor, student, canonical),
    };
  }

  async requireOnboardedStudent(actor: MentoriaSessionActor, studentProfileId?: string): Promise<StudentProfile> {
`);

service = replaceBetween(
  service,
  `  async submitOnboarding(actor: MentoriaSessionActor, payload: MentoriaOnboardingPayload): Promise<{\n`,
  `  async getDashboard(actor: MentoriaSessionActor): Promise<\n`,
`  async submitOnboarding(actor: MentoriaSessionActor, payload: MentoriaOnboardingPayload): Promise<{
    student: StudentProfile;
    family: MentoriaFamily | null;
    primaryGuardian: MentoriaGuardian | null;
    secondaryGuardians: MentoriaGuardian[];
    guardianStudentAccess: MentoriaGuardianStudentAccess[];
    sessionContext: MentoriaSessionContext;
    plan: StudyPlan;
    progress: MentoriaProgress[];
    activation: ActivationEvent & {
      subjectSlug: string;
      subjectName: string;
      reply: string;
      dailyPlan: DailyPlan;
    };
  }> {
    await this.repository.seedSubjects(actor.tenantId);

    if (!payload.primaryGuardian.fullName.trim()) throw new Error("INVALID_PRIMARY_GUARDIAN_NAME");
    if (!payload.primaryGuardian.relation) throw new Error("INVALID_PRIMARY_GUARDIAN_RELATION");
    if (!payload.student.fullName.trim()) throw new Error("INVALID_STUDENT_NAME");
    if (!payload.student.schoolYear.trim()) throw new Error("INVALID_SCHOOL_YEAR");
    if (!Number.isFinite(payload.student.age) || payload.student.age < 5 || payload.student.age > 21) throw new Error("INVALID_STUDENT_AGE");
    if (payload.student.subjects.length === 0) throw new Error("SUBJECTS_REQUIRED");
    if ((payload.student.supportNeeds ?? []).length === 0) throw new Error("SUPPORT_NEEDS_REQUIRED");

    const familyStructure = payload.familyStructure ?? "single_guardian";
    const secondaryGuardian =
      payload.secondaryGuardian && (payload.secondaryGuardian.fullName.trim() || payload.secondaryGuardian.email?.trim())
        ? {
            fullName: payload.secondaryGuardian.fullName.trim(),
            relation: payload.secondaryGuardian.relation,
            email: payload.secondaryGuardian.email?.trim().toLowerCase() ?? "",
          }
        : null;

    if (familyStructure === "two_guardians" && !secondaryGuardian?.fullName) {
      throw new Error("INVALID_SECONDARY_GUARDIAN_NAME");
    }
    if (familyStructure === "two_guardians" && !secondaryGuardian?.email) {
      throw new Error("INVALID_SECONDARY_GUARDIAN_EMAIL");
    }
    if (secondaryGuardian && !secondaryGuardian.fullName) {
      throw new Error("INVALID_SECONDARY_GUARDIAN_NAME");
    }
    if (secondaryGuardian && secondaryGuardian.email && !secondaryGuardian.email.includes("@")) {
      throw new Error("INVALID_SECONDARY_GUARDIAN_EMAIL");
    }

    const allSubjects = await this.repository.listSubjects(actor.tenantId);
    const subjectsBySlug = new Map(allSubjects.map((subject) => [subject.slug, subject]));
    const selectedSubjects = payload.student.subjects.map((item: MentoriaOnboardingSubjectInput) => {
      const subject = subjectsBySlug.get(item.subjectSlug);
      if (!subject) throw new Error(`SUBJECT_NOT_FOUND:${item.subjectSlug}`);
      return { selection: item, subject };
    });

    const studentAge = payload.student.age;
    const emotionalBaseline = deriveEmotionalBaselineFromSupportNeeds(payload.student.supportNeeds);
    const learningPreference = deriveLearningPreferenceFromSupportStyle(payload.student.supportStyle);
    const preferredStudyMinutes = derivePreferredStudyMinutesFromProfile(payload.student.schoolYear, payload.student.supportNeeds);
    const baseEmotionalState = deriveBaseEmotionalState(emotionalBaseline);
    const learningGoals = deriveLearningGoalsFromSupportNeeds(
      selectedSubjects.map((item) => ({ name: item.subject.name })),
      payload.student.supportNeeds,
    );
    const strengths = deriveStrengths(
      payload.student.subjects.map((item: MentoriaOnboardingSubjectInput) => ({ ...item, subjectSlug: item.subjectSlug })),
      selectedSubjects.map((item) => ({ id: item.subject.slug, name: item.subject.name })),
    );
    const ageCourseFit = resolveAgeCourseFit(studentAge, payload.student.schoolYear);
    const supportNotesParts = [
      `${formatGuardianRoleForSupportNotes(payload.primaryGuardian)} principal ${payload.primaryGuardian.fullName.trim()}`,
      `estructura familiar ${formatFamilyStructureForSupportNotes(familyStructure)}`,
      `etapa ${payload.student.stage ?? "sin especificar"}`,
      `curso ${payload.student.schoolYear}`,
      `edad ${studentAge}`,
      `encaje edad-curso ${formatAgeCourseFit(ageCourseFit)}`,
      `repeticion ${formatRepeatedCourseStatus(payload.student.repeatedCourseStatus)}`,
      `apoyos ${payload.student.supportNeeds.map((item) => formatSupportNeed(item)).join(", ")}`,
      `estilo ${formatSupportStyle(payload.student.supportStyle)}`,
    ];
    if ((payload.student.repeatedCourseYears ?? []).length > 0) {
      supportNotesParts.push(`cursos repetidos ${(payload.student.repeatedCourseYears ?? []).join(", ")}`);
    }
    if (secondaryGuardian?.fullName) {
      supportNotesParts.push(`${formatGuardianRoleForSupportNotes(secondaryGuardian)} secundario ${secondaryGuardian.fullName}`);
    }
    const additionalStudents = normalizeAdditionalStudents(payload.additionalStudents);
    if (additionalStudents.length > 0) {
      supportNotesParts.push(`familia con ${1 + additionalStudents.length} alumnos`);
    }

    const onboardingInput = toOnboardingInput(payload, learningGoals, studentAge, learningPreference);
    const onboardingContext = buildOnboardingUserContext({
      actor,
      onboarding: onboardingInput,
      tags: ["mentoria", "onboarding"],
      traits: {
        schoolYear: payload.student.schoolYear,
        supportStyle: payload.student.supportStyle,
        ageCourseFit,
      },
      preferences: {
        learningPreference,
        supportStyle: payload.student.supportStyle,
      },
    });

    const existingStudent = actor.actorType === "student"
      ? await this.resolveStudentForActor(actor, { studentProfileId: actor.studentProfileId ?? undefined })
      : null;

    const student = await this.repository.upsertStudentProfile({
      studentId: existingStudent?.id,
      tenantId: actor.tenantId,
      userId: actor.userId,
      fullName: payload.student.fullName.trim(),
      age: studentAge,
      schoolYear: payload.student.schoolYear,
      learningGoals,
      baseEmotionalState,
      emotionalBaseline,
      learningPreference,
      preferredStudyMinutes,
      strengths,
      onboardingCompleted: true,
      supportNotes: supportNotesParts.join(" | "),
    });
    await this.familyRepository.createFamily(actor.tenantId);
    const canonical = actor.email
      ? await this.syncCanonicalGuardiansFromProfile(actor, student, {
          primaryGuardian: {
            fullName: payload.primaryGuardian.fullName.trim(),
            email: actor.email,
            familyRelation: payload.primaryGuardian.relation,
            systemRole: "primary_guardian",
            access: {
              dailyStudyMinutes: preferredStudyMinutes,
              supervisionLevel: "balanced",
              canViewFullProgress: true,
              canManageSchedule: true,
              notificationPreferences: ["progress", "alerts", "planner"],
              isPrimaryContact: true,
            },
          },
          secondaryGuardians: secondaryGuardian?.email
            ? [
                {
                  fullName: secondaryGuardian.fullName,
                  email: secondaryGuardian.email,
                  familyRelation: secondaryGuardian.relation,
                  systemRole: "secondary_guardian",
                  access: {
                    dailyStudyMinutes: preferredStudyMinutes,
                    supervisionLevel: familyStructure === "separated_parents" ? "light" : "balanced",
                    canViewFullProgress: true,
                    canManageSchedule: familyStructure !== "separated_parents",
                    notificationPreferences: ["progress", "planner"],
                    isPrimaryContact: false,
                  },
                },
              ]
            : [],
        })
      : await this.getCanonicalFamilyContract(actor, student);

    await this.familyRepository.upsertStudent({
      id: student.id,
      familyId: actor.tenantId,
      name: student.fullName,
      age: student.age,
      level: student.schoolYear,
    });
    for (const additionalStudent of additionalStudents) {
      await this.familyRepository.createStudent({
        familyId: actor.tenantId,
        name: additionalStudent.fullName,
        age: additionalStudent.age,
        level: additionalStudent.schoolYear,
      });
    }

    await this.repository.replaceStudentSubjects({
      tenantId: actor.tenantId,
      studentProfileId: student.id,
      subjects: selectedSubjects.map((item) => ({
        subjectId: item.subject.id,
        initialLevel: item.selection.initialLevel,
      })),
    });

    await this.repository.deleteProgressForStudent(actor.tenantId, student.id);
    for (const item of selectedSubjects) {
      const initialProgress = buildInitialProgressFromOnboarding({
        subjectId: item.subject.id,
        initialLevel: item.selection.initialLevel,
        schoolYear: student.schoolYear,
        age: student.age,
      });
      await this.repository.upsertProgress({
        tenantId: actor.tenantId,
        studentProfileId: student.id,
        subjectId: item.subject.id,
        masteryScore: initialProgress.masteryScore,
        confidenceScore: initialProgress.confidenceScore,
        streakDays: initialProgress.streakDays,
        sessionsCompleted: initialProgress.sessionsCompleted,
        exercisesCompleted: initialProgress.exercisesCompleted,
        weakTopics: initialProgress.weakTopics,
        strongTopics: initialProgress.strongTopics,
      });
    }

    const progress = await this.repository.listProgress(actor.tenantId, student.id);
    await this.repository.saveStudentEvolutionProfile(
      actor.tenantId,
      createInitialEvolutionProfile({
        student,
        progress,
        subjects: allSubjects,
      }),
    );
    const syncedEvolution = await this.ensureEvolutionProfile(actor.tenantId, student);
    const syncedInterventions = await this.syncInterventions(actor.tenantId, student.id, syncedEvolution);
    await this.repository.saveMotivationState(
      actor.tenantId,
      createInitialMotivationState(student.id, new Date().toISOString()),
    );
    let syncedMotivation = await this.ensureMotivationState(actor.tenantId, student, syncedEvolution, syncedInterventions);
    if (payload.referralCode) {
      syncedMotivation = await this.applyReferralAttribution(actor, student, syncedMotivation, {
        referralCode: payload.referralCode,
        inviteToken: payload.inviteToken,
      });
    }
    const plan = await this.buildPlanForStudent(actor.tenantId, student, canonical.guardianStudentAccess);
    const dailyPlan = await this.ensureDailyPlan(actor.tenantId, student, {
      force: true,
      progress,
      evolution: syncedEvolution,
      interventions: syncedInterventions,
      motivation: syncedMotivation,
    });
    const persistedOnboardingContext = await this.syncUserContext(actor, student, {
      progress,
      evolution: syncedEvolution,
      motivation: syncedMotivation,
      dailyPlan,
    });
    const weakestSubjectSelection =
      selectedSubjects.find((item) => item.selection.initialLevel === "me_cuesta_mucho") ?? selectedSubjects[0];
    const activationTask = createAgentTask({
      kind: "user_activation",
      channel: "mentoria_onboarding",
      objective: `Dejar listo el espacio estructural de ${student.fullName}`,
      context: persistedOnboardingContext,
      input: {
        subjectSlug: weakestSubjectSelection.subject.slug,
        topic: weakestSubjectSelection.subject.name,
        message: "Onboarding estructural completado. El siguiente paso se decide al entrar en el workspace.",
      },
      metadata: {
        product: "mentoria",
        supportStyle: payload.student.supportStyle,
        onboardingOnly: true,
      },
    });
    const refreshedProgress = await this.getProgress(actor);
    const refreshedDailyPlan = (await this.getDashboard(actor)).dailyPlan;
    const activationResponse = createAgentResponse({
      task: activationTask,
      reply: "Tu estructura ya esta lista. A partir de aqui, el alumno entra en su workspace y define como viene hoy para que la IA adapte la sesion real.",
      output: {
        subjectSlug: weakestSubjectSelection.subject.slug,
        subjectName: weakestSubjectSelection.subject.name,
        recommendedNextStep: "Entrar al workspace y elegir la prioridad de hoy.",
      },
      recommendations: refreshedProgress.analysis.nextActions,
      metadata: {
        product: "mentoria",
        onboardingOnly: true,
      },
    });
    const activationInsights = [
      createInsight({
        category: "activation",
        title: "Primer valor entregado",
        summary: `Se ha dejado listo el workspace estructural de ${student.fullName}.`,
        actions: refreshedProgress.analysis.nextActions,
        metadata: {
          subjectSlug: weakestSubjectSelection.subject.slug,
          planDate: refreshedDailyPlan.planDate,
        },
      }),
      createInsight({
        category: "planner",
        title: "Plan diario inicial",
        summary: refreshedDailyPlan.adaptationReason,
        severity: refreshedDailyPlan.priority === "high" ? "warning" : "info",
        actions: refreshedDailyPlan.tasks.slice(0, 3).map((task) => `${task.subject}: ${task.type}`),
        metadata: {
          completionRate: refreshedDailyPlan.completionRate,
          recommendedDuration: refreshedDailyPlan.recommendedDuration,
        },
      }),
    ];
    const activation = createActivationEvent({
      context: persistedOnboardingContext,
      type: "onboarding_completed",
      channel: "onboarding",
      task: activationTask,
      response: activationResponse,
      insights: activationInsights,
      nextActions: refreshedProgress.analysis.nextActions,
      metadata: {
        subjectSlug: weakestSubjectSelection.subject.slug,
        subjectName: weakestSubjectSelection.subject.name,
      },
    });
    await trackEvent(activation);

    await recordCampamentoEvent({
      tenantId: actor.tenantId,
      type: "mentoria.onboarding.completed",
      severity: "INFO",
      source: "mentoria.onboarding",
      message: "Onboarding completed",
      correlationId: student.id,
      metadata: {
        studentId: student.id,
        firstSubjectId: weakestSubjectSelection.subject.slug ?? weakestSubjectSelection.subject.id,
      },
    });

    return {
      student,
      family: canonical.family,
      primaryGuardian: canonical.primaryGuardian,
      secondaryGuardians: canonical.secondaryGuardians,
      guardianStudentAccess: canonical.guardianStudentAccess,
      sessionContext: this.buildSessionContext(actor, student, canonical),
      plan,
      progress: refreshedProgress.progress,
      activation: {
        ...activation,
        subjectSlug: weakestSubjectSelection.subject.slug,
        subjectName: weakestSubjectSelection.subject.name,
        reply: activationResponse.reply,
        dailyPlan: refreshedDailyPlan,
      },
    };
  }

  async getDashboard(actor: MentoriaSessionActor): Promise<
`);

fs.writeFileSync(servicePath, service, "utf8");
console.log("service.ts updated");
