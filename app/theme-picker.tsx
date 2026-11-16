"use client";

import { useEffect, useRef, useState } from "react";

const ACCENTS = [
  { id: "graphite", label: "Graphit", color: "#52525b" },
  { id: "blue", label: "Blau", color: "#2563eb" },
  { id: "green", label: "Grün", color: "#16a34a" },
  { id: "violet", label: "Violett", color: "#7c3aed" },
  { id: "orange", label: "Orange", color: "#ea580c" },
  { id: "pink", label: "Pink", color: "#db2777" },
  { id: "cyan", label: "Cyan", color: "#0891b2" },
] as const;

type ModeSetting = "system" | "light" | "dark";
type Theme = { accent: string; mode: ModeSetting };

function readTheme(): Theme {
  try {
    const t = JSON.parse(localStorage.getItem("wc-theme") || "{}");
    return { accent: t.accent || "graphite", mode: t.mode || "system" };
  } catch {
    return { accent: "graphite", mode: "system" };
  }
}

function applyTheme(t: Theme) {
  const d = document.documentElement;
  d.dataset.accent = t.accent;
  if (t.mode === "system") delete d.dataset.theme;
  else d.dataset.theme = t.mode;
  try {
    localStorage.setItem("wc-theme", JSON.stringify(t));
  } catch {}
}

export default function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>({ accent: "graphite", mode: "system" });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setTheme(readTheme()), []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const update = (patch: Partial<Theme>) => {
    const next = { ...theme, ...patch };
    setTheme(next);
    applyTheme(next);
  };

  return (
    <div ref={ref}>
      <button
        className="btn btn-ghost btn-icon"
        aria-label="Farbe wählen"
        title="Farbe wählen"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="13.5" cy="6.5" r="1.2" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r="1.2" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r="1.2" fill="currentColor" />
          <circle cx="6.5" cy="12.5" r="1.2" fill="currentColor" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16c3.1 0 5.6-2.5 5.6-5.6C21.6 6 17.3 2 12 2z" />
        </svg>
      </button>
      {open && (
        <div className="popover">
          <div className="field">
            <span>Farbe</span>
            <div className="swatches">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  className="swatch"
                  style={{ background: a.color }}
                  title={a.label}
                  aria-label={a.label}
                  aria-pressed={theme.accent === a.id}
                  onClick={() => update({ accent: a.id })}
                />
              ))}
            </div>
          </div>
          <div className="field">
            <span>Darstellung</span>
            <div className="seg" role="group" aria-label="Darstellung">
              {(["system", "light", "dark"] as const).map((m) => (
                <button key={m} aria-pressed={theme.mode === m} onClick={() => update({ mode: m })}>
                  {m === "system" ? "Auto" : m === "light" ? "Hell" : "Dunkel"}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
