'use client';

// @ts-ignore - React 19 / Next 14 compatibility
import { useFormState, useFormStatus } from 'react-dom';
import { submitStrategicForm } from '@/app/client/actions';
import Button from '@/components/ui/button';
import { TextInput, Field } from '@/components/ui/input';
import Card from '@/components/ui/card';

const initialState = { error: null as string | null };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" className="w-full mt-6" disabled={pending} loading={pending}>
            {pending ? 'Analizando Datos...' : 'Generar Dossier Estratégico'}
        </Button>
    );
}

export function StrategicForm() {
    const [state, formAction] = useFormState(submitStrategicForm, initialState);

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Datos Estratégicos</h1>
                <p className="text-muted-foreground">
                    Información obligatoria para calibrar el Orquestador Drako.
                </p>
            </div>

            <form action={formAction}>
                <div className="space-y-6">
                    {/* 1. DATOS PERSONALES */}
                    <Card title="1. Contacto y Ubicación" subtitle="Fundamental para el análisis geográfico.">
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Nombre Completo">
                                <TextInput name="personal_name" required placeholder="Ej. Juan Pérez" />
                            </Field>
                            <Field label="Email Corporativo">
                                <TextInput name="personal_email" type="email" required placeholder="juan@empresa.com" />
                            </Field>
                            <Field label="Teléfono">
                                <TextInput name="personal_phone" type="tel" required placeholder="+34 600..." />
                            </Field>
                            <Field label="País">
                                <TextInput name="personal_country" required placeholder="Ej. España" />
                            </Field>
                            <Field label="Ciudad">
                                <TextInput name="personal_city" required placeholder="Ej. Madrid" />
                            </Field>
                            <div className="col-span-2">
                                <Field label="Dirección Física Exacta (OBLIGATORIO)" help="Necesaria para auditoría de Google Maps.">
                                    <TextInput name="personal_address" required placeholder="Calle Principal 123, 28001" />
                                </Field>
                            </div>
                        </div>
                    </Card>

                    {/* 2. DATOS NEGOCIO */}
                    <Card title="2. Perfil del Negocio">
                        <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Tipo de Negocio">
                                <select name="business_type" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                    <option value="SaaS">SaaS / Software</option>
                                    <option value="Agency">Agencia</option>
                                    <option value="Ecommerce">Ecommerce</option>
                                    <option value="Local">Negocio Local / Retail</option>
                                    <option value="Service">Servicios Pro</option>
                                </select>
                            </Field>
                            <Field label="Sector">
                                <TextInput name="business_sector" required placeholder="Ej. Salud, Legal..." />
                            </Field>
                            <Field label="Años Activo">
                                <TextInput name="business_years" type="number" required placeholder="Ej. 5" />
                            </Field>
                            <Field label="Nº Empleados">
                                <TextInput name="business_employees" type="number" required placeholder="Ej. 12" />
                            </Field>
                            <div className="md:col-span-2">
                                <Field label="Objetivo Principal">
                                    <select name="business_objective" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                        <option value="capture">Captación (Más Leads)</option>
                                        <option value="automation">Automatización (Menos Trabajo)</option>
                                        <option value="sales">Ventas (Más Cierre)</option>
                                        <option value="scale">Escalado (Nuevos Mercados)</option>
                                    </select>
                                </Field>
                            </div>
                        </div>
                    </Card>

                    {/* 3. PRESENCIA DIGITAL */}
                    <Card title="3. Presencia Digital" subtitle="Para el análisis automático de competidores.">
                        <div className="space-y-4">
                            <Field label="Sitio Web">
                                <TextInput name="digital_web" type="url" placeholder="https://" />
                            </Field>
                            <Field label="Google Maps / Ficha (CRÍTICO)">
                                <TextInput name="digital_maps" type="url" required placeholder="https://maps.google.com/..." />
                            </Field>
                            <div className="grid grid-cols-2 gap-4">
                                <TextInput name="digital_instagram" placeholder="Instagram URL" />
                                <TextInput name="digital_facebook" placeholder="Facebook URL" />
                                <TextInput name="digital_linkedin" placeholder="LinkedIn URL" />
                                <TextInput name="digital_tiktok" placeholder="TikTok URL" />
                            </div>
                        </div>
                    </Card>

                    {/* 4. NIVEL */}
                    <Card title="4. Nivel de Madurez">
                        <div className="p-1">
                            <select name="maturity_level" className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                <option value="Basic">Básico (Sin herramientas conectadas)</option>
                                <option value="Intermediate">Intermedio (CRM / Email básico)</option>
                                <option value="Advanced">Avanzado (Automatizaciones activas)</option>
                            </select>
                        </div>
                    </Card>

                    {state?.error && (
                        <div className="p-4 text-red-600 bg-red-50 border border-red-200 rounded-md">
                            {state.error}
                        </div>
                    )}

                    <SubmitButton />
                </div>
            </form>
        </div>
    );
}
