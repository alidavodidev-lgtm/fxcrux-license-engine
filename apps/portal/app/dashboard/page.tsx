"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Key, ShieldCheck, Clock, Activity, ChevronRight, AlertTriangle, CheckCircle2, ShoppingCart } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import { usePolling } from "@/hooks/usePolling";

export default function DashboardPage() {
  const [licenses, setLicenses] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [licRes, userRes] = await Promise.all([
        fetch("/api/user/licenses"),
        fetch("/api/user/profile")
      ]);

      const licData = await licRes.json();
      const userData = await userRes.json();

      setLicenses(Array.isArray(licData) ? licData : []);
      setUser(!userData.error ? userData : null);
    } catch (error) {
      console.error("Dashboard data fetch error", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);
  usePolling(fetchDashboardData, 20000);

  const calculateDaysLeft = (expiresAt: string) => {
    if (!expiresAt) return 0;
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 3600 * 24)));
  };

  const activeLicenses = licenses.filter(lic => lic.status === 'active' && calculateDaysLeft(lic.expires_at) > 0);
  const activeCount = activeLicenses.length;
  const expiringSoon = activeLicenses.filter(lic => calculateDaysLeft(lic.expires_at) <= 14);
  const isHardwareBound = Boolean(user?.machine_id);

  type Alert = { key: string; tone: 'success' | 'warning' | 'info'; title: string; message: string };
  const alerts: Alert[] = [];
  if (!isHardwareBound) {
    alerts.push({ key: 'hw', tone: 'warning', title: 'Hardware Not Bound', message: 'Activate a license from your product to bind this account to a device.' });
  } else {
    alerts.push({ key: 'hw', tone: 'success', title: 'Hardware Locked', message: 'This account is linked to your computer.' });
  }
  for (const lic of expiringSoon.slice(0, 3)) {
    const days = calculateDaysLeft(lic.expires_at);
    alerts.push({
      key: `exp-${lic.id}`,
      tone: 'warning',
      title: `${lic.product?.name || 'A license'} expires soon`,
      message: `${days} day${days === 1 ? '' : 's'} left — renew from the store to avoid interruption.`,
    });
  }
  if (activeCount === 0) {
    alerts.push({ key: 'no-tools', tone: 'info', title: 'No Active Tools', message: 'Browse the catalog to find your first product.' });
  } else if (expiringSoon.length === 0) {
    alerts.push({ key: 'ok', tone: 'success', title: 'All Licenses Current', message: 'Nothing expiring in the next 14 days.' });
  }

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-black-border">
          <div className="space-y-3">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <Skeleton className="h-14 w-52" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-black-light border border-black-border p-6 rounded-2xl space-y-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-3 w-36" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="grid gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-black-light border border-black-border rounded-xl p-5 flex items-center gap-4">
                  <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-16 flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="bg-black-light border border-black-border rounded-2xl p-5 space-y-4">
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-4 pb-4 last:pb-0 border-b last:border-0 border-black-border">
                  <Skeleton className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto animate-fade-in-up space-y-10">

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-black-border">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs font-semibold tracking-widest uppercase mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
            Live Session
          </div>
          <h1 className="font-display text-4xl font-black text-white tracking-tight">Command Center</h1>
          <p className="text-gray-400 text-sm md:text-base">Your licenses, connection status, and account, all in one place.</p>
        </div>
        <div className="flex items-center gap-3 bg-black-light border border-black-border px-5 py-3 rounded-xl">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Security Status</span>
            <span className="text-sm font-bold text-white">Encrypted & Secured</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        <div className="bg-black-light border border-black-border p-6 rounded-2xl relative overflow-hidden group hover:border-gold/30 hover:-translate-y-0.5 transition-all animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
          <div className="absolute -top-4 -right-4 p-8 bg-gradient-to-bl from-gold/10 to-transparent rounded-full opacity-50 group-hover:opacity-100 transition-opacity">
            <Key className="w-10 h-10 text-gold/50" />
          </div>
          <p className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-2">Active Licenses</p>
          <p className="text-4xl font-black text-white">{activeCount}</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-gold">
            <Activity className="w-4 h-4" />
            {activeCount > 0 ? 'Ready to use' : 'No purchase yet'}
          </div>
        </div>

        <Link href="/licenses" className="bg-black-light border border-black-border p-6 rounded-2xl relative overflow-hidden group hover:border-gold/30 hover:-translate-y-0.5 transition-all animate-fade-in-up block" style={{ animationDelay: '0.12s' }}>
          <div className="absolute -top-4 -right-4 p-8 bg-gradient-to-bl from-gold/10 to-transparent rounded-full opacity-50 group-hover:opacity-100 transition-opacity">
            <AlertTriangle className="w-10 h-10 text-gold/50" />
          </div>
          <p className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-2">Expiring Soon</p>
          <p className="text-4xl font-black text-white">{expiringSoon.length}</p>
          <div className={`mt-4 flex items-center gap-2 text-xs ${expiringSoon.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
            <Clock className="w-4 h-4" /> {expiringSoon.length > 0 ? 'Within 14 days' : 'Nothing due soon'}
          </div>
        </Link>

        <div className="bg-black-light border border-black-border p-6 rounded-2xl relative overflow-hidden group hover:border-gold/30 hover:-translate-y-0.5 transition-all animate-fade-in-up" style={{ animationDelay: '0.19s' }}>
          <div className="absolute -top-4 -right-4 p-8 bg-gradient-to-bl from-gold/10 to-transparent rounded-full opacity-50 group-hover:opacity-100 transition-opacity">
            <Clock className="w-10 h-10 text-gold/50" />
          </div>
          <p className="text-gray-400 text-xs font-bold tracking-widest uppercase mb-2">Signed In As</p>
          <p className="text-lg font-medium text-white mt-2 truncate">{user?.username || 'Authenticated'}</p>
          <div className="mt-4 flex items-center gap-2 text-xs text-gray-500" suppressHydrationWarning>
            Joined: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Recently'}
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-xl font-bold text-white">Your Tools</h2>
            <Link href="/licenses" className="text-sm text-gold hover:text-gold-light transition-colors flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {activeCount === 0 ? (
            <div className="bg-black-light/50 border border-black-border border-dashed p-10 rounded-2xl flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-black-border flex items-center justify-center mb-4 text-gray-500">
                <Key className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">No Licenses Yet</h3>
              <p className="text-gray-400 text-sm max-w-sm mb-6">Browse available software and product releases.</p>
              <Link href="/store" className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2">
                Go to Store
              </Link>
            </div>
          ) : (
            <div className="grid gap-4">
              {activeLicenses.slice(0, 3).map((lic, i) => (
                <div key={lic.id} className="bg-black-light border border-black-border rounded-xl p-5 flex items-center justify-between group hover:border-gold/30 transition-colors animate-fade-in-up" style={{ animationDelay: `${0.05 * i}s` }}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-black border border-black-border rounded-lg flex items-center justify-center text-gold">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold text-sm md:text-base">{lic.product?.name || 'Pro Instrument'}</h3>
                      <p className="text-xs text-gray-500 font-mono mt-1">{lic.license_key}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 text-emerald-500 rounded text-xs font-bold uppercase">
                      Active
                    </span>
                    <p className="text-[10px] text-gray-400 mt-2">{calculateDaysLeft(lic.expires_at)} Days Left</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="font-display text-xl font-bold text-white mb-2">Alerts</h2>

          <div className="bg-black-light border border-black-border rounded-2xl p-5 space-y-4">
            {alerts.map((alert, i) => {
              const dotClass = alert.tone === 'success' ? 'bg-emerald-500' : alert.tone === 'warning' ? 'bg-amber-500' : 'bg-gold';
              const Icon = alert.tone === 'success' ? CheckCircle2 : alert.tone === 'warning' ? AlertTriangle : ShoppingCart;
              return (
                <div key={alert.key} className={`flex gap-4 ${i < alerts.length - 1 ? 'pb-4 border-b border-black-border' : ''}`}>
                  <div className="mt-1">
                    <span className={`flex w-2 h-2 rounded-full ${dotClass} ${alert.tone !== 'info' ? 'animate-pulse' : ''}`}></span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" /> {alert.title}</p>
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{alert.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
