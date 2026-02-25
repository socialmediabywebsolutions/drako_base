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
    country: string;
    city: string;
    niche: string;
    hasWeb: boolean;
    websiteUrl: string;
    socialNetworks: Record<string, string>;
    desiredSocialNetworks: string[];
    competitors: { name: string; url: string }[];
    departments: string[];
}

const INITIAL_DATA: WizardData = {
    companyName: "",
    businessStatus: "",
    hasPhysicalLocation: false,
    address: "",
    country: "",
    city: "",
    niche: "",
    hasWeb: false,
    websiteUrl: "",
    socialNetworks: {},
    desiredSocialNetworks: [],
    competitors: [{ name: "", url: "" }, { name: "", url: "" }, { name: "", url: "" }],
    departments: [],
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
                            country: (ctx.country as string) ?? "",
                            city: (ctx.city as string) ?? "",
                            niche: (ctx.niche as string) ?? "",
                            hasWeb: Boolean(ctx.hasWeb),
                            websiteUrl: (ctx.websiteUrl as string) ?? "",
                            socialNetworks: (ctx.socialNetworks as Record<string, string>) ?? {},
                            desiredSocialNetworks: (ctx.desiredSocialNetworks as string[]) ?? [],
                            competitors: (ctx.competitors as { name: string; url: string }[]) ?? INITIAL_DATA.competitors,
                            departments: (ctx.departments as string[]) ?? [],
                        });
                        setStep((json.profile.current_step as number) ?? 1);
                    }
                }
            } catch {
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
            address: d.address || null,
            currentStep,
            completed,
            structuredContext: {
                businessStatus: d.businessStatus,
                hasPhysicalLocation: d.hasPhysicalLocation,
                country: d.country,
                city: d.city,
                niche: d.niche,
                hasWeb: d.hasWeb,
                websiteUrl: d.websiteUrl,
                socialNetworks: d.socialNetworks,
                desiredSocialNetworks: d.desiredSocialNetworks,
                competitors: d.competitors,
                departments: d.departments,
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

    // Diagnostic log
    useEffect(() => {
        if (process.env.NODE_ENV === "development") {
            console.log(`[Wizard] Step ${step} active. Data keys:`, Object.keys(data).filter(k => !!(data as any)[k]));
        }
    }, [step, data]);

    /* Navigation */
    const canProceed = (): boolean => {
        switch (step) {
            case 1:
                return !!data.companyName.trim() && !!data.businessStatus && !!data.country.trim() && !!data.city.trim() && !!data.niche.trim();
            case 2:
                if (data.hasWeb && !data.websiteUrl.trim()) return false;
                return true;
            case 3:
                // Competitors are optional but name is required if URL is provided (handled in UI)
                return true;
            case 4:
                if (data.hasPhysicalLocation && !data.address.trim()) return false;
                return true;
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
        // Fire-and-forget
        if (email) {
            fetchWithTimeout("/api/company-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(buildPayload(data, TOTAL_STEPS, true)),
            }).catch((err) => console.warn("[Wizard] background save failed:", err));
        }
        // Always stash data in sessionStorage
        try {
            sessionStorage.setItem("drako_wizard_data", JSON.stringify({
                company_name: data.companyName,
                address: data.address,
                country: data.country,
                city: data.city,
                structured_context: {
                    businessStatus: data.businessStatus,
                    hasPhysicalLocation: data.hasPhysicalLocation,
                    niche: data.niche,
                    hasWeb: data.hasWeb,
                    websiteUrl: data.websiteUrl,
                    socialNetworks: data.socialNetworks,
                    desiredSocialNetworks: data.desiredSocialNetworks,
                    competitors: data.competitors,
                    departments: data.departments,
                },
            }));
        } catch { /* ignore */ }
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

            <div className="ow-grid-fields">
                <div className="ow-field">
                    <label className="ow-label">{s.country}</label>
                    <input
                        className="ow-input"
                        value={data.country}
                        onChange={(e) => update({ country: e.target.value })}
                        placeholder={s.countryPlaceholder}
                    />
                </div>
                <div className="ow-field">
                    <label className="ow-label">{s.city}</label>
                    <input
                        className="ow-input"
                        value={data.city}
                        onChange={(e) => update({ city: e.target.value })}
                        placeholder={s.cityPlaceholder}
                    />
                </div>
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
        </div>
    );
}

/* ─── Step 2: Presencia digital ─── */
function Step2({ data, update, t }: StepProps) {
    const s = t.step2;

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
                        onClick={() => update({ hasWeb: true })}
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

            {data.hasWeb && (
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

/* ─── Step 3: Tu competencia ─── */
function Step3({ data, update, t }: StepProps) {
    const s = t.step3;

    const updateComp = (idx: number, patch: Partial<{ name: string; url: string }>) => {
        const newList = [...data.competitors];
        newList[idx] = { ...newList[idx], ...patch };
        update({ competitors: newList });
    };

    return (
        <div className="ow-step">
            <div className="ow-step-header">
                <h2>{s.title}</h2>
                <p>{s.subtitle}</p>
            </div>
            <div className="ow-microcopy">{s.microcopy}</div>

            {[0, 1, 2].map((i) => (
                <div key={i} className="ow-competitor-box">
                    <div className="ow-field">
                        <label className="ow-label">{s[`competitor${i + 1}` as keyof typeof s]}</label>
                        <input
                            className="ow-input"
                            value={data.competitors[i]?.name || ""}
                            onChange={(e) => updateComp(i, { name: e.target.value })}
                            placeholder="Nombre del competidor"
                        />
                    </div>
                    <div className="ow-field">
                        <label className="ow-label">{s[`competitor${i + 1}Url` as keyof typeof s]}</label>
                        <input
                            className="ow-input"
                            value={data.competitors[i]?.url || ""}
                            onChange={(e) => updateComp(i, { url: e.target.value })}
                            placeholder="https://su-web.com"
                            type="url"
                        />
                    </div>
                </div>
            ))}
        </div>
    );
}

/* ─── Step 4: Operación local ─── */
function Step4({ data, update, t }: StepProps) {
    const s = t.step4;
    return (
        <div className="ow-step">
            <div className="ow-step-header">
                <h2>{s.title}</h2>
                <p>{s.subtitle}</p>
            </div>
            <div className="ow-microcopy">{s.microcopy}</div>

            <div className="ow-field">
                <label className="ow-label">{s.hasLocation}</label>
                <div className="ow-options">
                    <div
                        className={`ow-option ${data.hasPhysicalLocation ? "selected" : ""}`}
                        onClick={() => update({ hasPhysicalLocation: true })}
                    >
                        <span className="ow-option-dot" />
                        <span className="ow-option-label">{s.hasLocationYes}</span>
                    </div>
                    <div
                        className={`ow-option ${!data.hasPhysicalLocation ? "selected" : ""}`}
                        onClick={() => update({ hasPhysicalLocation: false, address: "" })}
                    >
                        <span className="ow-option-dot" />
                        <span className="ow-option-label">{s.hasLocationNo}</span>
                    </div>
                </div>
            </div>

            {data.hasPhysicalLocation && (
                <div className="ow-field">
                    <label className="ow-label">{s.address}</label>
                    <input
                        className="ow-input"
                        value={data.address}
                        onChange={(e) => update({ address: e.target.value })}
                        placeholder={s.addressPlaceholder}
                    />
                    <p className="ow-guide">
                        {s.guideText}
                    </p>
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
        </div>
    );
}
