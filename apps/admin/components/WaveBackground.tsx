"use client";

import { useEffect, useRef } from "react";

// A few slow-moving sine-wave lines in the brand gold, meant to read as a faint
// signal/chart trace behind the login card rather than decoration for its own sake.
export function WaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const lines = [
      { amplitude: 26, wavelength: 340, speed: 0.00016, yRatio: 0.32, opacity: 0.16 },
      { amplitude: 34, wavelength: 420, speed: 0.00011, yRatio: 0.55, opacity: 0.11 },
      { amplitude: 20, wavelength: 260, speed: 0.00021, yRatio: 0.78, opacity: 0.08 },
    ];

    let raf = 0;
    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      for (const line of lines) {
        ctx.beginPath();
        const phase = reduceMotion ? 0 : t * line.speed;
        for (let x = 0; x <= width; x += 6) {
          const y = line.yRatio * height + Math.sin(x / line.wavelength + phase) * line.amplitude;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(212, 175, 55, ${line.opacity})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      if (!reduceMotion) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true" />;
}
