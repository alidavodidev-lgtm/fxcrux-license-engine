import { useEffect, useState } from "react";

// Used to mount exactly one instance of a component that looks different on
// desktop vs mobile (e.g. NotificationBell) - CSS-only hidden/lg:hidden pairs
// still mount BOTH instances in the DOM, which double-fires anything with a
// side effect (polling, toasts). This gates rendering in JS instead.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    setMatches(mq.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
