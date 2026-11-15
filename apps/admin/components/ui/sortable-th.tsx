"use client";

import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { SortDir } from "@/hooks/useSortableData";

// Drop-in replacement for a plain `<th className="px-6 py-4 font-medium">` -
// same cell padding/typography, just wrapped in a clickable button with a
// direction indicator. Works for both client-side sort (useSortableData) and
// server-side sort (a component that re-fetches with sortBy/sortDir params) -
// the caller owns what "onSort" actually does.
export function SortableTh({
  label,
  sortKey,
  activeSortKey,
  sortDir,
  onSort,
  className = "",
  align = "left",
}: {
  label: string;
  sortKey: string;
  activeSortKey: string | null;
  sortDir: SortDir;
  onSort: (key: string) => void;
  className?: string;
  align?: "left" | "right";
}) {
  const isActive = activeSortKey === sortKey;
  return (
    <th className={`px-6 py-4 font-medium ${className}`}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${align === "right" ? "flex-row-reverse" : ""} ${isActive ? "text-foreground" : ""}`}
      >
        {label}
        {isActive ? (
          sortDir === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
        )}
      </button>
    </th>
  );
}
