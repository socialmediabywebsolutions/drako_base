"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    getOnboardingTexts,
    GOAL_KEYS,
    type GoalKey,
    type OnboardingLang,
    type OnboardingTexts,
} from "@/lib/i18n/onboarding-i18n";

/* ─── Types ─── */
interface WizardData {
    companyName: string;
    businessStatus: string;
    hasPhysicalLocation: boolean;
    address: string;
    schedule: string;
    zone: string;
    offering: string;
    sector: string;
    niche: string;
    customerType: string;
    salesChannels: string[];
    hasWeb: boolean;
    websiteUrl: string;
    wantWebCreated: boolean;
    socialNetworks: Record<string, string>;
    desiredSocialNetworks: string[];
    primaryGoal: string;
    secondaryGoals: string[];
    goalOtherText: string;
    departments: string[];
    departmentOtherText: string;
}

const INITIAL_DATA: WizardData = {
    companyName: "",
    businessStatus: "",
    hasPhysicalLocation: false,
    address: "",
    schedule: "",
    zone: "",
    offering: "",
    sector: "",
    niche: "",
    customerType: "",
    salesChannels: [],
    hasWeb: false,
    websiteUrl: "",
    wantWebCreated: false,
    socialNetworks: {},
    desiredSocialNetworks: [],
    primaryGoal: "",
    secondaryGoals: [],
    goalOtherText: "",
    departments: [],
    departmentOtherText: "",
};

const TOTAL_STEPS = 5;
const SOCIAL_KEYS = ["instagram", "facebook", "linkedin", "tiktok", "youtube", "other"] as const;
const FETCH_TIMEOUT = 8000; // 8s max per request

