import type { Metadata } from "next";
import { AuthShell, SignupForm } from "@/components/auth/auth-forms";
import { MARKET_TOTAL, marketBrief, scanRows } from "@/lib/scan-data";

export const metadata: Metadata = {
  title: "Create your account | Signal",
  description: "Sign up for Signal: the whole Aruba real estate market, read by AI every morning.",
};

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  return (
    <AuthShell rows={scanRows()} total={MARKET_TOTAL} headline={marketBrief().headline}>
      <SignupForm initialPlan={plan === "yearly" ? "yearly" : "monthly"} />
    </AuthShell>
  );
}
