"use client";

import { usePathname } from "next/navigation";

// Pages with no sidebar (Navigation renders nothing on these routes) don't need
// the reserved lg:pr-64 gutter either - without this, content on those pages
// renders visibly off-center on desktop.
const noChromeRoutes = ["/", "/login", "/register"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hasChrome = !noChromeRoutes.includes(pathname);

  return (
    <main className={`flex-1 w-full min-h-screen overflow-x-hidden ${hasChrome ? "pb-24 lg:pb-0 lg:pr-64" : ""}`}>
      {children}
    </main>
  );
}