/* ─── Fetch with timeout ─── */
function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = FETCH_TIMEOUT): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/* ─── Main Component ─── */
export default function OnboardingWizard({ lang = "es" }: { lang?: OnboardingLang }) {
    const t = useMemo(() => getOnboardingTexts(lang), [lang]);
    const router = useRouter();
    const { data: session, status: sessionStatus } = useSession();
    const email = session?.user?.email ?? "";

    const [step, setStep] = useState(1);
    const [data, setData] = useState<WizardData>(INITIAL_DATA);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    /* Load existing profile on mount — works even without auth */
    useEffect(() => {
        if (loaded) return;
        // If session is still loading, wait
        if (sessionStatus === "loading") return;
        // If no email (not logged in), skip load but mark as loaded
        if (!email) {
            setLoaded(true);
            return;
        }
        (async () => {
            try {
                const res = await fetchWithTimeout(
                    `/api/company-profile?email=${encodeURIComponent(email)}`
                );
                if (res.ok) {
                    const json = (await res.json()) as { profile?: Record<string, unknown> | null };
                    if (json.profile) {
                        const ctx = (json.profile.structured_context ?? {}) as Record<string, unknown>;
                        setData({
                            companyName: (json.profile.company_name as string) ?? "",
                            businessStatus: (ctx.businessStatus as string) ?? "",
                            hasPhysicalLocation: Boolean(ctx.hasPhysicalLocation),
                            address: (json.profile.address as string) ?? "",
                            schedule: (ctx.schedule as string) ?? "",
                            zone: (json.profile.zone as string) ?? "",
                            offering: (ctx.offering as string) ?? "",
                            sector: (json.profile.sector as string) ?? "",
                            niche: (ctx.niche as string) ?? "",
                            customerType: (ctx.customerType as string) ?? "",
                            salesChannels: (ctx.salesChannels as string[]) ?? [],
                            hasWeb: Boolean(ctx.hasWeb),
                            websiteUrl: (ctx.websiteUrl as string) ?? "",
                            wantWebCreated: Boolean(ctx.wantWebCreated),
                            socialNetworks: (ctx.socialNetworks as Record<string, string>) ?? {},
                            desiredSocialNetworks: (ctx.desiredSocialNetworks as string[]) ?? [],
                            primaryGoal: (ctx.primaryGoal as string) ?? "",
                            secondaryGoals: (ctx.secondaryGoals as string[]) ?? [],
                            goalOtherText: (ctx.goalOtherText as string) ?? "",
                            departments: (ctx.departments as string[]) ?? [],
                            departmentOtherText: (ctx.departmentOtherText as string) ?? "",
                        });
                        setStep((json.profile.current_step as number) ?? 1);
                    }
                }
            } catch {
                // first visit, timeout, or DB not ready — wizard still works
                console.warn("[Wizard] Could not load profile, starting fresh.");
            }
            setLoaded(true);
        })();
    }, [email, loaded, sessionStatus]);

    /* Build the save payload (reusable) */
    const buildPayload = useCallback(
        (d: WizardData, currentStep: number, completed = false) => ({
            userEmail: email,
            companyName: d.companyName || "Sin nombre",
            sector: d.sector || null,
            address: d.address || null,
            zone: d.zone || null,
            currentStep,
            completed,
            structuredContext: {
                businessStatus: d.businessStatus,
                hasPhysicalLocation: d.hasPhysicalLocation,
                schedule: d.schedule,
                offering: d.offering,
                niche: d.niche,
                customerType: d.customerType,
                salesChannels: d.salesChannels,
                hasWeb: d.hasWeb,
                websiteUrl: d.websiteUrl,
                wantWebCreated: d.wantWebCreated,
                socialNetworks: d.socialNetworks,
                desiredSocialNetworks: d.desiredSocialNetworks,
                primaryGoal: d.primaryGoal,
                secondaryGoals: d.secondaryGoals,
                goalOtherText: d.goalOtherText,
                departments: d.departments,
                departmentOtherText: d.departmentOtherText,
            },
        }),
        [email]
    );

    /* Auto-save with debounce — NEVER blocks UI */
    const autoSave = useCallback(
        (newData: WizardData, currentStep: number) => {
            if (!email) return; // no auth → skip (data lives in state)
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(async () => {
                setSaving(true);
                setSaveError(null);
                try {
                    const res = await fetchWithTimeout("/api/company-profile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(buildPayload(newData, currentStep)),
                    });
                    if (!res.ok) {
                        const err = await res.text().catch(() => "Error desconocido");
                        throw new Error(err);
                    }
                } catch (err) {
                    console.error("[Wizard] autosave failed:", err);
                    setSaveError(
                        lang === "es"
                            ? "No se pudo guardar. Tus datos no se pierden."
                            : "Could not save. Your data is not lost."
                    );
                }
                setSaving(false);
            }, 800);
        },
        [email, buildPayload, lang]
    );

    const update = useCallback(
        (patch: Partial<WizardData>) => {
            setData((prev) => {
                const next = { ...prev, ...patch };
                autoSave(next, step);
                return next;
            });
        },
        [autoSave, step]
    );

    /* Navigation */
    const canProceed = (): boolean => {
        switch (step) {
            case 1:
                if (!data.companyName.trim()) return false;
                if (!data.businessStatus) return false;
                if (data.hasPhysicalLocation && !data.address.trim()) return false;
                if (!data.hasPhysicalLocation && !data.zone.trim()) return false;
                return true;
            case 2:
                return !!data.offering.trim() && !!data.customerType;
            case 3:
                if (data.hasWeb && !data.websiteUrl.trim()) return false;
                return true;
            case 4:
                return !!data.primaryGoal;
            case 5:
                return data.departments.length > 0;
            default:
                return false;
        }
    };

    const goNext = () => {
        if (step < TOTAL_STEPS) {
            const next = step + 1;
            setStep(next);
            autoSave(data, next);
        }
    };

    const goBack = () => {
        if (step > 1) {
            const prev = step - 1;
            setStep(prev);
            autoSave(data, prev);
        }
    };

    const handleSubmit = () => {
        // Fire-and-forget: save in background, navigate IMMEDIATELY
        if (email) {
            fetchWithTimeout("/api/company-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload(data, TOTAL_STEPS, true)),
            }).catch((err) => console.warn("[Wizard] background save failed:", err));
        }
        // Navigate instantly — never block, never show spinner
        router.push("/site/onboarding/chat");
    };

    /* ─── Render ─── */
    return (
        <div className="onboarding-wizard">
            {/* Progress */}
            <div className="ow-progress">
                {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                    <div
                        key={i}
                        className={`ow-progress-step ${i + 1 === step ? "active" : i + 1 < step ? "completed" : ""
                            }`}
                    />
                ))}
                <span className="ow-progress-label">{t.wizard.stepOf(step, TOTAL_STEPS)}</span>
            </div>

            {/* Steps */}
            {step === 1 && <Step1 data={data} update={update} t={t} />}
            {step === 2 && <Step2 data={data} update={update} t={t} />}
            {step === 3 && <Step3 data={data} update={update} t={t} />}
            {step === 4 && <Step4 data={data} update={update} t={t} />}
            {step === 5 && <Step5 data={data} update={update} t={t} />}

            {/* Navigation */}
            <div className="ow-nav">
                <div>
                    {step > 1 && (
                        <button className="ow-btn ow-btn-back" onClick={goBack} type="button">
                            {t.wizard.back}
                        </button>
                    )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {saving && (
                        <span className="ow-autosave">
                            <span className="ow-autosave-dot" />
                            {t.wizard.saving}
                        </span>
                    )}
                    {saveError && (
                        <span style={{ fontSize: 12, color: "#ef4444" }}>
                            {saveError}
                        </span>
                    )}
                    {step < TOTAL_STEPS ? (
                        <button
                            className="ow-btn ow-btn-primary"
                            onClick={goNext}
                            disabled={!canProceed()}
                            type="button"
                        >
                            {t.wizard.next}
                        </button>
                    ) : (
                        <button
                            className="ow-btn ow-btn-primary"
                            onClick={handleSubmit}
                            disabled={!canProceed() || submitting}
                            type="button"
                        >
                            {submitting ? t.wizard.saving : t.wizard.finish}
                        </button>
                    )}
                </div>
            </div>

        </div>
    );
}

