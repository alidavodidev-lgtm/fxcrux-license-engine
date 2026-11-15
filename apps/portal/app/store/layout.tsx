import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Store",
  robots: { index: false, follow: false },
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
