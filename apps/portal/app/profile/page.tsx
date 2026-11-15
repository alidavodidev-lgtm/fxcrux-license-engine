"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { User, ShieldCheck, Cpu, Key, Lock, Loader2, X, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/Skeleton";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // State for Password Change
  const [showPassModal, setShowPassModal] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // The desktop sidebar has its own logout button (SessionButton), but the
  // mobile bottom nav has no room for one - this is the only way to sign out
  // on a phone, so it needs to exist here regardless of screen size too.
  const handleLogout = async () => {
    try {
      localStorage.removeItem("fxcrux_remember_me");
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  useEffect(() => {
    fetch("/api/user/profile").then(r => r.json()).then(data => {
      setUser(data); setLoading(false);
    });
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPass || newPass.length < 6) return toast.error("Password must be at least 6 characters.");
    setIsChangingPass(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newPass })
      });
      if (res.ok) {
        toast.success("Password updated successfully!");
        setShowPassModal(false);
        setNewPass("");
      } else {
        toast.error("Failed to update password.");
      }
    } catch { toast.error("Network error.", { description: "Could not reach the server. Please try again." }); }
    setIsChangingPass(false);
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8 min-h-screen">
        <div className="flex items-center gap-4 pb-6 border-b border-black-border">
          <Skeleton className="w-14 h-14 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <div className="bg-black-light border border-black-border rounded-2xl p-6 space-y-4">
              <Skeleton className="w-10 h-10 rounded-full" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-24 rounded-lg" />
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="bg-black border border-black-border rounded-2xl p-6 sm:p-8 space-y-6">
              <div className="space-y-3">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-black-border">
                <Skeleton className="h-14 w-full rounded-xl" />
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto animate-fade-in-up space-y-8 min-h-screen">
      <div className="flex items-center gap-4 pb-6 border-b border-black-border">
        <div className="w-14 h-14 bg-gold/10 border border-gold/20 rounded-2xl flex items-center justify-center text-gold"><User className="w-7 h-7" /></div>
        <div><h1 className="font-display text-3xl font-black text-white tracking-tight">Profile</h1><p className="text-sm text-gray-400">Your account and security settings.</p></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6 animate-fade-in-up">
          <div className="bg-black-light border border-black-border rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
            <ShieldCheck className="w-10 h-10 text-emerald-500 mb-4 relative z-10" />
            <h3 className="text-lg font-bold text-white mb-1">Security Level</h3>
            <p className="text-sm text-gray-400 mb-4">{user?.machine_id ? 'Hardware Bound' : 'Unsecured'}</p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 text-xs font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Protected
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6 animate-fade-in-up" style={{ animationDelay: '0.08s' }}>
          <div className="bg-black border border-black-border rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="space-y-4">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Machine ID</label>
              <div className="flex items-center gap-3 p-4 bg-black-light border border-black-border rounded-xl">
                <Cpu className="w-5 h-5 text-gold flex-shrink-0" />
                <code className="text-sm text-gray-300 font-mono break-all">{user?.machine_id || "No hardware bound yet."}</code>
                <Lock className="w-4 h-4 text-emerald-500 flex-shrink-0 ml-auto" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-black-border">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Username</label>
                <div className="flex items-center gap-3 p-4 bg-black-light border border-black-border rounded-xl">
                  <User className="w-5 h-5 text-gray-500" />
                  <span className="text-white font-medium">{user?.username}</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Password</label>
                <button onClick={() => setShowPassModal(true)} className="w-full flex items-center justify-center gap-2 p-4 bg-black-light border border-black-border rounded-xl hover:border-gold/50 hover:text-gold transition-colors text-gray-400 font-medium">
                  <Key className="w-5 h-5" /> Change Password
                </button>
              </div>
            </div>

            <div className="pt-6 border-t border-black-border">
              <button onClick={() => setShowLogoutConfirm(true)} className="w-full flex items-center justify-center gap-2 p-4 bg-black-light border border-black-border rounded-xl hover:border-rose-500/50 hover:text-rose-500 transition-colors text-gray-400 font-medium">
                <LogOut className="w-5 h-5" /> Log Out
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-black-light border border-black-border rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Update Password</h3>
              <button onClick={() => setShowPassModal(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">New Password</label>
                <input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} required minLength={6} className="w-full mt-2 bg-black border border-black-border rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold" placeholder="Enter new password" />
              </div>
              <button type="submit" disabled={isChangingPass} className="w-full bg-gold text-black font-bold rounded-xl py-3 hover:bg-gold-light transition-colors disabled:opacity-50">
                {isChangingPass ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Save Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showLogoutConfirm}
        title="Log Out"
        message="Are you sure you want to log out of your account?"
        confirmLabel="Log Out"
        onConfirm={() => { setShowLogoutConfirm(false); handleLogout(); }}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
