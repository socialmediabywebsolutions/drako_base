import type { ReactNode } from "react";
import { defaultMarketingLocale } from "@shared-neutral/marketing-locales";
import { AppProviders } from "@shared-ui-neutral/app-providers";

export const metadata = {
  title: "SocialFlow Runtime Canary Scaffold",
  description: "Inactive scaffold for the future isolated SocialFlow runtime.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={defaultMarketingLocale}>
      <body data-runtime-root="socialflow-runtime-canary">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
