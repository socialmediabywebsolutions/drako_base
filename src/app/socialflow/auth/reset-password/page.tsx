import { Suspense } from "react";
import ResetPasswordClient from "./_components/reset-password-client";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f6fa]" />}>
      <ResetPasswordClient />
    </Suspense>
  );
}
