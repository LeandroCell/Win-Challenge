"use client";

import { useEffect, useRef, useState } from "react";

type OverlayGame = {
  id: string;
  name: string;
  mode: "total" | "streak";
  target: number;
  progress: number;
  losses: number;
  done: boolean;
};

type OverlayData = {
  title: string;
  elapsedMs: number;
  timerStartedAt: number | null;
  completedAt: number | null;
  games: OverlayGame[];
  serverNow: number;
};

const ACCENTS: Record<string, string> = {
  graphite: "#e4e4e7",
  blue: "#3b82f6",
  green: "#22c55e",
  violet: "#8b5cf6",
  orange: "#f97316",
  pink: "#ec4899",
  cyan: "#06b6d4",
};

const POLL_MS = 2000;

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function Overlay({
  id,
  overlayKey,
  view,
  accent,
  rows,
}: {
  id: string;
  overlayKey: string;
  view: "full" | "compact";
  accent: string;
  rows: number;
}) {
  const [data, setData] = useState<OverlayData | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState<Record<string, number>>({});
  const [, tick] = useState(0);
  const offset = useRef(0);
  const prev = useRef<Map<string, number>>(new Map());

  // OBS: Hintergrund komplett durchsichtig
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, []);

  useEffect(() => {
    let stop = false;
    async function load() {
      try {
        const res = await fetch(`/api/overlay/${id}?key=${encodeURIComponent(overlayKey)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (stop) return;
        if (!res.ok) {
          setError(json.error || `Fehler ${res.status}`);
          return;
        }
        offset.current = json.serverNow - Date.now();
        // Spiele markieren, die gerade einen Sieg bekommen haben
        const changed: Record<string, number> = {};
        for (const g of json.games as OverlayGame[]) {
          const before = prev.current.get(g.id);
          if (before !== undefined && g.progress > before) changed[g.id] = Date.now();
          prev.current.set(g.id, g.progress);
        }
        if (Object.keys(changed).length) setFlash((f) => ({ ...f, ...changed }));
        setData(json);
        setError("");
      } catch {
        if (!stop) setError("Keine Verbindung");
      }
    }
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [id, overlayKey]);

  const running = data?.timerStartedAt != null;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => tick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, [running]);

  const style = { "--ov-accent": ACCENTS[accent] ?? ACCENTS.blue } as React.CSSProperties;

  if (error && !data) {
    return (
      <div className="ov-root" style={style}>
        <div className="ov-panel ov-error">{error}</div>
      </div>
    );
  }
  if (!data) return <div className="ov-root" style={style} />;

  const now = Date.now() + offset.current;
  const elapsed = data.elapsedMs + (running ? Math.max(0, now - data.timerStartedAt!) : 0);
  const total = data.games.length;
  const done = data.games.filter((g) => g.done).length;
  const pct = total ? (done / total) * 100 : 0;
  const finished = data.completedAt !== null;
  const current = data.games.find((g) => !g.done);

  if (view === "compact") {
    return (
      <div className="ov-root" style={style}>
        <div className={`ov-panel ov-compact${finished ? " ov-finished" : ""}`}>
          <div className="ov-compact-main">
            <div className="ov-compact-top">
              <span className="ov-title">{data.title}</span>
              <span className="ov-count">
                {done}/{total}
              </span>
            </div>
            <div className="ov-bar">
              <div style={{ width: `${pct}%` }} />
            </div>
            <div className="ov-compact-sub">
              {finished ? (
                "Challenge geschafft!"
              ) : current ? (
                <>
                  <span className="ov-now">Jetzt</span> {current.name}{" "}
                  <b>
                    {current.progress}/{current.target}
                  </b>
                  {current.mode === "streak" && " in Folge"}
                </>
              ) : null}
            </div>
          </div>
          <Timer elapsed={elapsed} running={running} finished={finished} />
        </div>
      </div>
    );
  }

  return (
    <div className="ov-root" style={style}>
      <div className={`ov-panel ov-full${finished ? " ov-finished" : ""}`}>
        <div className="ov-head">
          <div className="ov-title">{data.title}</div>
          <div className="ov-count">
            {done}
            <small>/{total}</small>
          </div>
        </div>

        <Timer elapsed={elapsed} running={running} finished={finished} big />

        <div className="ov-bar">
          <div style={{ width: `${pct}%` }} />
        </div>

        {finished && <div className="ov-banner">Challenge geschafft!</div>}

        <GameList
          games={data.games}
          flash={flash}
          rows={rows}
        />
      </div>
    </div>
  );
}

const SECONDS_PER_ROW = 2.2; // Tempo des Durchlaufs

/** Zeigt `rows` Spiele; bei mehr Spielen läuft die Liste gleichmäßig in einer Endlosschleife durch. */
function GameList({
  games,
  flash,
  rows,
}: {
  games: OverlayGame[];
  flash: Record<string, number>;
  rows: number;
}) {
  const scroll = games.length > rows;
  const list = scroll ? [...games, ...games.slice(0, rows)] : games;

  return (
    <div
      className={`ov-games-window${scroll ? " is-scrolling" : ""}`}
      style={{ "--ov-rows": Math.min(rows, games.length) } as React.CSSProperties}
    >
      <ol
        className="ov-games"
        style={
          scroll
            ? ({
                "--ov-count": games.length,
                animationDuration: `${games.length * SECONDS_PER_ROW}s`,
              } as React.CSSProperties)
            : undefined
        }
      >
        {list.map((g, k) => {
          const i = k % games.length;
          const flashing = flash[g.id] && Date.now() - flash[g.id] < 1500;
          return (
            <li
              key={`${g.id}-${k}`}
              className={`ov-game${g.done ? " is-done" : ""}${
                flashing ? " is-flash" : ""
              }`}
            >
              <span className="ov-idx">{g.done ? "✓" : i + 1}</span>
              <span className="ov-name">{g.name}</span>
              {g.mode === "streak" && g.target <= 10 ? (
                <span className="ov-dots">
                  {Array.from({ length: g.target }, (_, d) => (
                    <span key={d} className={d < g.progress ? "on" : ""} />
                  ))}
                </span>
              ) : (
                <span className="ov-prog">
                  {g.progress}/{g.target}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Timer({
  elapsed,
  running,
  finished,
  big,
}: {
  elapsed: number;
  running: boolean;
  finished: boolean;
  big?: boolean;
}) {
  return (
    <div className={`ov-timer${big ? " ov-timer-big" : ""}`}>
      <span className={`ov-state${running ? " live" : ""}`}>
        {finished ? "Endzeit" : running ? "Läuft" : "Pause"}
      </span>
      <span className="ov-time">{formatTime(elapsed)}</span>
    </div>
  );
}
