"use client";

import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

// Generic client-side sort for an already-loaded array - covers every
// "client-array" list page (data passed in as a prop, filtered/rendered in
// JS, no server pagination). `getValue` extracts the comparable value for a
// given sort key from a row, so callers can sort on a derived value
// (e.g. a nested `user.username`) not just a flat property name.
export function useSortableData<T>(
  data: T[],
  getValue: (row: T, key: string) => string | number | Date | null | undefined,
  initialKey: string | null = null,
  initialDir: SortDir = "asc",
) {
  const [sortKey, setSortKey] = useState<string | null>(initialKey);
  const [sortDir, setSortDir] = useState<SortDir>(initialDir);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    const copy = [...data];
    copy.sort((a, b) => {
      const av = getValue(a, sortKey);
      const bv = getValue(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      let cmp: number;
      if (av instanceof Date || bv instanceof Date) {
        cmp = new Date(av as any).getTime() - new Date(bv as any).getTime();
      } else if (typeof av === "number" && typeof bv === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av).localeCompare(String(bv));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [data, sortKey, sortDir, getValue]);

  const requestSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    }
  };

  return { sorted, sortKey, sortDir, requestSort };
}
