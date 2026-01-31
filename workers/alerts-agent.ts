interface Env {
    ALERT_WEBHOOK_URL: string;
}

interface StatusData {
    watchdogAlerts: { draftsInProduction: boolean };
    bindings: { unregistered: string[] };
    ciVerifiers: Record<string, "pass" | "warn" | "fail">;
}

export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        const statusUrl = "https://drako.group/api/status.json";
        const res = await fetch(statusUrl);
        if (!res.ok) throw new Error("Failed to fetch system status");
        const data = (await res.json()) as StatusData;

        const alerts: string[] = [];

        if (data.watchdogAlerts.draftsInProduction) {
            alerts.push("🚨 Drafts activos en producción.");
        }

        if (data.bindings.unregistered && data.bindings.unregistered.length > 0) {
            alerts.push(`🟠 Bindings no registrados: ${data.bindings.unregistered.join(", ")}`);
        }

        if (data.ciVerifiers) {
            for (const [key, val] of Object.entries(data.ciVerifiers)) {
                if (val === "fail") alerts.push(`❌ Verificador fallido: ${key}`);
            }
        }

        if (alerts.length === 0) return;

        const message = `🛰️ *ALERTA INFRA DRAKO*\n${alerts.join("\n")}`;

        if (env.ALERT_WEBHOOK_URL) {
            await fetch(env.ALERT_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: message })
            });
        } else {
            console.warn("ALERT_WEBHOOK_URL is not defined");
            console.log("Alert Message:", message);
        }
    }
};
