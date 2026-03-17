export type AuthLang = "es" | "en";

export const authI18n = {
    es: {
        login: "Iniciar Sesión",
        register: "Crear Cuenta",
        email: "CORREO ELECTRÓNICO",
        password: "CONTRASEÑA",
        name: "NOMBRE COMPLETO",
        or: "O",
        google: "Continuar con Google",
        processing: "Procesando...",
        success_register: "¡Cuenta creada! Ya puedes iniciar sesión.",
        errors: {
            EMAIL_EXISTS: "Este correo ya está registrado.",
            MISSING_FIELDS: "Por favor, rellena todos los campos.",
            INVALID_CREDENTIALS: "Correo o contraseña incorrectos.",
            INVALID_INPUT: "Revisa los campos obligatorios e inténtalo de nuevo.",
            INVITE_NOT_FOUND: "La invitación ya no está disponible.",
            INVITE_NOT_PENDING: "La invitación ya no se puede usar.",
            INVITE_EXPIRED: "La invitación ha expirado.",
            INVITE_EMAIL_MISMATCH: "Debes usar el correo exacto de la invitación.",
            SERVICE_UNAVAILABLE: "Servicio no disponible. Inténtalo más tarde.",
            INTERNAL_SERVER_ERROR: "Error interno del sistema. Reintenta.",
            generic: "Ha ocurrido un error inesperado."
        }
    },
    en: {
        login: "Sign In",
        register: "Create Account",
        email: "EMAIL ADDRESS",
        password: "PASSWORD",
        name: "FULL NAME",
        or: "OR",
        google: "Continue with Google",
        processing: "Processing...",
        success_register: "Account created! Please log in.",
        errors: {
            EMAIL_EXISTS: "This email is already registered.",
            MISSING_FIELDS: "Please fill in all fields.",
            INVALID_CREDENTIALS: "Invalid email or password.",
            INVALID_INPUT: "Check the required fields and try again.",
            INVITE_NOT_FOUND: "This invite is no longer available.",
            INVITE_NOT_PENDING: "This invite can no longer be used.",
            INVITE_EXPIRED: "This invite has expired.",
            INVITE_EMAIL_MISMATCH: "You must use the exact email from the invite.",
            SERVICE_UNAVAILABLE: "Service unavailable. Try again later.",
            INTERNAL_SERVER_ERROR: "Internal server error. Please retry.",
            generic: "An unexpected error occurred."
        }
    }
};

export function getAuthTexts(lang: AuthLang = "es") {
    return authI18n[lang] || authI18n.es;
}
