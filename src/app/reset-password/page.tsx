import type { Metadata } from "next";
import { AuthShell, ResetPasswordForm } from "@/components/auth/auth-forms";
import { MARKET_TOTAL, marketBrief, scanRows } from "@/lib/scan-data";

export const metadata: Metadata = { title: "Choose a new password | Baseline", robots: { index: false } };

export default function ResetPasswordPage() {
  return (
    <AuthShell rows={scanRows()} total={MARKET_TOTAL} headline={marketBrief().headline}>
      <ResetPasswordForm />
    </AuthShell>
  );
}
