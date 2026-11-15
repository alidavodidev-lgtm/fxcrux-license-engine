"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function SessionButton({ isCollapsed }: { isCollapsed: boolean }) {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);

  const performLogout = async () => {
    try {
      localStorage.removeItem("fxcrux_remember_me");
      await fetch("/api/auth/logout", { method: "POST" });
      // Not "/" - that route immediately server-redirects to /dashboard (see
      // app/page.tsx), which bounced logout back into the app before
      // HardwareGuard's async 401 check ever got a chance to redirect away.
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleLogout = async (reason: "Manual" | "Timeout" = "Manual") => {
    if (reason === "Manual") {
      setShowConfirm(true);
      return;
    }
    toast.warning("Your session has expired due to 10 minutes of inactivity.", {
      description: "For your security, you have been logged out.",
    });
    await performLogout();
  };

  useEffect(() => {
    // A "remember me" login is meant to keep the user signed in for 30 days -
    // an unconditional 10-minute inactivity logout defeated that entirely.
    // Skip the timer for a remembered session and rely on the JWT's own
    // long expiry instead.
    if (localStorage.getItem("fxcrux_remember_me")) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      // 10 minutes = 10 * 60 * 1000 milliseconds = 600000 ms
      timeoutId = setTimeout(() => handleLogout("Timeout"), 600000);
    };

    const activeEvents = ["mousemove", "keydown", "mousedown", "touchstart", "scroll"];
    activeEvents.forEach(event => document.addEventListener(event, resetTimer));

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      activeEvents.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, []);

  return (
    <div className="p-5 border-t border-black-border">
      <button
        onClick={() => handleLogout("Manual")}
        className={`w-full flex items-center gap-4 px-3 py-3 rounded-xl text-red-500/80 hover:bg-red-500/10 hover:text-red-500 transition-all duration-300 ${isCollapsed ? 'justify-center' : ''}`}
      >
        <LogOut className="w-5 h-5 flex-shrink-0" />
        {!isCollapsed && <span className="font-bold text-sm">Log Out</span>}
      </button>

      <ConfirmDialog
        open={showConfirm}
        title="Log Out"
        message="Are you sure you want to log out of your account?"
        confirmLabel="Log Out"
        onConfirm={() => {
          setShowConfirm(false);
          performLogout();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
