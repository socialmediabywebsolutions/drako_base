"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";

// Campos compartidos por el acceso y la recuperación de contraseña. Solo presentación: el estado
// y la validación de cada formulario siguen en su componente.
export function AuthField({
  id,
  label,
  right,
  children,
}: {
  id: string;
  label: string;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="sa-field">
      <div className="sa-label-row">
        <label htmlFor={id} className="sa-label">
          {label}
        </label>
        {right}
      </div>
      {children}
    </div>
  );
}

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "className">;

/** Campo de contraseña con botón de mostrar/ocultar (accesible por teclado y para lectores). */
export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="sa-pw">
      <input {...props} type={visible ? "text" : "password"} className="sa-input" />
      <button
        type="button"
        className="sa-eye"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
      >
        {visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>
  );
}
