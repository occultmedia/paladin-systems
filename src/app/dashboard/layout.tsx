import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aruba Terminal | Sequence Data",
  description: "Aruba ultra-luxury short-term rental market terminal: occupancy, ADR, RevPAR, gross yield and listing signals.",
  alternates: { canonical: "/dashboard" },
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
