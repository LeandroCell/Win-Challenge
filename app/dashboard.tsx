"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_GAMES,
  applyAction,
  doneCount,
  progressOf,
  type Action,
  type Challenge,
  type Game,
  type GameInput,
  type Mode,
} from "@/lib/challenge";
import ThemePicker from "./theme-picker";

const POLL_MS = 5000;

type Filter = "active" | "done";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Nicht eingeloggt");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Fehler ${res.status}`);
  return data as T;
}

export default function Dashboard() {
  const [items, setItems] = useState<Challenge[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<Filter>("active");
  const offset = useRef(0); // Serverzeit - lokale Zeit
  const pending = useRef(0);

  const syncClock = (serverNow: number) => {
    offset.current = serverNow - Date.now();
  };
  const now = () => Date.now() + offset.current;

  const load = useCallback(async () => {
    try {
      const data = await api<{ challenges: Challenge[]; serverNow: number }>("/api/challenges");
      if (pending.current > 0) return; // laufende Änderung nicht überschreiben
      syncClock(data.serverNow);
      setItems(data.challenges);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  // Laden + regelmäßig aktualisieren, damit ihr beide denselben Stand seht
  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const onVis = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  // Aktionen pro Challenge nacheinander senden, damit schnelle Klicks nicht durcheinandergeraten
  const queues = useRef(new Map<string, Promise<void>>());

  function act(id: string, action: Action) {
    setItems((list) =>
      list ? list.map((x) => (x.id === id ? applyAction(x, action, now()) : x)) : list,
    );
    pending.current++;
    const prev = queues.current.get(id) ?? Promise.resolve();
    const next = prev.then(async () => {
      try {
        const data = await api<{ challenge: Challenge; serverNow: number }>(
          `/api/challenges/${id}`,
          { method: "PATCH", body: JSON.stringify(action) },
        );
        syncClock(data.serverNow);
        if (pending.current === 1) {
          setItems((list) => (list ? list.map((x) => (x.id === id ? data.challenge : x)) : list));
        }
        setError("");
      } catch (e) {
        setError((e as Error).message);
        setTimeout(load, 0); // Stand vom Server holen
      } finally {
        pending.current--;
      }
    });
    queues.current.set(id, next);
  }

  async function create(title: string, games: GameInput[]) {
    const data = await api<{ challenge: Challenge; serverNow: number }>("/api/challenges", {
      method: "POST",
      body: JSON.stringify({ title, games }),
    });
    syncClock(data.serverNow);
    setItems((list) => [data.challenge, ...(list ?? [])]);
    setFilter("active");
    setCreating(false);
  }

  async function remove(c: Challenge) {
    if (!confirm(`Challenge „${c.title}“ mit allen Spielen löschen?`)) return;
    setItems((list) => list?.filter((x) => x.id !== c.id) ?? list);
    pending.current++;
    try {
      await api(`/api/challenges/${c.id}`, { method: "DELETE" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current--;
    }
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const active = items?.filter((c) => c.completedAt === null) ?? [];
  const done = (items?.filter((c) => c.completedAt !== null) ?? []).sort(
    (a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0),
  );
  const shown = filter === "active" ? active : done;

  return (
    <main className="wrap">
      <header className="top">
        <div className="brand">
          <span className="brand-dot" />
          Win-Challenge
        </div>
        <div className="top-actions">
          <ThemePicker />
          <button className="btn btn-ghost" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Filter">
          <button aria-pressed={filter === "active"} onClick={() => setFilter("active")}>
            Aktiv <span className="num">{active.length}</span>
          </button>
          <button aria-pressed={filter === "done"} onClick={() => setFilter("done")}>
            Geschafft <span className="num">{done.length}</span>
          </button>
        </div>
        {!creating && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + <span className="new-label">Neue Challenge</span>
          </button>
        )}
      </div>

      {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}

      {creating && (
        <div className="card" style={{ marginBottom: 16 }}>
          <NewChallengeForm onCancel={() => setCreating(false)} onSubmit={create} />
        </div>
      )}

      {items === null ? (
        <p className="hint">Lade…</p>
      ) : shown.length === 0 ? (
        <div className="empty">
          {filter === "active" ? (
            <>
              <p>Keine aktive Challenge.</p>
              {!creating && (
                <button className="btn btn-primary" onClick={() => setCreating(true)}>
                  Erste Challenge anlegen
                </button>
              )}
            </>
          ) : (
            <p style={{ margin: 0 }}>Noch keine Challenge geschafft.</p>
          )}
        </div>
      ) : (
        <div className="list">
          {shown.map((c) => (
            <ChallengeCard
              key={c.id}
              c={c}
              now={now}
              onAction={(a) => act(c.id, a)}
              onDelete={() => remove(c)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

/* ---------- Challenge-Karte ---------- */

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function useTick(active: boolean) {
  const [, setT] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setT((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [active]);
}

function ChallengeCard({
  c,
  now,
  onAction,
  onDelete,
}: {
  c: Challenge;
  now: () => number;
  onAction: (a: Action) => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingGame, setEditingGame] = useState<string | null>(null);
  const running = c.timerStartedAt !== null;
  useTick(running);

  const doneGames = doneCount(c);
  const total = c.games.length;
  const elapsed = c.elapsedMs + (running ? Math.max(0, now() - c.timerStartedAt!) : 0);
  const isDone = c.completedAt !== null;

  return (
    <article className={`card challenge${isDone ? " done" : ""}`}>
      <div className="card-head">
        {renaming ? (
          <TitleForm
            initial={c.title}
            onCancel={() => setRenaming(false)}
            onSubmit={(title) => {
              onAction({ type: "rename", title });
              setRenaming(false);
            }}
          />
        ) : (
          <div style={{ minWidth: 0 }}>
            <h2 className="card-title">{c.title}</h2>
            <div className="card-meta num">
              {doneGames} / {total} Spiele geschafft
            </div>
          </div>
        )}
        {!renaming && (
          <div className="card-menu">
            <button className="btn btn-ghost btn-sm btn-icon" title="Umbenennen" aria-label="Umbenennen" onClick={() => setRenaming(true)}>
              <PencilIcon />
            </button>
            <button
              className="btn btn-ghost btn-sm btn-icon"
              title="Neu starten"
              aria-label="Neu starten"
              onClick={() =>
                confirm("Alle Spiele und den Timer auf 0 setzen?") && onAction({ type: "restart" })
              }
            >
              <RestartIcon />
            </button>
            <button className="btn btn-ghost btn-sm btn-icon btn-danger" title="Löschen" aria-label="Löschen" onClick={onDelete}>
              <TrashIcon />
            </button>
          </div>
        )}
      </div>

      <div className="timer-block">
        <div>
          <div className="timer-label">{isDone ? "Gesamtzeit" : "Gesamt-Timer"}</div>
          <div className={`timer-big num${running ? " running" : ""}`}>{formatTime(elapsed)}</div>
        </div>
        <div className="timer-btns">
          {isDone ? (
            <span className="badge">✓ Geschafft</span>
          ) : running ? (
            <button className="btn" onClick={() => onAction({ type: "timer-pause" })}>
              <PauseIcon /> Pause
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => onAction({ type: "timer-start" })}>
              <PlayIcon /> {elapsed > 0 ? "Weiter" : "Start"}
            </button>
          )}
          <button
            className="btn btn-ghost btn-icon"
            title="Timer zurücksetzen"
            aria-label="Timer zurücksetzen"
            disabled={elapsed === 0}
            onClick={() => confirm("Timer auf 0 setzen?") && onAction({ type: "timer-reset" })}
          >
            <RestartIcon />
          </button>
        </div>
      </div>

      <div className="bar" aria-hidden>
        <div style={{ width: `${total ? (doneGames / total) * 100 : 0}%` }} />
      </div>

      <ol className="games">
        {c.games.map((g, i) =>
          editingGame === g.id ? (
            <li key={g.id} className="game game-editing">
              <GameEditForm
                game={g}
                canUp={i > 0}
                canDown={i < total - 1}
                onMove={(dir) => onAction({ type: "move-game", gameId: g.id, dir })}
                onRemove={() => {
                  if (confirm(`Spiel „${g.name}“ entfernen?`)) {
                    onAction({ type: "remove-game", gameId: g.id });
                    setEditingGame(null);
                  }
                }}
                onCancel={() => setEditingGame(null)}
                onSubmit={(game, progress) => {
                  onAction({ type: "edit-game", gameId: g.id, game, progress });
                  setEditingGame(null);
                }}
              />
            </li>
          ) : (
            <GameRow
              key={g.id}
              g={g}
              index={i}
              onAction={onAction}
              onEdit={() => setEditingGame(g.id)}
            />
          ),
        )}
      </ol>

      {adding ? (
        <div className="game-editing">
          <GameFields
            submitLabel="Hinzufügen"
            onCancel={() => setAdding(false)}
            onSubmit={(game) => {
              onAction({ type: "add-game", game });
              setAdding(false);
            }}
          />
        </div>
      ) : (
        total < MAX_GAMES && (
          <button className="btn btn-ghost add-game" onClick={() => setAdding(true)}>
            + Spiel hinzufügen
          </button>
        )
      )}
    </article>
  );
}

function GameRow({
  g,
  index,
  onAction,
  onEdit,
}: {
  g: Game;
  index: number;
  onAction: (a: Action) => void;
  onEdit: () => void;
}) {
  const progress = progressOf(g);
  const isDone = g.completedAt !== null;
  const streak = g.mode === "streak";

  return (
    <li className={`game${isDone ? " game-done" : ""}`}>
      <span className="game-index num" aria-hidden>
        {isDone ? "✓" : index + 1}
      </span>

      <div className="game-info">
        <div className="game-name">{g.name}</div>
        <div className="game-meta num">
          {streak ? `${g.target} in Folge` : `${g.target} ${g.target === 1 ? "Sieg" : "Siege"}`}
          {g.losses > 0 && ` · ${g.losses} N`}
          {streak && g.bestStreak > 0 && ` · Beste Serie ${g.bestStreak}`}
        </div>
      </div>

      <div className="game-progress">
        <span className="game-count num">
          {progress}
          <small>/{g.target}</small>
        </span>
        {streak && g.target <= 10 ? (
          <span className="dots" aria-hidden>
            {Array.from({ length: g.target }, (_, k) => (
              <span key={k} className={`dot${k < progress ? " on" : ""}`} />
            ))}
          </span>
        ) : (
          <span className="mini-bar" aria-hidden>
            <span style={{ width: `${Math.min(100, (progress / g.target) * 100)}%` }} />
          </span>
        )}
      </div>

      <div className="game-actions">
        {!isDone && (
          <>
            <button className="btn btn-sm btn-primary" onClick={() => onAction({ type: "win", gameId: g.id })}>
              + Sieg
            </button>
            <button
              className="btn btn-sm"
              title={streak ? "Niederlage: Serie fällt auf 0" : "Niederlage zählen"}
              onClick={() => onAction({ type: "loss", gameId: g.id })}
            >
              Niederlage
            </button>
          </>
        )}
        <button
          className="btn btn-sm btn-ghost btn-icon"
          title="Letzten Sieg zurücknehmen"
          aria-label="Letzten Sieg zurücknehmen"
          disabled={progress === 0}
          onClick={() => onAction({ type: "undo-win", gameId: g.id })}
        >
          −1
        </button>
        <button className="btn btn-sm btn-ghost btn-icon" title="Spiel bearbeiten" aria-label="Spiel bearbeiten" onClick={onEdit}>
          <PencilIcon />
        </button>
      </div>
    </li>
  );
}

/* ---------- Formulare ---------- */

type Draft = { key: number; name: string; mode: Mode; target: string };

let draftKey = 0;
const emptyDraft = (): Draft => ({ key: ++draftKey, name: "", mode: "total", target: "1" });

function NewChallengeForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (title: string, games: GameInput[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>(() => [emptyDraft(), emptyDraft(), emptyDraft()]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const update = (key: number, patch: Partial<Draft>) =>
    setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Bitte einen Namen für die Challenge eingeben.");
    const filled = drafts.filter((d) => d.name.trim());
    if (filled.length === 0) return setError("Mindestens ein Spiel eintragen.");
    const games: GameInput[] = [];
    for (const d of filled) {
      const t = Number(d.target);
      if (!Number.isInteger(t) || t < 1) return setError(`Ziel bei „${d.name}“ muss mindestens 1 sein.`);
      games.push({ name: d.name.trim(), mode: d.mode, target: t });
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit(title.trim(), games);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        <span>Name der Challenge</span>
        <input
          className="input"
          autoFocus
          placeholder="z. B. 10-Spiele-Challenge"
          maxLength={80}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <div className="field">
        <span>Spiele</span>
        <div className="draft-list">
          {drafts.map((d, i) => (
            <div className="draft" key={d.key}>
              <span className="game-index num" aria-hidden>
                {i + 1}
              </span>
              <input
                className="input draft-name"
                placeholder="Spiel, z. B. Fortnite"
                aria-label={`Spiel ${i + 1}`}
                maxLength={60}
                value={d.name}
                onChange={(e) => update(d.key, { name: e.target.value })}
              />
              <select
                className="input"
                aria-label="Art"
                value={d.mode}
                onChange={(e) => update(d.key, { mode: e.target.value as Mode })}
              >
                <option value="total">Siege</option>
                <option value="streak">in Folge</option>
              </select>
              <input
                className="input num"
                type="number"
                inputMode="numeric"
                min={1}
                aria-label="Ziel"
                value={d.target}
                onChange={(e) => update(d.key, { target: e.target.value })}
              />
              <button
                type="button"
                className="btn btn-ghost btn-icon"
                aria-label="Zeile entfernen"
                title="Zeile entfernen"
                disabled={drafts.length === 1}
                onClick={() => setDrafts((x) => x.filter((y) => y.key !== d.key))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {drafts.length < MAX_GAMES && (
          <button
            type="button"
            className="btn btn-ghost add-game"
            onClick={() => setDrafts((d) => [...d, emptyDraft()])}
          >
            + Weiteres Spiel
          </button>
        )}
        <p className="hint">„in Folge“: Eine Niederlage setzt die Serie bei diesem Spiel auf 0.</p>
      </div>

      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Abbrechen
        </button>
        <button className="btn btn-primary" disabled={busy}>
          Challenge anlegen
        </button>
      </div>
    </form>
  );
}

function TitleForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: string;
  onSubmit: (t: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial);
  return (
    <form
      className="title-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim()) onSubmit(title.trim());
      }}
    >
      <input
        className="input"
        autoFocus
        maxLength={80}
        aria-label="Name der Challenge"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      />
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        Abbrechen
      </button>
      <button className="btn btn-primary">Speichern</button>
    </form>
  );
}

/** Felder für ein Spiel (Name, Art, Ziel, optional aktueller Stand). */
function GameFields({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  extra,
}: {
  initial?: Game;
  submitLabel: string;
  onSubmit: (g: GameInput, progress?: number) => void;
  onCancel: () => void;
  extra?: React.ReactNode;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [mode, setMode] = useState<Mode>(initial?.mode ?? "total");
  const [target, setTarget] = useState(String(initial?.target ?? 1));
  const [progress, setProgress] = useState(initial ? String(progressOf(initial)) : "");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = Number(target);
    if (!name.trim()) return setError("Bitte einen Namen eingeben.");
    if (!Number.isInteger(t) || t < 1) return setError("Ziel muss mindestens 1 sein.");
    let p: number | undefined;
    if (initial) {
      p = Number(progress);
      if (!Number.isInteger(p) || p < 0) return setError("Stand muss 0 oder mehr sein.");
    }
    onSubmit({ name: name.trim(), mode, target: t }, p);
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="form-row form-row-game">
        <label className="field">
          <span>Spiel</span>
          <input
            className="input"
            autoFocus
            placeholder="z. B. Rocket League"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Art</span>
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="total">Siege insgesamt</option>
            <option value="streak">Siege in Folge</option>
          </select>
        </label>
        <label className="field">
          <span>Ziel</span>
          <input
            className="input num"
            type="number"
            inputMode="numeric"
            min={1}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </label>
        {initial && (
          <label className="field">
            <span>{mode === "streak" ? "Serie" : "Siege"}</span>
            <input
              className="input num"
              type="number"
              inputMode="numeric"
              min={0}
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
            />
          </label>
        )}
      </div>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        {extra}
        <span style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Abbrechen
        </button>
        <button className="btn btn-primary">{submitLabel}</button>
      </div>
    </form>
  );
}

function GameEditForm({
  game,
  canUp,
  canDown,
  onMove,
  onRemove,
  onSubmit,
  onCancel,
}: {
  game: Game;
  canUp: boolean;
  canDown: boolean;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onSubmit: (g: GameInput, progress?: number) => void;
  onCancel: () => void;
}) {
  return (
    <GameFields
      initial={game}
      submitLabel="Speichern"
      onSubmit={onSubmit}
      onCancel={onCancel}
      extra={
        <>
          <button type="button" className="btn btn-ghost btn-icon" title="Nach oben" aria-label="Nach oben" disabled={!canUp} onClick={() => onMove(-1)}>
            ↑
          </button>
          <button type="button" className="btn btn-ghost btn-icon" title="Nach unten" aria-label="Nach unten" disabled={!canDown} onClick={() => onMove(1)}>
            ↓
          </button>
          <button type="button" className="btn btn-ghost btn-danger" onClick={onRemove}>
            Entfernen
          </button>
        </>
      }
    />
  );
}

/* ---------- Icons ---------- */

const svg = {
  width: 15,
  height: 15,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const PencilIcon = () => (
  <svg {...svg}>
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);
const RestartIcon = () => (
  <svg {...svg}>
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
  </svg>
);
const TrashIcon = () => (
  <svg {...svg}>
    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
  </svg>
);
const PlayIcon = () => (
  <svg {...svg} width={12} height={12}>
    <path d="M6 4l14 8-14 8z" fill="currentColor" />
  </svg>
);
const PauseIcon = () => (
  <svg {...svg} width={12} height={12}>
    <path d="M7 4v16M17 4v16" strokeWidth={3} />
  </svg>
);
