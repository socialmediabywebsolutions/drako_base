export function rejectFinalUserAuthOnBase() {
  return {
    ok: false as const,
    code: "BASES_FINAL_USER_AUTH_DISABLED",
    message: "Campamento Base does not support final user registration/login.",
  };
}