/* ════════════════════════════════════════════════
   STEP COMPONENTS
   ════════════════════════════════════════════════ */

type StepProps = {
    data: WizardData;
    update: (patch: Partial<WizardData>) => void;
    t: OnboardingTexts;
};

/* ─── Step 1: Tu negocio ─── */
function Step1({ data, update, t }: StepProps) {
    const s = t.step1;
    return (
        <div className="ow-step">
            <div className="ow-step-header">
                <h2>{s.title}</h2>
                <p>{s.subtitle}</p>
            </div>
            <div className="ow-microcopy">{s.microcopy}</div>

            <div className="ow-field">
                <label className="ow-label">{s.companyName}</label>
                <input
                    className="ow-input"
                    value={data.companyName}
                    onChange={(e) => update({ companyName: e.target.value })}
                    placeholder={s.companyNamePlaceholder}
                />
            </div>

            <div className="ow-field">
                <label className="ow-label">{s.businessStatus}</label>
                <div className="ow-options">
                    {([
                        ["operating", s.statusOperating],
                        ["launching", s.statusLaunching],
                        ["idea", s.statusIdea],
                    ] as const).map(([val, label]) => (
                        <div
                            key={val}
                            className={`ow-option ${data.businessStatus === val ? "selected" : ""}`}
                            onClick={() => update({ businessStatus: val })}
                        >
                            <span className="ow-option-dot" />
                            <span className="ow-option-label">{label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="ow-field">
                <label className="ow-label">{s.hasLocation}</label>
                <div className="ow-options grid">
                    <div
                        className={`ow-option ${data.hasPhysicalLocation ? "selected" : ""}`}
                        onClick={() => update({ hasPhysicalLocation: true })}
                    >
                        <span className="ow-option-dot" />
                        <span className="ow-option-label">{s.hasLocationYes}</span>
                    </div>
                    <div
                        className={`ow-option ${!data.hasPhysicalLocation ? "selected" : ""}`}
                        onClick={() => update({ hasPhysicalLocation: false })}
                    >
                        <span className="ow-option-dot" />
                        <span className="ow-option-label">{s.hasLocationNo}</span>
                    </div>
                </div>
            </div>

            {data.hasPhysicalLocation ? (
                <>
                    <div className="ow-field">
                        <label className="ow-label">{s.address}</label>
                        <input
                            className="ow-input"
                            value={data.address}
                            onChange={(e) => update({ address: e.target.value })}
                            placeholder={s.addressPlaceholder}
                        />
                    </div>
                    <div className="ow-field">
                        <label className="ow-label">{s.schedule}</label>
                        <input
                            className="ow-input"
                            value={data.schedule}
                            onChange={(e) => update({ schedule: e.target.value })}
                            placeholder={s.schedulePlaceholder}
                        />
                    </div>
                </>
            ) : (
                <div className="ow-field">
                    <label className="ow-label">{s.zone}</label>
                    <input
                        className="ow-input"
                        value={data.zone}
                        onChange={(e) => update({ zone: e.target.value })}
                        placeholder={s.zonePlaceholder}
                    />
                </div>
            )}
        </div>
    );
}

/* ─── Step 2: Qué haces y para quién ─── */
function Step2({ data, update, t }: StepProps) {
    const s = t.step2;
    return (
        <div className="ow-step">
            <div className="ow-step-header">
                <h2>{s.title}</h2>
                <p>{s.subtitle}</p>
            </div>
            <div className="ow-microcopy">{s.microcopy}</div>

            <div className="ow-field">
                <label className="ow-label">{s.offering}</label>
                <input
                    className="ow-input"
                    value={data.offering}
                    onChange={(e) => update({ offering: e.target.value })}
                    placeholder={s.offeringPlaceholder}
                />
            </div>

            <div className="ow-field">
                <label className="ow-label">{s.sector}</label>
                <select
                    className="ow-select"
                    value={data.sector}
                    onChange={(e) => update({ sector: e.target.value })}
                >
                    <option value="">{s.sectorPlaceholder}</option>
                    {t.sectors.map((sec) => (
                        <option key={sec} value={sec}>
                            {sec}
                        </option>
                    ))}
                </select>
            </div>

            <div className="ow-field">
                <label className="ow-label">{s.niche}</label>
                <input
                    className="ow-input"
                    value={data.niche}
                    onChange={(e) => update({ niche: e.target.value })}
                    placeholder={s.nichePlaceholder}
                />
            </div>

            <div className="ow-field">
                <label className="ow-label">{s.customerType}</label>
                <div className="ow-options">
                    {([
                        ["people", s.customerPeople, s.customerPeopleExample],
                        ["companies", s.customerCompanies, s.customerCompaniesExample],
                        ["both", s.customerBoth, ""],
                    ] as const).map(([val, label, example]) => (
                        <div
                            key={val}
                            className={`ow-option ${data.customerType === val ? "selected" : ""}`}
                            onClick={() => update({ customerType: val })}
                        >
                            <span className="ow-option-dot" />
                            <div className="ow-option-content">
                                <span className="ow-option-label">{label}</span>
                                {example && <span className="ow-option-desc">{example}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="ow-field">
                <label className="ow-label">{s.salesChannels}</label>
                <div className="ow-options grid">
                    {([
                        ["online", s.salesOnline],
                        ["in_person", s.salesInPerson],
                        ["both", s.salesBoth],
                    ] as const).map(([val, label]) => (
                        <div
                            key={val}
                            className={`ow-option ${data.salesChannels.includes(val) ? "selected" : ""}`}
                            onClick={() => {
                                const channels = data.salesChannels.includes(val)
                                    ? data.salesChannels.filter((c) => c !== val)
                                    : [...data.salesChannels, val];
                                update({ salesChannels: channels });
                            }}
                        >
                            <span className="ow-option-check">✓</span>
                            <span className="ow-option-label">{label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ─── Step 3: Presencia digital ─── */
function Step3({ data, update, t }: StepProps) {
    const s = t.step3;

    const socialLabel = (key: string): string => {
        const map: Record<string, string> = {
            instagram: s.instagram,
            facebook: s.facebook,
            linkedin: s.linkedin,
            tiktok: s.tiktok,
            youtube: s.youtube,
            other: s.other,
        };
        return map[key] ?? key;
    };

    const socialIcon = (key: string): string => {
        const icons: Record<string, string> = {
            instagram: "IG",
            facebook: "FB",
            linkedin: "LI",
            tiktok: "TK",
            youtube: "YT",
            other: "++",
        };
        return icons[key] ?? "?";
    };

    return (
        <div className="ow-step">
            <div className="ow-step-header">
                <h2>{s.title}</h2>
                <p>{s.subtitle}</p>
            </div>
            <div className="ow-microcopy">{s.microcopy}</div>

            <div className="ow-field">
                <label className="ow-label">{s.hasWeb}</label>
                <div className="ow-options grid">
                    <div
                        className={`ow-option ${data.hasWeb ? "selected" : ""}`}
                        onClick={() => update({ hasWeb: true, wantWebCreated: false })}
                    >
                        <span className="ow-option-dot" />
                        <span className="ow-option-label">{s.hasWebYes}</span>
                    </div>
                    <div
                        className={`ow-option ${!data.hasWeb ? "selected" : ""}`}
                        onClick={() => update({ hasWeb: false, websiteUrl: "" })}
                    >
                        <span className="ow-option-dot" />
                        <span className="ow-option-label">{s.hasWebNo}</span>
                    </div>
                </div>
            </div>

            {data.hasWeb ? (
                <div className="ow-field">
                    <label className="ow-label">{s.webUrl}</label>
                    <input
                        className="ow-input"
                        value={data.websiteUrl}
                        onChange={(e) => update({ websiteUrl: e.target.value })}
                        placeholder={s.webUrlPlaceholder}
                        type="url"
                    />
                </div>
            ) : (
                <div className="ow-field">
                    <div
                        className={`ow-toggle ${data.wantWebCreated ? "active" : ""}`}
                        onClick={() => update({ wantWebCreated: !data.wantWebCreated })}
                    >
                        <div className="ow-toggle-track">
                            <div className="ow-toggle-thumb" />
                        </div>
                        <span className="ow-toggle-label">{s.wantWebCreated}</span>
                    </div>
                </div>
            )}

            <div className="ow-field">
                <label className="ow-label">{s.currentSocials}</label>
                {SOCIAL_KEYS.map((key) => (
                    <div key={key} className="ow-social-row">
                        <span className="ow-social-icon">{socialIcon(key)}</span>
                        <input
                            className="ow-input"
                            value={data.socialNetworks[key] ?? ""}
                            onChange={(e) =>
                                update({
                                    socialNetworks: { ...data.socialNetworks, [key]: e.target.value },
                                })
                            }
                            placeholder={socialLabel(key)}
                        />
                    </div>
                ))}
            </div>

            <div className="ow-field">
                <label className="ow-label">{s.desiredSocials}</label>
                <div className="ow-options grid">
                    {SOCIAL_KEYS.filter((k) => k !== "other").map((key) => (
                        <div
                            key={key}
                            className={`ow-option ${data.desiredSocialNetworks.includes(key) ? "selected" : ""}`}
                            onClick={() => {
                                const nets = data.desiredSocialNetworks.includes(key)
                                    ? data.desiredSocialNetworks.filter((n) => n !== key)
                                    : [...data.desiredSocialNetworks, key];
                                update({ desiredSocialNetworks: nets });
                            }}
                        >
                            <span className="ow-option-check">✓</span>
                            <span className="ow-option-label">{socialLabel(key)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ─── Step 4: Qué quieres conseguir ─── */
function Step4({ data, update, t }: StepProps) {
    const s = t.step4;

    const goals: { key: GoalKey; label: string }[] = GOAL_KEYS.map((k) => ({
        key: k,
        label: s[k],
    }));

    const toggleSecondary = (key: string) => {
        if (data.secondaryGoals.includes(key)) {
            update({ secondaryGoals: data.secondaryGoals.filter((g) => g !== key) });
        } else if (data.secondaryGoals.length < 2) {
            update({ secondaryGoals: [...data.secondaryGoals, key] });
        }
    };

    return (
        <div className="ow-step">
            <div className="ow-step-header">
                <h2>{s.title}</h2>
                <p>{s.subtitle}</p>
            </div>
            <div className="ow-microcopy">{s.microcopy}</div>

            <div className="ow-field">
                <label className="ow-label">{s.selectPrimary}</label>
                <div className="ow-options">
                    {goals.map(({ key, label }) => (
                        <div
                            key={key}
                            className={`ow-option ${data.primaryGoal === key ? "selected" : ""}`}
                            onClick={() => {
                                update({
                                    primaryGoal: key,
                                    secondaryGoals: data.secondaryGoals.filter((g) => g !== key),
                                });
                            }}
                        >
                            <span className="ow-option-dot" />
                            <span className="ow-option-label">{label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {data.primaryGoal && (
                <div className="ow-field">
                    <label className="ow-label">{s.selectSecondary}</label>
                    <div className="ow-options">
                        {goals
                            .filter(({ key }) => key !== data.primaryGoal)
                            .map(({ key, label }) => (
                                <div
                                    key={key}
                                    className={`ow-option ${data.secondaryGoals.includes(key) ? "selected" : ""}`}
                                    onClick={() => toggleSecondary(key)}
                                >
                                    <span className="ow-option-check">✓</span>
                                    <span className="ow-option-label">{label}</span>
                                </div>
                            ))}
                    </div>
                </div>
            )}

            {(data.primaryGoal === "goalOther" || data.secondaryGoals.includes("goalOther")) && (
                <div className="ow-field">
                    <textarea
                        className="ow-textarea"
                        value={data.goalOtherText}
                        onChange={(e) => update({ goalOtherText: e.target.value })}
                        placeholder={s.goalOtherPlaceholder}
                        rows={3}
                    />
                </div>
            )}
        </div>
    );
}

/* ─── Step 5: Departamentos ─── */
function Step5({ data, update, t }: StepProps) {
    const s = t.step5;

    const toggleDept = (id: string) => {
        const deps = data.departments.includes(id)
            ? data.departments.filter((d) => d !== id)
            : [...data.departments, id];
        update({ departments: deps });
    };

    return (
        <div className="ow-step">
            <div className="ow-step-header">
                <h2>{s.title}</h2>
                <p>{s.subtitle}</p>
            </div>
            <div className="ow-microcopy">{s.microcopy}</div>

            <div className="ow-options">
                {s.departments.map((dept) => (
                    <div
                        key={dept.id}
                        className={`ow-option ${data.departments.includes(dept.id) ? "selected" : ""}`}
                        onClick={() => toggleDept(dept.id)}
                    >
                        <span className="ow-option-check">✓</span>
                        <div className="ow-option-content">
                            <span className="ow-option-label">{dept.label}</span>
                            <span className="ow-option-desc">{dept.description}</span>
                        </div>
                    </div>
                ))}
            </div>

            {data.departments.includes("other") && (
                <div className="ow-field" style={{ marginTop: 16 }}>
                    <input
                        className="ow-input"
                        value={data.departmentOtherText}
                        onChange={(e) => update({ departmentOtherText: e.target.value })}
                        placeholder={s.otherPlaceholder}
                    />
                </div>
            )}
        </div>
    );
}
