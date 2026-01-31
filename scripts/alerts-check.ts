import { writeFileSync } from "fs";

/**
 * alerts-check.ts — Script de verificación manual del estado técnico.
 * Este script consulta el endpoint oficial de estatus y genera un log de alertas.
 * Si se detectan alertas críticas, el proceso falla (exit 1) para bloquear despliegues en CI.
 */

interface StatusData {
    watchdogAlerts?: { draftsInProduction: boolean };
    bindings?: { unregistered: string[] };
    ciVerifiers?: Record<string, "pass" | "warn" | "fail">;
}

async function run() {
    const PROD_URL = "https://drako.group/api/status.json";
    const LOCAL_URL = "http://localhost:3000/api/status.json";

    let data: StatusData | null = null;
    let usedUrl = "";

    // 1. Intentar Producción
    try {
        console.log(`🔍 Consultando producción: ${PROD_URL}...`);
        const res = await fetch(PROD_URL);
        if (res.ok) {
            data = (await res.json()) as StatusData;
            usedUrl = PROD_URL;
        } else {
            console.warn(`⚠️ Producción devolvió HTTP ${res.status}.`);
        }
    } catch (error) {
        console.warn(`⚠️ No se pudo conectar a producción: ${error instanceof Error ? error.message : String(error)}`);
    }

    // 2. Fallback a Local si Producción falló
    if (!data) {
        try {
            console.log(`🏠 Probando fallback local: ${LOCAL_URL}...`);
            const res = await fetch(LOCAL_URL);
            if (res.ok) {
                data = (await res.json()) as StatusData;
                usedUrl = LOCAL_URL;
                console.log("✅ Fallback local exitoso.");
            } else {
                throw new Error(`Local devolvió HTTP ${res.status}`);
            }
        } catch (error) {
            console.error("\n💥 Error crítico: No se pudo obtener el estado de ningún entorno.");
            console.error(`Detalle local: ${error instanceof Error ? error.message : String(error)}`);
            process.exit(1);
        }
    }

    console.log(`📊 Usando datos de: ${usedUrl}\n`);

    try {
        const alerts: string[] = [];

        // 1. Verificar Watchdog Drafts
        if (data.watchdogAlerts?.draftsInProduction) {
            alerts.push("🚨 Drafts activos en producción detectados por el Watchdog.");
        }

        // 2. Verificar Bindings no registrados
        if (data.bindings?.unregistered && data.bindings.unregistered.length > 0) {
            alerts.push(`🟠 Bindings no registrados en el registry: ${data.bindings.unregistered.join(", ")}`);
        }

        // 3. Verificar Verificadores CI
        if (data.ciVerifiers) {
            for (const [verifier, result] of Object.entries(data.ciVerifiers)) {
                if (result === "fail") {
                    alerts.push(`❌ Verificador CI fallido: ${verifier}`);
                }
            }
        }

        // 4. Reporte Final
        if (alerts.length > 0) {
            console.error("\n❌ ALERTAS DETECTADAS:");
            for (const alert of alerts) {
                console.error(`  - ${alert}`);
            }

            const logContent = `ALERTS_CHECK_REPORT [${new Date().toISOString()}]\n\n${alerts.join("\n")}`;
            writeFileSync("alerts-report.log", logContent);
            console.error("\n📄 Reporte generado en alerts-report.log");
            process.exit(1);
        }

        console.log("\n✅ Infraestructura saludable. Sin alertas activas detectadas.");
    } catch (error) {
        console.error("\n💥 Error crítico durante la verificación:");
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

run();
