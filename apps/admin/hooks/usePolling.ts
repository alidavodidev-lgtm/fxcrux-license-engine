import { useEffect, useRef } from "react";

// Refetches on an interval so pages stay live without a manual refresh.
// Paused while the tab is hidden/backgrounded to avoid wasted requests.
export function usePolling(fn: () => void, intervalMs: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fnRef.current();
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
