"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ShoppingCart, Zap, Shield, Loader2, Server, Clock, ChevronRight, Tag, X, Copy, CheckCircle2,
  Layers, Plus, Trash2, ArrowLeft, ArrowRight, Wallet as WalletIcon, CreditCard, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/Skeleton";
import { usePolling } from "@/hooks/usePolling";

interface Tier {
  id: string;
  label: string;
  duration_days: number;
  price: number;
  is_active: boolean;
  is_one_time: boolean;
}

interface ProductGroup {
  id: string;
  name: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string | null;
  group?: ProductGroup | null;
  tiers?: Tier[];
}

interface Wallet {
  id: string;
  network: string;
  address: string;
  description: string;
  is_active: boolean;
}

interface CartItem {
  id: string;
  tier: { id: string; label: string; duration_days: number; price: number };
  product: { id: string; name: string; image_url?: string | null };
}

interface MyPurchase {
  status: "PENDING" | "APPROVED" | "REJECTED";
  tier: { id: string } | null;
}

export default function StorePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupFilter, setGroupFilter] = useState("ALL");

  // Own purchase history, used only to flag one-time tiers already claimed by
  // this user so the picker can disable them before a wasted TXID submission
  // (the real enforcement is server-side in submitPurchase/submitCart).
  const [myPurchases, setMyPurchases] = useState<MyPurchase[]>([]);

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [pickingProduct, setPickingProduct] = useState<Product | null>(null);
  const [pickingTier, setPickingTier] = useState<Tier | null>(null);

  // Checkout state
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"method" | "payment">("method");
  const [paymentMethod, setPaymentMethod] = useState<"CRYPTO_MANUAL">("CRYPTO_MANUAL");
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [txid, setTxid] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/store/products", { cache: "no-store" });
      const data = await res.json();

      if (res.ok && Array.isArray(data)) {
        const activeProducts = data.filter((p: any) => p.is_active !== false);
        setProducts(activeProducts);
      } else if (res.ok && data.data && Array.isArray(data.data)) {
        const activeProducts = data.data.filter((p: any) => p.is_active !== false);
        setProducts(activeProducts);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWallets = useCallback(async () => {
    try {
      const res = await fetch("/api/store/wallets", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        const activeWallets = data.filter((w: Wallet) => w.is_active !== false);
        setWallets(activeWallets);
        setSelectedWallet((prev) => prev || activeWallets[0] || null);
      }
    } catch (error) {
      console.error("Failed to load wallets");
    }
  }, []);

  // Server-persisted (not localStorage) so the cart survives a refresh and a
  // logout/login, without leaking into a different user's session on the
  // same browser. Reading it also silently drops any item whose tier/product
  // went inactive or changed price since it was added (see CartService).
  const fetchCart = useCallback(async () => {
    try {
      const res = await fetch("/api/cart", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setCart(data);
    } catch (error) {
      console.error("Failed to load cart");
    }
  }, []);

  const fetchMyPurchases = useCallback(async () => {
    try {
      const res = await fetch("/api/user/billing", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setMyPurchases(data);
    } catch (error) {
      console.error("Failed to load purchase history");
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchWallets();
    fetchCart();
    fetchMyPurchases();
  }, [fetchProducts, fetchWallets, fetchCart, fetchMyPurchases]);
  usePolling(fetchProducts, 30000);
  usePolling(fetchWallets, 30000);
  usePolling(fetchCart, 30000);
  usePolling(fetchMyPurchases, 30000);

  const purchasedOneTimeTierIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of myPurchases) {
      if (p.tier?.id && (p.status === "PENDING" || p.status === "APPROVED")) ids.add(p.tier.id);
    }
    return ids;
  }, [myPurchases]);

  const handleCopyAddress = (address: string) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(address).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => console.error("Clipboard copy failed", err));
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = address;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed', err);
      }
      document.body.removeChild(textArea);
    }
  };

  const availableGroups = useMemo(() => {
    const seen = new Map<string, ProductGroup>();
    for (const p of products) {
      if (p.group) seen.set(p.group.id, p.group);
    }
    return Array.from(seen.values());
  }, [products]);

  const filteredProducts = groupFilter === "ALL" ? products : products.filter((p) => p.group?.id === groupFilter);

  const cartTotal = cart.reduce((sum, item) => sum + Number(item.tier.price), 0);

  const addToCart = async (product: Product, tier: Tier) => {
    try {
      const res = await fetch("/api/cart/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tierId: tier.id }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) {
        setCart(data);
        toast.success(`${product.name} added to cart.`);
      } else {
        toast.error(data.error || "Failed to add to cart");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setPickingProduct(null);
      setPickingTier(null);
    }
  };

  const removeFromCart = async (itemId: string) => {
    const previous = cart;
    setCart((prev) => prev.filter((item) => item.id !== itemId));
    try {
      const res = await fetch("/api/cart/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data)) setCart(data);
      else setCart(previous);
    } catch {
      setCart(previous);
    }
  };

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0 || !selectedWallet || !txid) return;

    setIsSubmitting(true);
    try {
      const payload = {
        items: cart.map((item) => ({ tierId: item.tier.id })),
        walletId: selectedWallet.id,
        txId: txid,
        paymentMethod,
      };
      const res = await fetch("/api/store/checkout-cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setCheckoutSuccess(true);
        setCart([]);
      } else {
        const error = await res.json();
        toast.error("Transaction submission failed.", { description: error.error || "Please try again or contact support." });
      }
    } catch (error) {
      toast.error("Network error.", { description: "Could not reach the server. Please try again." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeCheckout = () => {
    setCheckoutOpen(false);
    setCheckoutStep("method");
    setTxid("");
    setCheckoutSuccess(false);
  };

  const openCheckout = () => {
    if (cart.length === 0) return;
    setCartOpen(false);
    setCheckoutStep("method");
    setCheckoutOpen(true);
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto animate-fade-in-up space-y-10 min-h-screen relative">

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-black-border">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs font-semibold tracking-widest uppercase mb-2">
            <ShoppingCart className="w-3 h-3" />
            Official Marketplace
          </div>
          <h1 className="font-display text-4xl font-black text-white tracking-tight">Software Catalog</h1>
          <p className="text-gray-400 text-sm md:text-base">Browse software products and choose a license for the tools you use.</p>
        </div>

        <button
          onClick={() => setCartOpen(true)}
          className="relative h-12 px-5 bg-black-light border border-black-border rounded-xl text-white font-bold flex items-center gap-2 hover:border-gold/50 transition-colors shrink-0"
        >
          <ShoppingCart className="w-5 h-5 text-gold" /> Cart
          {cart.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-gold text-black text-xs font-bold min-w-[22px] h-[22px] rounded-full flex items-center justify-center">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      {!loading && availableGroups.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setGroupFilter("ALL")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${groupFilter === "ALL" ? "bg-gold text-black" : "bg-black-light border border-black-border text-gray-400 hover:text-white"}`}
          >
            <Layers className="w-3.5 h-3.5" /> All Tools
          </button>
          {availableGroups.map((g) => (
            <button
              key={g.id}
              onClick={() => setGroupFilter(g.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${groupFilter === g.id ? "bg-gold text-black" : "bg-black-light border border-black-border text-gray-400 hover:text-white"}`}
            >
              {g.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-black-light border border-black-border rounded-2xl overflow-hidden">
              <div className="h-32 bg-black-lighter border-b border-black-border p-6 flex items-start justify-between">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <Skeleton className="w-20 h-6 rounded-full" />
              </div>
              <div className="p-6 space-y-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex items-end justify-between pt-4">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-12 w-28 rounded-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-black-light/50 border border-black-border border-dashed p-16 rounded-2xl flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center mb-6 border border-black-border text-gray-600">
            <Server className="w-10 h-10" />
          </div>
          <h3 className="text-2xl font-bold text-white mb-3">No Tools Available Yet</h3>
          <p className="text-gray-400 max-w-md">Check back when the publisher adds a product.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {filteredProducts.map((product, i) => {
            const inCart = cart.find((item) => item.product.id === product.id);
            const activeTiers = product.tiers?.filter(t => t.is_active) || [];
            // A free/trial tier priced at $0 shouldn't make the whole card
            // read "Starting at $0" - show the lowest *paid* price instead,
            // falling back to 0 only if every active tier is genuinely free.
            const paidTiers = activeTiers.filter(t => t.price > 0);
            const displayPrice = paidTiers.length > 0
              ? Math.min(...paidTiers.map(t => t.price))
              : (activeTiers.length > 0 ? Math.min(...activeTiers.map(t => t.price)) : product.price);
            return (
              <div key={product.id} className="glass-panel rounded-2xl flex flex-col overflow-hidden group hover:border-gold/40 transition-all duration-500 hover:-translate-y-1 animate-fade-in-up" style={{ animationDelay: `${0.06 * i}s` }}>

                <div className="h-32 bg-gradient-to-br from-black-lighter to-black relative p-6 flex items-start justify-between border-b border-black-border overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gold/10 via-transparent to-transparent opacity-50"></div>
                  )}
                  {!product.image_url && (
                    <div className="relative z-10 w-12 h-12 rounded-xl bg-black border border-black-border flex items-center justify-center text-gold shadow-[0_0_15px_rgba(212,175,55,0.15)]">
                      <Zap className="w-6 h-6" />
                    </div>
                  )}
                  <div className={`relative z-10 bg-black/50 backdrop-blur-sm border border-black-border px-3 py-1 rounded-full flex items-center gap-1.5 ${product.image_url ? "ml-auto" : ""}`}>
                    <Tag className="w-3.5 h-3.5 text-gold" />
                    <span className="text-xs font-bold text-white tracking-widest uppercase">Premium</span>
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-xl font-bold text-white mb-2 group-hover:text-gold transition-colors">{product.name}</h3>
                  <p className="text-sm text-gray-400 line-clamp-3 mb-6 flex-1 leading-relaxed">
                    {product.description || "No product description is available."}
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-y border-black-border/50">
                      <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                        <Clock className="w-4 h-4 text-gray-500" /> Plans
                      </div>
                      <div className="text-white font-bold">
                        {product.tiers && product.tiers.filter(t => t.is_active).length > 0
                          ? `${product.tiers.filter(t => t.is_active).length} available`
                          : "None yet"}
                      </div>
                    </div>

                    <div className="flex items-end justify-between pt-2">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Starting at</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gold-light to-gold-dark">
                            ${displayPrice}
                          </span>
                          <span className="text-xs text-gray-400 font-bold uppercase">USDT</span>
                        </div>
                      </div>

                      <button
                        disabled={!product.tiers || product.tiers.filter(t => t.is_active).length === 0}
                        onClick={() => { setPickingProduct(product); setPickingTier(inCart ? { ...inCart.tier, is_active: true, is_one_time: false } : null); }}
                        className={`h-12 px-6 font-bold rounded-xl transition-all flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none ${
                          inCart ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400" : "bg-gold text-black hover:shadow-[0_0_20px_rgba(212,175,55,0.4)]"
                        }`}
                      >
                        {inCart ? <><CheckCircle2 className="w-4 h-4" /> In Cart</> : <><Plus className="w-4 h-4" /> Add</>}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Plan picker (per product) */}
      {pickingProduct && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setPickingProduct(null)} />
          <div className="relative w-full sm:w-auto sm:min-w-[420px] bg-black-light border border-black-border rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up sm:animate-fade-in-up flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between p-6 border-b border-black-border">
              <h3 className="text-lg font-bold text-white">{pickingProduct.name}</h3>
              <button onClick={() => setPickingProduct(null)} className="p-2 text-gray-500 hover:text-white bg-black rounded-full border border-black-border transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Select a Plan</label>
              <div className="grid grid-cols-2 gap-3">
                {(pickingProduct.tiers || []).filter(t => t.is_active).map(tier => {
                  const alreadyClaimed = tier.is_one_time && purchasedOneTimeTierIds.has(tier.id);
                  return (
                    <button
                      key={tier.id}
                      disabled={alreadyClaimed}
                      onClick={() => setPickingTier(tier)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        alreadyClaimed
                          ? 'border-black-border bg-black/40 opacity-50 cursor-not-allowed'
                          : pickingTier?.id === tier.id ? 'border-gold bg-gold/10' : 'border-black-border bg-black hover:border-gray-600'
                      }`}
                    >
                      <div className={`text-sm font-bold ${pickingTier?.id === tier.id && !alreadyClaimed ? 'text-gold' : 'text-white'}`}>{tier.label}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {alreadyClaimed ? 'Already Purchased' : `$${tier.price} USDT`}
                      </div>
                    </button>
                  );
                })}
              </div>
              <button
                disabled={!pickingTier}
                onClick={() => pickingTier && addToCart(pickingProduct, pickingTier)}
                className="w-full h-12 bg-gold text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center sm:justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="relative w-full sm:w-[420px] sm:h-screen bg-black-light border-l border-black-border shadow-2xl flex flex-col max-h-[85vh] sm:max-h-none rounded-t-3xl sm:rounded-none animate-slide-up sm:animate-fade-in-up">
            <div className="flex items-center justify-between p-6 border-b border-black-border">
              <h3 className="text-xl font-bold text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-gold" /> Your Cart</h3>
              <button onClick={() => setCartOpen(false)} className="p-2 text-gray-500 hover:text-white bg-black rounded-full border border-black-border transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-16">
                  <ShoppingCart className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Your cart is empty.</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.id} className="bg-black p-4 rounded-xl border border-black-border flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white font-bold truncate">{item.product.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.tier.label}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-gold font-bold">${item.tier.price}</span>
                      <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-gray-500 hover:text-rose-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-6 border-t border-black-border space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400 font-semibold uppercase tracking-widest">Total</span>
                  <span className="text-2xl font-black text-gold">${cartTotal.toFixed(2)} <span className="text-xs text-gray-400 font-bold uppercase">USDT</span></span>
                </div>
                <button onClick={openCheckout} className="w-full h-12 bg-gold text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2">
                  Proceed to Checkout <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout Modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeCheckout} />

          <div className="relative w-full sm:w-auto sm:min-w-[480px] bg-black-light border border-black-border rounded-t-3xl sm:rounded-3xl shadow-2xl animate-slide-up sm:animate-fade-in-up flex flex-col max-h-[90vh] sm:max-h-[85vh]">

            <div className="flex items-center justify-between p-6 border-b border-black-border">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-gold" /> Secure Checkout
              </h3>
              <button onClick={closeCheckout} className="p-2 text-gray-500 hover:text-white bg-black rounded-full border border-black-border transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar">
              {checkoutSuccess ? (
                <div className="flex flex-col items-center justify-center text-center py-8">
                  <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20">
                    <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                  </div>
                  <h4 className="text-2xl font-bold text-white mb-2">Transaction Submitted</h4>
                  <p className="text-gray-400 mb-8 max-w-sm">Your TXID has been received. Our administrators will verify the payment and issue your license{cart.length > 1 ? "s" : ""} shortly.</p>
                  <button onClick={closeCheckout} className="w-full h-12 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors">
                    Return to Store
                  </button>
                </div>
              ) : checkoutStep === "method" ? (
                <div className="space-y-6">
                  <div className="bg-black p-4 rounded-2xl border border-black-border space-y-2">
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Order Summary</p>
                    {cart.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-gray-300">{item.product.name} <span className="text-gray-600">({item.tier.label})</span></span>
                        <span className="text-white font-semibold">${item.tier.price}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t border-black-border">
                      <span className="text-gray-400 font-bold">Total</span>
                      <span className="text-gold font-black">${cartTotal.toFixed(2)} USDT</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">1. Choose Payment Method</label>
                    <button
                      onClick={() => setPaymentMethod("CRYPTO_MANUAL")}
                      className={`w-full p-4 rounded-xl border text-left transition-all flex items-center gap-3 ${paymentMethod === "CRYPTO_MANUAL" ? "border-gold bg-gold/10" : "border-black-border bg-black"}`}
                    >
                      <WalletIcon className="w-5 h-5 text-gold shrink-0" />
                      <div>
                        <div className="text-sm font-bold text-white">Crypto (Manual Verification)</div>
                        <div className="text-xs text-gray-500">Pay via USDT, we verify your TXID and activate your license.</div>
                      </div>
                    </button>
                    <div className="w-full p-4 rounded-xl border border-black-border/50 bg-black/40 flex items-center gap-3 opacity-50 cursor-not-allowed">
                      <CreditCard className="w-5 h-5 text-gray-600 shrink-0" />
                      <div className="flex-1">
                        <div className="text-sm font-bold text-gray-500">PayPal / Visa / Mastercard</div>
                        <div className="text-xs text-gray-600">Coming soon</div>
                      </div>
                      <Lock className="w-4 h-4 text-gray-600" />
                    </div>
                  </div>

                  <button
                    onClick={() => setCheckoutStep("payment")}
                    className="w-full h-12 bg-gold text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2"
                  >
                    Continue <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <button onClick={() => setCheckoutStep("method")} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>

                  <div className="bg-black p-4 rounded-2xl border border-black-border flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-1">Total Due</p>
                      <p className="text-white font-bold">{cart.length} item{cart.length > 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-black text-gold">${cartTotal.toFixed(2)} <span className="text-xs font-bold text-gray-400">USDT</span></p>
                    </div>
                  </div>

                  {wallets.length > 0 ? (
                    <div className="space-y-4">
                      <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">2. Select Network</label>
                      <div className="grid grid-cols-2 gap-3">
                        {wallets.map(w => (
                          <button
                            key={w.id}
                            onClick={() => setSelectedWallet(w)}
                            className={`p-3 rounded-xl border text-sm font-bold transition-all ${selectedWallet?.id === w.id ? 'border-gold bg-gold/10 text-gold' : 'border-black-border bg-black text-gray-400 hover:border-gray-600'}`}
                          >
                            {w.network}
                          </button>
                        ))}
                      </div>

                      {selectedWallet && (
                        <div className="bg-black p-5 rounded-2xl border border-black-border space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Deposit Address</span>
                            {selectedWallet.description && <span className="text-xs text-gold bg-gold/10 px-2 py-0.5 rounded border border-gold/20">{selectedWallet.description}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 bg-black-light border border-black-border p-3 rounded-lg text-sm text-gray-300 break-all font-mono">
                              {selectedWallet.address}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopyAddress(selectedWallet.address)}
                              className="p-3 bg-black border border-black-border rounded-lg text-gray-400 hover:text-white hover:border-gray-600 transition-all"
                            >
                              {copied ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                            </button>
                          </div>
                          <p className="text-xs text-rose-500 font-medium">⚠️ Please ensure you send exactly ${cartTotal.toFixed(2)} USDT via the {selectedWallet.network} network.</p>
                        </div>
                      )}

                      <form onSubmit={handleCheckoutSubmit} className="space-y-4 pt-4 border-t border-black-border">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">3. Submit Transaction Hash (TXID)</label>
                          <input
                            type="text"
                            required
                            placeholder="Enter the 64-character hash..."
                            value={txid}
                            onChange={(e) => setTxid(e.target.value)}
                            className="w-full h-12 px-4 rounded-xl border border-black-border bg-black text-white placeholder:text-gray-600 focus:outline-none focus:border-gold/50 font-mono text-sm transition-all"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={!txid || isSubmitting || !selectedWallet}
                          className="w-full h-12 bg-gradient-to-r from-gold-dark via-gold to-gold-light text-black font-bold rounded-xl hover:shadow-[0_0_20px_rgba(212,175,55,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Payment'}
                        </button>
                      </form>
                    </div>
                  ) : (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-sm font-medium text-center">
                      No payment networks are currently available. Please contact support.
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
