"use client";

import { useState } from "react";
import { Lock, User, Loader2, ShieldCheck } from "lucide-react";
import { WaveBackground } from "@/components/WaveBackground";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        window.location.href = "/";
      } else {
        setError("Invalid username or password.");
      }
    } catch (err) {
      setError("Server connection failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black p-4 overflow-hidden">
      <WaveBackground />
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-[#D4AF37]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-[#0A0A0A]/80 backdrop-blur-2xl border border-[#262626] p-8 rounded-3xl shadow-2xl relative z-10 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#AA8C2C] via-[#D4AF37] to-[#F1C40F]" />

        <div className="flex flex-col items-center text-center mb-8">
          <img src="/brand/fxcrux-badge.png" alt="FXCRUX" className="w-16 h-16 rounded-2xl mb-4 shadow-[0_0_30px_rgba(212,175,55,0.25)]" />
          <h1 className="font-heading text-3xl font-black text-white tracking-tight">FXCRUX Core</h1>
          <p className="text-xs text-[#AA8C2C] font-semibold uppercase tracking-widest mt-1.5">Institutional Licensing Control</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-sm rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-[#D4AF37] transition-colors" />
            <input
              type="text"
              className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#262626] bg-black text-white placeholder:text-gray-600 outline-none focus:border-[#D4AF37]/60 focus:ring-4 focus:ring-[#D4AF37]/10 transition-all"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="relative group">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-[#D4AF37] transition-colors" />
            <input
              type="password"
              className="w-full h-12 pl-12 pr-4 rounded-xl border border-[#262626] bg-black text-white placeholder:text-gray-600 outline-none focus:border-[#D4AF37]/60 focus:ring-4 focus:ring-[#D4AF37]/10 transition-all"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 mt-2 bg-gradient-to-r from-[#AA8C2C] via-[#D4AF37] to-[#F1C40F] text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />} Authenticate
          </button>
        </form>
      </div>
    </div>
  );
}
