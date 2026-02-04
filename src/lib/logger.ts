import { headers } from "next/headers";
// isEdgeRuntime removed as it was unused
import { CORRELATION_HEADER } from "./correlation";

/**
 * Drako-Forge Steel v1.0.1 - Unified Logger
 */

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

async function getCorrelationId(): Promise<string> {
    try {
        const headersList = await headers();
        return headersList.get(CORRELATION_HEADER) || "no-ctx";
    } catch {
        // In scenarios where headers() is not available (e.g. static generation)
        return "static-ctx";
    }
}

function formatLog(level: LogLevel, correlationId: string, message: string, metadata?: any): string {
    const timestamp = new Date().toISOString();
    // Steel v1.0.1 Format: [LEVEL] [ID] [ISO_TIME] Message
    let log = `[${level}] [${correlationId.toLowerCase()}] [${timestamp}] ${message}`;
    if (metadata) {
        log += ` | ${JSON.stringify(metadata)}`;
    }
    return log;
}

/**
 * Core logging functions
 */
export const logger = {
    info: async (message: string, metadata?: any) => {
        const id = await getCorrelationId();
        console.log(formatLog("INFO", id, message, metadata));
    },
    warn: async (message: string, metadata?: any) => {
        const id = await getCorrelationId();
        console.warn(formatLog("WARN", id, message, metadata));
    },
    error: async (message: string, metadata?: any) => {
        const id = await getCorrelationId();
        console.error(formatLog("ERROR", id, message, metadata));
    },
    debug: async (message: string, metadata?: any) => {
        const id = await getCorrelationId();
        console.debug(formatLog("DEBUG", id, message, metadata));
    },
};
