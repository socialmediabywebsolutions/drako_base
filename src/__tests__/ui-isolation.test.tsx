import { describe, expect, it, vi } from "vitest";
import React from "react";
import RootLayout from "../app/layout";
import { headers } from "next/headers";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

function getBodyChild(result: React.ReactElement) {
  const body = result.props.children as React.ReactElement;
  expect(body.type).toBe("body");
  return body.props.children as React.ReactElement;
}

describe("UI Shell Isolation (Steel Anti-Leak)", () => {
  it("keeps the root layout neutral for site routes", async () => {
    (headers as any).mockResolvedValue(new Map([["x-matched-path", "/site/panel"]]));

    const result = await RootLayout({ children: <div data-testid="content">Content</div> }) as React.ReactElement;
    const child = getBodyChild(result);

    expect(result.type).toBe("html");
    expect(result.props.lang).toBe("es");
    expect(child.props["data-testid"]).toBe("content");
  });

  it("derives the locale from localized public paths without injecting shells", async () => {
    (headers as any).mockResolvedValue(new Map([["x-matched-path", "/en/products"]]));

    const result = await RootLayout({ children: <div data-testid="localized-content">Content</div> }) as React.ReactElement;
    const child = getBodyChild(result);

    expect(result.props.lang).toBe("en");
    expect(child.props["data-testid"]).toBe("localized-content");
  });

  it("stays neutral for mentoria workspace routes", async () => {
    (headers as any).mockResolvedValue(new Map([["x-matched-path", "/mentoria/app"]]));

    const result = await RootLayout({ children: <div data-testid="mentoria-content">Content</div> }) as React.ReactElement;
    const child = getBodyChild(result);

    expect(result.props.lang).toBe("es");
    expect(child.props["data-testid"]).toBe("mentoria-content");
  });
});
