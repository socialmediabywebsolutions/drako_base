import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

let query = "";
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
const assign = vi.fn();
const ORIGIN = "https://socialcors.com";

function ok(body: unknown = {}) {
  return { ok: true, json: async () => body };
}
function fail(body: unknown, status = 401) {
  return { ok: false, status, json: async () => body };
}

beforeEach(() => {
  query = "";
  fetchMock.mockReset();
  assign.mockReset();
  fetchMock.mockResolvedValue(ok());
  vi.stubGlobal("fetch", fetchMock);
  Object.defineProperty(window, "location", { value: { assign, origin: ORIGIN }, writable: true });
});
afterEach(() => cleanup());

const form = () => document.querySelector("form") as HTMLFormElement;
const emailInput = () => screen.getByLabelText("Correo electrónico") as HTMLInputElement;
const passwordInput = () => screen.getByLabelText("Contraseña") as HTMLInputElement;
const submitButton = () => document.querySelector('button[type="submit"]') as HTMLButtonElement;

function fillLogin(email = "ana@example.com", password = "Password123!") {
  fireEvent.change(emailInput(), { target: { value: email } });
  fireEvent.change(passwordInput(), { target: { value: password } });
}

describe("presentación", () => {
  it("muestra la bienvenida, el selector y NO muestra tarjetas de planes ni precios", () => {
    render(<SocialFlowAuthExperience />);
    expect(screen.getByRole("heading", { level: 1, name: "Bienvenido a SocialCors" })).toBeInTheDocument();
    expect(screen.getByText("Tu Community Manager con Inteligencia Artificial")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Iniciar sesión" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Crear cuenta" })).toHaveAttribute("aria-selected", "false");
    expect(document.body.textContent).not.toMatch(/€|Starter|Básico|Pro\b|Más popular/);
    // el único acceso a los planes es un enlace discreto (con ?type=, porque /planes redirige al Home sin él)
    expect(screen.getByRole("link", { name: "Influencer" })).toHaveAttribute("href", "/socialflow/planes?type=influencer");
    expect(screen.getByRole("link", { name: "Empresa" })).toHaveAttribute("href", "/socialflow/planes?type=empresa");
  });

  it("usa el logo oficial de R2 (logo-cabecera.png) sin sustituirlo por texto", () => {
    render(<SocialFlowAuthExperience />);
    const logo = screen.getByAltText("SocialCors") as HTMLImageElement;
    expect(logo.src).toBe("https://pub-3e782268d66e465bbe7c7fa767074ee2.r2.dev/assets/logo-cabecera.png");
    expect(logo).toHaveAttribute("width", "1536");
    expect(logo).toHaveAttribute("height", "1024");
  });

  it("enlaza las rutas legales reales", () => {
    render(<SocialFlowAuthExperience />);
    expect(screen.getByRole("link", { name: "Términos de servicio" })).toHaveAttribute("href", "/terminos");
    expect(screen.getByRole("link", { name: "Política de privacidad" })).toHaveAttribute("href", "/privacidad");
    for (const [name, href] of [["Aviso Legal", "/aviso-legal"], ["Cookies", "/cookies"], ["Contacto", "/contacto"]] as const) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
    }
  });

  it("enlaza la recuperación de contraseña solo en el login", () => {
    render(<SocialFlowAuthExperience />);
    expect(screen.getByRole("link", { name: "¿Olvidaste tu contraseña?" })).toHaveAttribute("href", "/socialflow/auth/reset-password");
    fireEvent.click(screen.getByRole("tab", { name: "Crear cuenta" }));
    expect(screen.queryByRole("link", { name: "¿Olvidaste tu contraseña?" })).not.toBeInTheDocument();
  });

  it("muestra y oculta la contraseña", () => {
    render(<SocialFlowAuthExperience />);
    expect(passwordInput()).toHaveAttribute("type", "password");
    const toggle = screen.getByRole("button", { name: "Mostrar contraseña" });
    fireEvent.click(toggle);
    expect(passwordInput()).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ocultar contraseña" })).toHaveAttribute("aria-pressed", "true");
  });

  it("cambia entre login y registro sin navegar ni llamar al backend", () => {
    render(<SocialFlowAuthExperience />);
    expect(submitButton()).toHaveTextContent("Entrar en SocialCors →");
    fireEvent.click(screen.getByRole("tab", { name: "Crear cuenta" }));
    expect(screen.getByLabelText("Tu nombre")).toBeInTheDocument();
    expect(submitButton()).toHaveTextContent("Crear cuenta →");
    fireEvent.click(screen.getByRole("tab", { name: "Iniciar sesión" }));
    expect(screen.queryByLabelText("Tu nombre")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("?mode=register abre directamente el registro", () => {
    query = "mode=register";
    render(<SocialFlowAuthExperience />);
    expect(screen.getByRole("tab", { name: "Crear cuenta" })).toHaveAttribute("aria-selected", "true");
  });

  it("con ?type muestra el distintivo, la etiqueta del botón y un único enlace a sus planes", () => {
    query = "mode=register&type=influencer";
    render(<SocialFlowAuthExperience />);
    expect(screen.getByText("✓ Plan Influencer · 15 días gratis")).toBeInTheDocument();
    expect(submitButton()).toHaveTextContent("Crear cuenta de Influencer →");
    expect(screen.getByRole("link", { name: "Ver planes →" })).toHaveAttribute("href", "/socialflow/planes?type=influencer");
  });
});

describe("login", () => {
  it("inicia sesión con el endpoint actual y navega a /socialflow", async () => {
    render(<SocialFlowAuthExperience />);
    fillLogin();
    fireEvent.submit(form());
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/socialflow"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/socialflow/auths/logins");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ email: "ana@example.com", password: "Password123!" });
  });

  it("respeta callbackUrl del mismo origen y descarta el de otro origen", async () => {
    query = "callbackUrl=/socialflow/plan?x=1";
    const first = render(<SocialFlowAuthExperience />);
    fillLogin();
    fireEvent.submit(form());
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/socialflow/plan?x=1"));
    first.unmount();

    assign.mockReset();
    query = "next=https://evil.example/robo";
    render(<SocialFlowAuthExperience />);
    fillLogin();
    fireEvent.submit(form());
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/socialflow"));
  });

  it("muestra el error de credenciales del servidor y no navega", async () => {
    fetchMock.mockResolvedValue(fail({ message: "Invalid credentials." }));
    render(<SocialFlowAuthExperience />);
    fillLogin();
    fireEvent.submit(form());
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid credentials.");
    expect(assign).not.toHaveBeenCalled();
    expect(submitButton()).toBeEnabled();
  });

  it("valida los campos vacíos con los mensajes de siempre", async () => {
    render(<SocialFlowAuthExperience />);
    fireEvent.submit(form());
    expect(await screen.findByRole("alert")).toHaveTextContent("Introduce tu correo electrónico.");
    fireEvent.change(emailInput(), { target: { value: "ana@example.com" } });
    fireEvent.submit(form());
    expect(await screen.findByRole("alert")).toHaveTextContent("Introduce tu contraseña.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("registro", () => {
  beforeEach(() => { query = "mode=register"; });

  function fillRegister() {
    fireEvent.change(screen.getByLabelText("Tu nombre"), { target: { value: "Ana" } });
    fillLogin();
  }

  it("exige nombre y la casilla de términos (el botón queda deshabilitado hasta marcarla)", async () => {
    render(<SocialFlowAuthExperience />);
    fireEvent.submit(form());
    expect(await screen.findByRole("alert")).toHaveTextContent("Introduce tu nombre.");
    fireEvent.change(screen.getByLabelText("Tu nombre"), { target: { value: "Ana" } });
    expect(submitButton()).toBeDisabled();
    fireEvent.submit(form());
    expect(await screen.findByRole("alert")).toHaveTextContent("Debes aceptar los Términos de servicio");
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox"));
    expect(submitButton()).toBeEnabled();
  });

  it("envía acceptedTerms y, sin ?type, va a elegir el tipo de cuenta", async () => {
    render(<SocialFlowAuthExperience />);
    fillRegister();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(form());
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/socialflow/onboarding/type"));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/socialflow/auths/registrations");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ email: "ana@example.com", name: "Ana", password: "Password123!", acceptedTerms: true });
  });

  it("con ?type=influencer guarda el tipo y va a los planes de influencer", async () => {
    query = "mode=register&type=influencer";
    render(<SocialFlowAuthExperience />);
    fillRegister();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(form());
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/socialflow/onboarding/plans"));
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/socialflow/onboarding/account-type");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ accountType: "influencer" });
  });

  it("con ?type=empresa va a los planes de empresa", async () => {
    query = "mode=register&type=empresa";
    render(<SocialFlowAuthExperience />);
    fillRegister();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(form());
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/socialflow/onboarding/plans-empresa"));
  });

  it("muestra el error del servidor al registrar (p. ej. email ya existente)", async () => {
    fetchMock.mockResolvedValue(fail({ message: "Email already registered." }, 409));
    render(<SocialFlowAuthExperience />);
    fillRegister();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(form());
    expect(await screen.findByRole("alert")).toHaveTextContent("Email already registered.");
    expect(assign).not.toHaveBeenCalled();
  });

  it("muestra los requisitos de la contraseña mientras se escribe", () => {
    render(<SocialFlowAuthExperience />);
    fireEvent.change(passwordInput(), { target: { value: "abc" } });
    expect(screen.getByText("Mínimo 8 caracteres").closest("li")).toHaveAttribute("data-met", "false");
    fireEvent.change(passwordInput(), { target: { value: "Abcdefg1" } });
    expect(screen.getByText("Mínimo 8 caracteres").closest("li")).toHaveAttribute("data-met", "true");
    expect(screen.getByText("Al menos una mayúscula").closest("li")).toHaveAttribute("data-met", "true");
    expect(screen.getByText("Al menos un número").closest("li")).toHaveAttribute("data-met", "true");
  });
});
