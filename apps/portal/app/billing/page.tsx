"use client";
import { useState, useEffect, useCallback } from "react";
import { Wallet, Clock3, CheckCircle2, XCircle, Server } from "lucide-react";
import { Skeleton } from "@/components/Skeleton";
import { usePolling } from "@/hooks/usePolling";

export default function BillingPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPurchases = useCallback(() => {
    fetch("/api/user/billing").then(r => r.json()).then(data => {
      setPurchases(Array.isArray(data) ? data : []); setLoading(false);
    });
  }, []);

  useEffect(() => { loadPurchases(); }, [loadPurchases]);
  usePolling(loadPurchases, 20000);

  const getStatusUI = (status: string) => {
    const s = status?.toLowerCase() || 'pending';
    switch(s) {
      case 'approved': return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-500', label: 'Completed', icon: CheckCircle2 };
      case 'rejected': return { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-500', label: 'Rejected', icon: XCircle };
      default: return { bg: 'bg-orange-500/10', border: 'border-orange-500/20', text: 'text-orange-500', label: 'Pending', icon: Clock3 };
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-8 min-h-screen">
        <div className="flex items-center gap-4 pb-6 border-b border-black-border">
          <Skeleton className="w-14 h-14 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-64 max-w-full" />
          </div>
        </div>
        <div className="bg-black-light border border-black-border rounded-2xl overflow-hidden">
          <div className="divide-y divide-black-border">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="p-5 flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-20 hidden sm:block" />
                <Skeleton className="h-6 w-20 flex-shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto animate-fade-in-up space-y-8 min-h-screen">
      <div className="flex items-center gap-4 pb-6 border-b border-black-border">
        <div className="w-14 h-14 bg-gold/10 border border-gold/20 rounded-2xl flex items-center justify-center text-gold"><Wallet className="w-7 h-7" /></div>
        <div><h1 className="font-display text-3xl font-black text-white tracking-tight">Billing</h1><p className="text-sm text-gray-400">Your payment history.</p></div>
      </div>

      {purchases.length === 0 ? (
         <div className="bg-black-light/50 border border-black-border border-dashed p-16 rounded-2xl flex flex-col items-center justify-center text-center">
         <Server className="w-12 h-12 text-gray-600 mb-4" />
         <h3 className="text-xl font-bold text-white mb-2">No Payments Yet</h3>
         <p className="text-gray-400">You haven't bought anything yet.</p>
       </div>
      ) : (
        <div className="bg-black-light border border-black-border rounded-2xl overflow-hidden animate-fade-in-up">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-black border-b border-black-border">
                  <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Transaction / Date</th>
                  <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Tool</th>
                  <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-widest">Amount</th>
                  <th className="p-5 text-xs font-bold text-gray-500 uppercase tracking-widest text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black-border">
                {purchases.map(p => {
                  const statusUI = getStatusUI(p.status);
                  const Icon = statusUI.icon;
                  return (
                    <tr key={p.id} className="hover:bg-black/50 transition-colors group">
                      <td className="p-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl ${statusUI.bg} flex items-center justify-center ${statusUI.text} border ${statusUI.border}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-mono text-gray-300">{p.tx_id ? p.tx_id.substring(0,12)+'...' : 'No TXID'}</p>
                            <p className="text-[10px] text-gray-500 uppercase mt-1" suppressHydrationWarning>{new Date(p.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-5 text-sm font-bold text-white">{p.product?.name || 'Unknown Product'}</td>
                      <td className="p-5 text-sm font-black text-gold">${p.product?.price || 0}</td>
                      <td className="p-5 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 ${statusUI.bg} ${statusUI.text} border ${statusUI.border} rounded-lg text-[10px] font-bold uppercase tracking-wider`}>
                          {statusUI.label}
                        </span>
                        {p.status?.toLowerCase() === 'rejected' && p.rejection_reason && (
                          <p className="text-[11px] text-rose-400/80 mt-2 max-w-[220px] ml-auto leading-relaxed">{p.rejection_reason}</p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
