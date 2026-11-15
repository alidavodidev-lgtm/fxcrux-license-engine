"use client";

import { useState } from "react";
import Link from "next/link";
import { Layers, Search, Image as ImageIcon, ChevronRight } from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  group: { id: string; name: string } | null;
}

export function AppVersionsProductPickerClient({ products }: { products: Product[] }) {
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = products.filter((p) => p.name?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Layers className="w-8 h-8 text-primary" />
          App Versions
        </h1>
        <p className="text-muted-foreground mt-2 text-sm md:text-base">
          Pick a product to manage its installable app versions and who can access each one.
        </p>
      </div>

      <div className="flex bg-card border border-border/50 p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" placeholder="Search products..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-border/80 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border/50 rounded-2xl p-16 text-center text-muted-foreground">
          No products found.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Link
              key={p.id}
              href={`/app-versions/${p.id}`}
              className="flex items-center gap-3 bg-card border border-border/50 rounded-2xl p-4 shadow-sm hover:border-primary/30 transition-colors"
            >
              {p.image_url ? (
                <img src={p.image_url} alt="" className="w-12 h-12 rounded-lg object-cover border border-border/50 shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0"><ImageIcon className="w-5 h-5 text-muted-foreground/50" /></div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-base truncate">{p.name}</div>
                {p.group && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full mt-1">
                    <Layers className="w-2.5 h-2.5" /> {p.group.name}
                  </span>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
