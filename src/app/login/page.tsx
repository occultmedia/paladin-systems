import type { Metadata } from "next";
import { AuthShell, LoginForm } from "@/components/auth/auth-forms";
import { MARKET_TOTAL, marketBrief, scanRows } from "@/lib/scan-data";

export const metadata: Metadata = { title: "Log in | Baseline", robots: { index: false } };

export default function LoginPage() {
  return (
    <AuthShell rows={scanRows()} total={MARKET_TOTAL} headline={marketBrief().headline}>
      <LoginForm />
    </AuthShell>
  );
}
