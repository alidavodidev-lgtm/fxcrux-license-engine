"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";

// A direct, one-click logout - previously the only way to log out was to open
// the password-change dialog and find it buried in the footer down there.
export function AdminLogoutButton() {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin-login";
  };

  return (
    <>
      <button
        onClick={() => setConfirmOpen(true)}
        className="flex items-center justify-center p-2.5 rounded-xl bg-card border border-border/50 text-rose-500 hover:bg-rose-500/10 transition-colors"
        title="Log out"
      >
        <LogOut className="w-5 h-5" />
      </button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Log Out"
        description="You'll need to sign in again to access the admin panel."
        confirmLabel="Log Out"
        onConfirm={handleLogout}
      />
    </>
  );
}
