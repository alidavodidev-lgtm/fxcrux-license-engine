"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Mail, User, ArrowRight } from "lucide-react";
import { WaveBackground } from "@/components/WaveBackground";

export default function AuthPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
    const payload = isLogin
      ? { username, password, rememberMe }
      : { email, username, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        if (!isLogin) {
          setIsLogin(true);
          setPassword("");
          setErrorMsg("Registration successful! Please sign in.");
        } else {
          // Read by SessionButton's idle-logout timer, which skips itself for
          // a remembered session (a 10-minute inactivity logout would defeat
          // the point of a 30-day "remember me" token).
          if (rememberMe) localStorage.setItem("fxcrux_remember_me", "1");
          else localStorage.removeItem("fxcrux_remember_me");
          router.push("/dashboard");
          router.refresh();
        }
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Authentication failed.");
      }
    } catch (err) {
      setErrorMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center overflow-hidden bg-black">

      <WaveBackground />
      <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-gold/10 rounded-full animate-glow mix-blend-screen pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gold/5 rounded-full animate-glow mix-blend-screen pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 gap-12 p-6 relative z-10 items-center">

        <div className="hidden lg:flex flex-col gap-7 animate-fade-in-up">
          <img src="/brand/fxcrux-badge.png" alt="FXCRUX" className="w-16 h-16 rounded-2xl animate-float shadow-[0_0_30px_rgba(212,175,55,0.25)]" />
          <h1 className="font-display text-5xl font-black tracking-tight text-white leading-[1.1]">
            Manage your<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gold-light to-gold-dark">software licenses</span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed max-w-md font-light">
            Sign in to review your licenses, download products, and check when access expires.
          </p>
        </div>

        <div className="glass-panel p-8 sm:p-10 rounded-2xl w-full max-w-md mx-auto animate-fade-in-up border border-black-border relative overflow-hidden" style={{ animationDelay: '0.1s' }}>
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-gold-dark via-gold to-gold-light" />

          <div className="flex flex-col items-center text-center mb-7 lg:hidden">
            <img src="/brand/fxcrux-badge.png" alt="FXCRUX" className="w-14 h-14 rounded-xl mb-4 shadow-[0_0_20px_rgba(212,175,55,0.25)]" />
            <h2 className="font-display text-2xl font-bold text-white tracking-wide">FXCRUX</h2>
          </div>

          <div className="flex items-center gap-1 mb-7 bg-black border border-black-border rounded-xl p-1">
            <button
              type="button"
              onClick={() => { setIsLogin(true); setErrorMsg(""); }}
              className={`flex-1 h-10 rounded-lg text-sm font-bold transition-all duration-300 ${isLogin ? 'bg-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsLogin(false); setErrorMsg(""); }}
              className={`flex-1 h-10 rounded-lg text-sm font-bold transition-all duration-300 ${!isLogin ? 'bg-gold text-black shadow-[0_0_15px_rgba(212,175,55,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Register
            </button>
          </div>

          {errorMsg && (
            <div className={`mb-6 p-3 text-sm font-medium rounded-xl text-center border ${errorMsg.includes('successful') ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border-rose-500/20'}`}>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            <div className={`space-y-2 overflow-hidden transition-all duration-500 ease-in-out ${!isLogin ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0 m-0'}`}>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest ml-1">Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-gold transition-colors" />
                <input
                  type="email"
                  placeholder="customer@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 rounded-xl border border-black-border bg-black-light text-white placeholder:text-gray-600 focus:outline-none focus:border-gold/60 focus:ring-4 focus:ring-gold/10 transition-all"
                  required={!isLogin}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest ml-1">Username</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-gold transition-colors" />
                <input
                  type="text"
                  placeholder="your-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 rounded-xl border border-black-border bg-black-light text-white placeholder:text-gray-600 focus:outline-none focus:border-gold/60 focus:ring-4 focus:ring-gold/10 transition-all"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest ml-1">Password</label>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-gold transition-colors" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 pl-12 pr-4 rounded-xl border border-black-border bg-black-light text-white placeholder:text-gray-600 focus:outline-none focus:border-gold/60 focus:ring-4 focus:ring-gold/10 transition-all"
                  required
                />
              </div>
            </div>

            {isLogin && (
              <label className="flex items-center gap-2.5 cursor-pointer select-none w-fit">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="peer sr-only"
                />
                <span className="w-5 h-5 rounded-md border border-black-border bg-black-light flex items-center justify-center transition-colors peer-checked:bg-gold peer-checked:border-gold peer-focus-visible:ring-2 peer-focus-visible:ring-gold/40">
                  {rememberMe && (
                    <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 text-black" fill="none">
                      <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="text-sm text-gray-400">Remember me for 30 days</span>
              </label>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 mt-6 bg-gradient-to-r from-gold-dark via-gold to-gold-light text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? 'Access Hub' : 'Create Account'}
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
