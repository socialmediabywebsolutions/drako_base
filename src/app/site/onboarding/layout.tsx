"use client";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "white", minHeight: "100dvh" }}>
      {children}
    </div>
  );
}
