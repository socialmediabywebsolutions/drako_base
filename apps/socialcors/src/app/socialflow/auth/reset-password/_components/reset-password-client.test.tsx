import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

let query = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a>,
}));

import ResetPasswordClient from "./reset-password-client";

const fetchMock = vi.fn();
beforeEach(() => {
  query = "";
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => cleanup());

describe("recuperar contraseña: pedir el enlace", () => {
  it("envía el email y confirma con el mensaje de siempre", async () => {
    render(<ResetPasswordClient />);
    expect(screen.getByRole("heading", { level: 1, name: "Restablece tu contraseña" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: " ana@example.com " } });
    fireEvent.submit(document.querySelector("form")!);
    expect(await screen.findByRole("heading", { name: "Revisa tu bandeja" })).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/socialflow/auths/password-resets");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ email: "ana@example.com" });
    expect(screen.getByRole("link", { name: /Volver al inicio de sesión/ })).toHaveAttribute("href", "/socialflow/auth");
  });

  it("muestra el error del servidor", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ message: "Demasiados intentos." }) });
    render(<ResetPasswordClient />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ana@example.com" } });
    fireEvent.submit(document.querySelector("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Demasiados intentos.");
  });
});

describe("recuperar contraseña: nueva contraseña con token", () => {
  beforeEach(() => { query = "token=abc123"; });

  it("rechaza contraseñas distintas sin llamar al backend", async () => {
    render(<ResetPasswordClient />);
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "Password123!" } });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "Otra12345" } });
    fireEvent.submit(document.querySelector("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Las contraseñas no coinciden.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("envía token y contraseña y muestra la confirmación con enlace al login", async () => {
    render(<ResetPasswordClient />);
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "Password123!" } });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "Password123!" } });
    fireEvent.submit(document.querySelector("form")!);
    expect(await screen.findByRole("heading", { name: "¡Listo!" })).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/socialflow/auths/password-resets/confirm");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ token: "abc123", password: "Password123!" });
    expect(screen.getByRole("link", { name: "Ir al inicio de sesión" })).toHaveAttribute("href", "/socialflow/auth");
  });

  it("muestra el error del servidor (p. ej. enlace caducado)", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ message: "El enlace ha caducado." }) });
    render(<ResetPasswordClient />);
    fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "Password123!" } });
    fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "Password123!" } });
    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("El enlace ha caducado."));
  });
});
