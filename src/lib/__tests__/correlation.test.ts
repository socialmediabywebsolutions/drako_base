import { describe, it, expect } from "vitest";
import {
    generateCorrelationId,
    isValidCorrelationId,
    normalizeCorrelationId,
    shouldBypassCorrelation
} from "../correlation";

describe("Correlation ID Utils", () => {
    it("should generate a valid UUID v4", () => {
        const id = generateCorrelationId();
        expect(isValidCorrelationId(id)).toBe(true);
    });

    it("should normalize to lowercase", () => {
        expect(normalizeCorrelationId("ABC-123")).toBe("abc-123");
    });

    describe("Bypass Rules", () => {
        it("should bypass static assets", () => {
            expect(shouldBypassCorrelation("/style.css")).toBe(true);
            expect(shouldBypassCorrelation("/image.png")).toBe(true);
            expect(shouldBypassCorrelation("/script.js")).toBe(true);
        });

        it("should bypass system paths", () => {
            expect(shouldBypassCorrelation("/_next/static/abc")).toBe(true);
            expect(shouldBypassCorrelation("/.well-known/apple-app-site-association")).toBe(true);
            expect(shouldBypassCorrelation("/robots.txt")).toBe(true);
        });

        it("should NOT bypass api or page routes", () => {
            expect(shouldBypassCorrelation("/api/saas")).toBe(false);
            expect(shouldBypassCorrelation("/site/panel")).toBe(false);
            expect(shouldBypassCorrelation("/admin/dashboard")).toBe(false);
        });
    });
});
