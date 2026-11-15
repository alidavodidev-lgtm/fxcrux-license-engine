"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search, CheckCircle, XCircle, Clock, RefreshCw, CreditCard, Copy, Check, Loader2, Box, ShieldCheck
} from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePolling } from "@/hooks/usePolling";
import { useSortableData } from "@/hooks/useSortableData";
import { SortableTh } from "@/components/ui/sortable-th";

export function PurchasesClient({ initialPurchases }: { initialPurchases: any[] }) {
  const router = useRouter();
  usePolling(() => router.refresh(), 15000);
  const [searchTerm, setSearchTerm] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmApproveId, setConfirmApproveId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleCopyTxid = (txid: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(txid);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = txid;
      textArea.style.position = "absolute";
      textArea.style.left = "-999999px";
      document.body.prepend(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (error) {
        console.error("Copy failed", error);
      } finally {
        textArea.remove();
      }
    }
    setCopiedId(txid);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleApprove = async (purchaseId: string) => {
    setProcessingId(purchaseId);
    try {
      const res = await fetch("/api/purchases/approve", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseId }),
      });
      if (res.ok) handleRefresh();
    } finally { setProcessingId(null); }
  };

  const handleReject = async () => {
    if (!rejectingId) return;
    const purchaseId = rejectingId;
    setProcessingId(purchaseId);
    setRejectingId(null);
    try {
      const res = await fetch("/api/purchases/reject", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purchaseId, reason: rejectReason.trim() || undefined }),
      });
      if (res.ok) handleRefresh();
    } finally {
      setProcessingId(null);
      setRejectReason("");
    }
  };

  const filteredPurchases = initialPurchases.filter((purchase) => {
    const q = searchTerm.toLowerCase();
    return (
      (purchase.tx_id && purchase.tx_id.toLowerCase().includes(q)) ||
      (purchase.user?.username && purchase.user.username.toLowerCase().includes(q)) ||
      (purchase.items || []).some((item: any) => item.product?.name?.toLowerCase().includes(q))
    );
  });

  const { sorted: sortedPurchases, sortKey, sortDir, requestSort } = useSortableData(
    filteredPurchases,
    (purchase, key) => {
      if (key === "user") return purchase.user?.username || "";
      if (key === "total_amount") return Number(purchase.total_amount) || 0;
      if (key === "created_at") return new Date(purchase.created_at);
      return purchase[key];
    },
  );

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <CreditCard className="w-8 h-8 text-primary" />
            Payments
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            Check each payment's transaction hash, then approve or reject it.
          </p>
        </div>

        <button onClick={handleRefresh} className="bg-card border border-border/50 text-foreground px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-muted transition-all flex items-center gap-2 shadow-sm">
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh Data
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-card border border-border/50 p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" placeholder="Search by TXID or Username..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/80 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block bg-card border border-border/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-muted/30 text-muted-foreground border-b border-border/50">
              <tr>
                <SortableTh label="Customer" sortKey="user" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                <th className="px-6 py-4 font-medium">Items</th>
                <th className="px-6 py-4 font-medium">TXID (Hash)</th>
                <SortableTh label="Total" sortKey="total_amount" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                <SortableTh label="Date" sortKey="created_at" activeSortKey={sortKey} sortDir={sortDir} onSort={requestSort} />
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedPurchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <ShieldCheck className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">No pending transactions</p>
                  </td>
                </tr>
              ) : (
                sortedPurchases.map((purchase: any) => (
                  <tr key={purchase.id} className="hover:bg-muted/10 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-foreground">{purchase.user?.username || 'Unknown'}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{purchase.user?.email}</div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {(purchase.items || []).map((item: any) => (
                          <div key={item.id} className="flex items-center gap-2">
                            <Box className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium text-foreground">{item.product?.name || 'Unknown'}</span>
                            <span className="text-xs text-muted-foreground">${item.amount}</span>
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-start gap-2 max-w-sm">
                        <span className="font-mono text-xs bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-border/50 text-slate-300 break-all whitespace-normal">
                          {purchase.tx_id ? purchase.tx_id : 'N/A'}
                        </span>
                        {purchase.tx_id && (
                          <button onClick={() => handleCopyTxid(purchase.tx_id)} className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground flex-shrink-0" title="Copy full TXID">
                            {copiedId === purchase.tx_id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-4 font-bold text-emerald-500">${purchase.total_amount}</td>

                    <td className="px-6 py-4 text-muted-foreground">
                      <div className="flex items-center gap-1.5" suppressHydrationWarning>
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(purchase.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      {processingId === purchase.id ? (
                        <Loader2 className="w-5 h-5 animate-spin text-primary inline-block mr-2" />
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setRejectingId(purchase.id); setRejectReason(""); }} className="bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-500/20 px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2">
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                          <button onClick={() => setConfirmApproveId(purchase.id)} className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white border border-emerald-500/20 px-3 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" /> Approve
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile/tablet card list */}
      <div className="md:hidden space-y-3">
        {sortedPurchases.length === 0 ? (
          <div className="bg-card border border-border/50 rounded-2xl p-10 text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">No pending transactions</p>
          </div>
        ) : (
          sortedPurchases.map((purchase: any) => (
            <div key={purchase.id} className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">{purchase.user?.username || 'Unknown'}</div>
                  <div className="space-y-0.5 mt-0.5">
                    {(purchase.items || []).map((item: any) => (
                      <div key={item.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Box className="w-3 h-3 shrink-0" /><span className="truncate">{item.product?.name || 'Unknown'}</span>
                        <span className="shrink-0">${item.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs font-bold text-emerald-500">${purchase.total_amount}</div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1" suppressHydrationWarning>
                    <Clock className="w-3.5 h-3.5" />
                    {new Date(purchase.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 border-t border-border/50 pt-2.5 mb-3">
                <span className="font-mono text-xs bg-slate-900/50 px-2.5 py-1.5 rounded-lg border border-border/50 text-slate-300 truncate flex-1">
                  {purchase.tx_id || 'N/A'}
                </span>
                {purchase.tx_id && (
                  <button onClick={() => handleCopyTxid(purchase.tx_id)} className="p-1.5 hover:bg-muted rounded-md transition-colors text-muted-foreground shrink-0">
                    {copiedId === purchase.tx_id ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                )}
              </div>

              {processingId === purchase.id ? (
                <div className="flex justify-center py-1"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : (
                <div className="flex items-center gap-2 border-t border-border/50 pt-3">
                  <button onClick={() => { setRejectingId(purchase.id); setRejectReason(""); }} className="flex-1 bg-rose-500/10 text-rose-500 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button onClick={() => setConfirmApproveId(purchase.id)} className="flex-1 bg-emerald-500/10 text-emerald-500 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" /> Approve
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <ConfirmDialog
        open={!!confirmApproveId}
        onOpenChange={(open) => !open && setConfirmApproveId(null)}
        title="Approve Transaction"
        description="This will automatically issue a license for each item in this order."
        confirmLabel="Approve"
        destructive={false}
        onConfirm={() => confirmApproveId && handleApprove(confirmApproveId)}
      />

      <Dialog open={!!rejectingId} onOpenChange={(open) => !open && setRejectingId(null)}>
        <DialogContent className="sm:max-w-[440px] border-border bg-card shadow-2xl rounded-2xl">
          <DialogHeader className="pb-4 border-b border-border/50">
            <DialogTitle>Reject Transaction</DialogTitle>
            <DialogDescription>
              Explain the reason so the customer can correct the details and resubmit.
            </DialogDescription>
          </DialogHeader>
          <textarea
            className="w-full min-h-[100px] px-4 py-3 rounded-xl border border-border/80 bg-slate-900 text-slate-50 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none text-sm"
            placeholder="e.g. Wrong network, amount doesn't match, TXID not found on-chain... (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter className="pt-4 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={() => setRejectingId(null)}>Cancel</Button>
            <Button type="button" variant="destructive" onClick={handleReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
