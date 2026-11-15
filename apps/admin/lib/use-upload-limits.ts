"use client";

import { useEffect, useState } from "react";

// Fetched once on mount, not re-fetched per keystroke - this is client-side
// UX only (the backend re-checks the live value on every upload regardless),
// so a stale value for the rest of the session is harmless. Falls back to the
// pre-Settings-feature defaults if the fetch fails, so upload dialogs never break.
const DEFAULTS = { productImageMaxKb: 100, ticketAttachmentMaxKb: 250, productFileMaxMb: 50 };

export function useUploadLimits() {
  const [limits, setLimits] = useState(DEFAULTS);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.product_image_max_kb && data?.ticket_attachment_max_kb && data?.product_file_max_mb) {
          setLimits({
            productImageMaxKb: data.product_image_max_kb,
            ticketAttachmentMaxKb: data.ticket_attachment_max_kb,
            productFileMaxMb: data.product_file_max_mb,
          });
        }
      })
      .catch(() => {});
  }, []);

  return limits;
}
