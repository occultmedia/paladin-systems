import type { Metadata } from "next";
import { AuthShell, SignupForm } from "@/components/auth/auth-forms";
import { MARKET_TOTAL, marketBrief, scanRows } from "@/lib/scan-data";
import { planOf } from "@/lib/site";

export const metadata: Metadata = {
  title: "Create your account | Terminal",
  description: "Sign up for Terminal: Aruba real estate market intelligence, read by AI every morning.",
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  return (
    <AuthShell rows={scanRows()} total={MARKET_TOTAL} headline={marketBrief().headline}>
      <SignupForm initialPlan={planOf(plan)} />
    </AuthShell>
  );
}
