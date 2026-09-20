import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

let query = "mode=register";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(query),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

import SocialFlowAuthExperience from "./socialflow-auth-experience";

const fetchMock = vi.fn();

beforeEach(() => {
  query = "mode=register";
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
  // window.location.assign no está implementado en jsdom
  Object.defineProperty(window, "location", { value: { assign: vi.fn() }, writable: true });
});
afterEach(() => cleanup());

// El componente pinta el formulario dos veces (dos maquetas de la misma tarjeta): usamos el primero.
const first = <T,>(items: T[]) => items[0];

describe("registro: aceptación de términos", () => {
  it("muestra la casilla con enlaces reales y el botón deshabilitado hasta marcarla", () => {
    render(<SocialFlowAuthExperience />);
    const checkbox = first(screen.getAllByRole("checkbox")) as HTMLInputElement;
    expect(checkbox).not.toBeChecked();

    const terms = first(screen.getAllByRole("link", { name: "Términos de servicio" }));
    const privacy = first(screen.getAllByRole("link", { name: "Política de privacidad" }));
    expect(terms).toHaveAttribute("href", "/terminos");
    expect(privacy).toHaveAttribute("href", "/privacidad");

    const submit = first(screen.getAllByRole("button", { name: /Entrar a Socialcors|Crear cuenta/ }).filter((b) => (b as HTMLButtonElement).type === "submit")) as HTMLButtonElement;
    expect(submit).toBeDisabled();
    fireEvent.click(checkbox);
    expect(submit).toBeEnabled();
  });

  it("envía acceptedTerms: true al registrarse", async () => {
    render(<SocialFlowAuthExperience />);
    fireEvent.change(first(screen.getAllByPlaceholderText("Alex Rivera")), { target: { value: "Ana" } });
    fireEvent.change(first(screen.getAllByPlaceholderText("tu@empresa.com")), { target: { value: "ana@example.com" } });
    const password = first(Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]')));
    fireEvent.change(password, { target: { value: "Password123!" } });
    fireEvent.click(first(screen.getAllByRole("checkbox")));
    fireEvent.submit(first(Array.from(document.querySelectorAll("form"))));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/socialflow/auths/registrations");
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ email: "ana@example.com", name: "Ana", acceptedTerms: true });
  });
});

describe("login: sin casilla", () => {
  it("no muestra la casilla y mantiene la frase con enlaces reales", () => {
    query = "";
    render(<SocialFlowAuthExperience />);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    expect(first(screen.getAllByRole("link", { name: "Términos de servicio" }))).toHaveAttribute("href", "/terminos");
  });
});
