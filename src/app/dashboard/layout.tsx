import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aruba Terminal | Tide",
  description: "Aruba real estate terminal: every listing checked daily, price history, your watchlist and interested clients.",
  alternates: { canonical: "/dashboard" },
  robots: { index: false, follow: false },
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
