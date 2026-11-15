let audioCtx: AudioContext | null = null;

// Synthesized rather than an audio file - no binary asset to ship, no extra
// network request, and it's easy to keep genuinely subtle (short, quiet,
// two-tone). Browsers may block audio before any user gesture has happened
// on the page; by the time a notification can fire the user is already
// logged in and has clicked something, so this reliably works in practice.
export function playNotificationSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const ctx = audioCtx;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    // A missed chime isn't worth surfacing an error for.
  }
}
