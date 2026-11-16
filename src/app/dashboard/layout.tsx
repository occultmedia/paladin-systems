import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aruba Terminal | Signal",
  description: "Aruba real estate terminal: every listing scraped daily, your watchlist, district values and ROPV zoning.",
  alternates: { canonical: "/dashboard" },
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
