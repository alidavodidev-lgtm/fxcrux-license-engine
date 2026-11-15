"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";
import { Navigation } from "@/components/navigation";

// Owns whether the sidebar/nav renders at all, not just the page content -
// Navigation used to be a layout-level sibling of this guard with no relation
// to auth state, so it rendered in full for a split second on every direct
// visit to a protected URL before this component's async check redirected
// away. Rendering it here, gated on a confirmed "bound"/"unbound" state,
// closes that flash-of-protected-UI window.
type AuthState = "checking" | "unauthenticated" | "unbound" | "bound";

export function HardwareGuard({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const pathname = usePathname();
  const router = useRouter();

  const publicRoutes = ["/login"];

  useEffect(() => {
    if (publicRoutes.includes(pathname)) {
        return;
    }

    const checkStatus = async () => {
      try {
        const res = await fetch("/api/auth/status", { cache: "no-store" });

        // Any non-ok response (missing cookie, expired/invalid token) means
        // "not authenticated" - kick the user back to login page.
        if (!res.ok) {
          setAuthState("unauthenticated");
          router.push("/login");
          return;
        }

        const data = await res.json();
        setAuthState(data.is_bound ? "bound" : "unbound");
      } catch {
        setAuthState("unauthenticated");
        router.push("/login");
      }
    };

    checkStatus();
  }, [pathname, router]);

  if (publicRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  if (authState === "checking" || authState === "unauthenticated") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black">
        <Loader2 className="w-10 h-10 text-gold animate-spin mb-4" />
        <p className="text-gray-400 font-medium tracking-widest uppercase text-xs">Verifying Security State...</p>
      </div>
    );
  }

  if (authState === "unbound" && process.env.NEXT_PUBLIC_REQUIRE_HARDWARE_BINDING === "true") {
    return (
      <>
      <Navigation />
      <div className="relative min-h-screen bg-black overflow-hidden">

        <div className="absolute inset-0 blur-xl opacity-20 pointer-events-none select-none p-10 flex flex-col gap-8">
           <div className="flex justify-between items-center">
              <div className="w-64 h-12 bg-black-light border border-black-border rounded-xl"></div>
              <div className="w-40 h-12 bg-black-light border border-black-border rounded-xl"></div>
           </div>
           <div className="grid grid-cols-3 gap-6">
              <div className="h-40 bg-black-light border border-black-border rounded-2xl"></div>
              <div className="h-40 bg-black-light border border-black-border rounded-2xl"></div>
              <div className="h-40 bg-black-light border border-black-border rounded-2xl"></div>
           </div>
           <div className="w-full h-96 bg-black-light border border-black-border rounded-2xl mt-4"></div>
        </div>

        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="max-w-md w-full bg-black-light border border-black-border rounded-3xl p-8 sm:p-10 text-center shadow-2xl animate-fade-in-up relative overflow-hidden">

            <div className="w-20 h-20 mx-auto bg-rose-500/10 border border-rose-500/20 rounded-full flex items-center justify-center mb-6 relative">
              <Lock className="w-10 h-10 text-rose-500 relative z-10" />
              <div className="absolute inset-0 rounded-full border border-rose-500/50 animate-ping opacity-20"></div>
            </div>

            <h2 className="text-2xl font-black text-white mb-2 tracking-wide">HARDWARE LOCK</h2>
            <p className="text-sm text-gray-400 leading-relaxed mb-8">
              Activate a license from your product on the device you want to bind, then refresh this page.
            </p>


          </div>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <Navigation />
      {children}
    </>
  );
}
