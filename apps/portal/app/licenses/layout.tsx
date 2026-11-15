import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Licenses",
  robots: { index: false, follow: false },
};

export default function LicensesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
