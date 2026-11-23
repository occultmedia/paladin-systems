import type { Metadata } from "next";
import { AuthShell, ForgotPasswordForm } from "@/components/auth/auth-forms";
import { MARKET_TOTAL, marketBrief, scanRows } from "@/lib/scan-data";

export const metadata: Metadata = { title: "Forgot password | Terminal", robots: { index: false } };

export default function ForgotPasswordPage() {
  return (
    <AuthShell rows={scanRows()} total={MARKET_TOTAL} headline={marketBrief().headline}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
