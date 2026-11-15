"use client";
import { useState, useEffect, useCallback } from "react";
import { Key, Activity, Zap, Server, Download } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import { usePolling } from "@/hooks/usePolling";

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLicenses = useCallback(() => {
    fetch("/api/user/licenses").then(r => r.json()).then(data => {
      setLicenses(Array.isArray(data) ? data : []); setLoading(false);
    });
  }, []);

  useEffect(() => { loadLicenses(); }, [loadLicenses]);
  usePolling(loadLicenses, 20000);

  const calculateDaysLeft = (expiresAt: string) => {
    if (!expiresAt) return 0;
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
  };

  const calculateProgress = (createdAt: string, expiresAt: string) => {
    if (!createdAt || !expiresAt) return 0;
    const start = new Date(createdAt).getTime();
    const end = new Date(expiresAt).getTime();
    const now = new Date().getTime();

    const total = end - start;
    const remaining = end - now;

    if (total <= 0) return 0;
    let percentage = (remaining / total) * 100;

    // Clamp to 0-100 in case of any rounding drift.
    return Math.max(0, Math.min(100, percentage));
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-8 min-h-screen">
        <div className="flex items-center gap-4 pb-6 border-b border-black-border">
          <Skeleton className="w-14 h-14 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-black-light border border-black-border rounded-2xl p-6 space-y-6">
              <Skeleton className="w-12 h-12 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto animate-fade-in-up space-y-8 min-h-screen">
      <div className="flex items-center justify-between pb-6 border-b border-black-border">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gold/10 border border-gold/20 rounded-2xl flex items-center justify-center text-gold"><Key className="w-7 h-7" /></div>
          <div><h1 className="font-display text-3xl font-black text-white tracking-tight">My Licenses</h1><p className="text-sm text-gray-400">Your software licenses and their expiration dates.</p></div>
        </div>
      </div>

      {licenses.length === 0 ? (
        <div className="bg-black-light/50 border border-black-border border-dashed p-16 rounded-2xl flex flex-col items-center justify-center text-center">
          <Server className="w-12 h-12 text-gray-600 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">No Licenses Yet</h3>
          <p className="text-gray-400">You haven't bought any tools yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {licenses.map((lic, i) => {
            const daysLeft = calculateDaysLeft(lic.expires_at);
            const isActive = lic.status === 'active' && daysLeft > 0;
            const isPending = lic.status === 'pending';
            const progressPercentage = calculateProgress(lic.created_at, lic.expires_at);

            return (
              <div key={lic.id} className={`bg-black-light border border-black-border rounded-2xl p-6 relative overflow-hidden transition-all animate-fade-in-up ${isActive ? 'group hover:border-gold/40 hover:-translate-y-0.5' : 'opacity-70'}`} style={{ animationDelay: `${0.05 * i}s` }}>
                <div className="absolute top-0 right-0 p-4">
                  {isActive ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 text-[10px] font-bold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Active</div>
                  ) : isPending ? (
                     <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-500 text-[10px] font-bold uppercase tracking-wider">Pending</div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-500 text-[10px] font-bold uppercase tracking-wider">Expired</div>
                  )}
                </div>

                <div className={`w-12 h-12 bg-black border border-black-border rounded-xl flex items-center justify-center mb-6 ${isActive ? 'text-gold shadow-[0_0_15px_rgba(212,175,55,0.15)]' : 'text-gray-600'}`}>
                  {isActive ? <Activity className="w-6 h-6" /> : <Zap className="w-6 h-6" />}
                </div>

                <h3 className="text-xl font-bold text-white mb-1">{lic.product?.name || 'Unknown Product'}</h3>
                <p className="text-[10px] text-gray-500 font-mono mb-6 bg-black px-2 py-1 rounded inline-block">{lic.license_key || 'AWAITING_KEY'}</p>

                {isActive ? (
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm"><span className="text-gray-400">Time Remaining</span><span className="text-white font-bold">{daysLeft} Days</span></div>
                    <div className="w-full h-1.5 bg-black rounded-full overflow-hidden border border-black-border">
                      <div className="h-full bg-gradient-to-r from-gold-dark to-gold-light rounded-full transition-all duration-1000" style={{ width: `${progressPercentage}%` }}></div>
                    </div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest text-right" suppressHydrationWarning>Expires: {new Date(lic.expires_at).toLocaleDateString()}</p>
                    {lic.product?.file_original_name && (
                      <a
                        href={`/api/user/licenses/download?productId=${lic.product.id}`}
                        className="mt-2 w-full h-11 bg-gold/10 border border-gold/30 text-gold rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gold/20 transition-colors"
                      >
                        <Download className="w-4 h-4" /> Download
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-rose-400 font-medium mt-4">Not active.</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
