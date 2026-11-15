"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

const IDLE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes

// Admin accounts are privileged, so unlike the client app this always logs
// out on idle - there's no "remember me" here by design (see login route).
export function AdminIdleLogout() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/admin-login') return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const logout = async () => {
      toast.warning("Signed out after 10 minutes of inactivity.");
      await fetch("/api/admin/logout", { method: "POST" });
      window.location.href = "/admin-login";
    };

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(logout, IDLE_LIMIT_MS);
    };

    const activeEvents = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    activeEvents.forEach((event) => document.addEventListener(event, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      activeEvents.forEach((event) => document.removeEventListener(event, resetTimer));
    };
  }, [pathname]);

  return null;
}
