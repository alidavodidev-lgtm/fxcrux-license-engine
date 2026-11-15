"use client";

import { useEffect, useState } from "react";

// Fetched once on mount, not re-fetched per keystroke - this is client-side
// UX only (the backend re-checks the live value on every upload regardless),
// so a stale value for the rest of the session is harmless. Falls back to the
// pre-Settings-feature default if the fetch fails, so the ticket form never breaks.
const DEFAULT_TICKET_ATTACHMENT_MAX_KB = 250;

export function useUploadLimits() {
  const [ticketAttachmentMaxKb, setTicketAttachmentMaxKb] = useState(DEFAULT_TICKET_ATTACHMENT_MAX_KB);

  useEffect(() => {
    fetch("/api/settings/limits")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.ticketAttachmentMaxBytes) {
          setTicketAttachmentMaxKb(Math.floor(data.ticketAttachmentMaxBytes / 1024));
        }
      })
      .catch(() => {});
  }, []);

  return { ticketAttachmentMaxKb };
}
