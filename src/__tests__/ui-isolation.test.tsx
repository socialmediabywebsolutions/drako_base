import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import RootLayout from "../app/layout";
import { headers } from "next/headers";
import React from "react";

// Mock implementation of headers
vi.mock("next/headers", () => ({
    headers: vi.fn(),
}));

// Mock Providers to avoid SessionProvider context issues
vi.mock("../app/providers", () => ({
    Providers: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock Shell Components to avoid heavy rendering
vi.mock("@/components/layouts/shell-layout", () => ({
    default: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="admin-shell" data-shell="admin">{children}</div>
    )
}));

vi.mock("@/components/dev/HostSwitcher", () => ({
    default: () => <div data-testid="host-switcher" />
}));

describe("UI Shell Isolation (Steel Anti-Leak)", () => {
    it("should render PublicShell for /site routes", async () => {
        (headers as any).mockResolvedValue(new Map([
            ["x-drako-host-mode", "CAMPAMENTO_BASE"],
            ["x-matched-path", "/site/panel"]
        ]));

        const result = await RootLayout({ children: <div data-testid="content">Content</div> });
        render(result as any);

        const publicShell = document.querySelector('[data-shell="public"]');
        expect(publicShell).toBeInTheDocument();
    });

    it("should render AdminShell for root admin routes", async () => {
        (headers as any).mockResolvedValue(new Map([
            ["x-drako-host-mode", "CAMPAMENTO_BASE"],
            ["x-matched-path", "/admin"]
        ]));

        const result = await RootLayout({ children: <div data-testid="content">Content</div> });
        render(result as any);

        const adminShell = document.querySelector('[data-shell="admin"]');
        expect(adminShell).toBeInTheDocument();
    });

    it("should render PublicShell when hostMode is PUBLIC_SAAS", async () => {
        (headers as any).mockResolvedValue(new Map([
            ["x-drako-host-mode", "PUBLIC_SAAS"],
            ["x-matched-path", "/dashboard"]
        ]));

        const result = await RootLayout({ children: <div data-testid="content">Content</div> });
        render(result as any);

        const publicShell = document.querySelector('[data-shell="public"]');
        expect(publicShell).toBeInTheDocument();
    });
});

import "@testing-library/jest-dom";
