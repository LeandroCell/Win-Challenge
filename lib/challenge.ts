export type Mode = "total" | "streak";

/** Ein Spiel innerhalb einer Challenge, z. B. „Fortnite: 5 Siege“. */
export interface Game {
  id: string;
  name: string;
  mode: Mode; // total = X Siege insgesamt, streak = X Siege hintereinander
  target: number;
  wins: number;
  streak: number;
  bestStreak: number;
  losses: number;
  completedAt: number | null;
}

/** Eine Challenge = Gruppe von Spielen mit gemeinsamem Timer. */
export interface Challenge {
  id: string;
  title: string;
  games: Game[];
  elapsedMs: number;
  timerStartedAt: number | null; // Epoch-ms, wenn der Timer läuft
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface GameInput {
  name: string;
  mode: Mode;
  target: number;
}

export interface NewChallengeInput {
  title: string;
  games: GameInput[];
}

export type Action =
  // ganze Challenge
  | { type: "rename"; title: string }
  | { type: "timer-start" }
  | { type: "timer-pause" }
  | { type: "timer-reset" }
  | { type: "restart" }
  | { type: "add-game"; game: GameInput }
  | { type: "remove-game"; gameId: string }
  | { type: "move-game"; gameId: string; dir: -1 | 1 }
  // einzelnes Spiel
  | { type: "win"; gameId: string }
  | { type: "loss"; gameId: string }
  | { type: "undo-win"; gameId: string }
  | { type: "edit-game"; gameId: string; game: GameInput; progress?: number };

export const MAX_GAMES = 50;
const MAX_TARGET = 100000;

/* ---------- Helfer ---------- */

export function progressOf(g: Game): number {
  return g.mode === "streak" ? g.streak : g.wins;
}

export function doneCount(c: Challenge): number {
  return c.games.filter((g) => g.completedAt !== null).length;
}

function clampInt(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function cleanText(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function newId(): string {
  return crypto.randomUUID();
}

/* ---------- Eingaben prüfen ---------- */

function parseGameInput(v: unknown): GameInput | string {
  const b = (v ?? {}) as Record<string, unknown>;
  const name = cleanText(b.name, 60);
  const target = clampInt(b.target, 1, MAX_TARGET);
  if (!name) return "Jedes Spiel braucht einen Namen.";
  if (target === null) return "Ziel muss eine Zahl sein.";
  return { name, mode: b.mode === "streak" ? "streak" : "total", target };
}

export function parseNewChallenge(body: unknown): NewChallengeInput | string {
  const b = (body ?? {}) as Record<string, unknown>;
  const title = cleanText(b.title, 80);
  if (!title) return "Bitte einen Namen für die Challenge eingeben.";
  if (!Array.isArray(b.games) || b.games.length === 0) return "Mindestens ein Spiel hinzufügen.";
  if (b.games.length > MAX_GAMES) return `Höchstens ${MAX_GAMES} Spiele.`;
  const games: GameInput[] = [];
  for (const g of b.games) {
    const parsed = parseGameInput(g);
    if (typeof parsed === "string") return parsed;
    games.push(parsed);
  }
  return { title, games };
}

export function parseAction(body: unknown): Action | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const gameId = typeof b.gameId === "string" ? b.gameId : null;
  switch (b.type) {
    case "rename": {
      const title = cleanText(b.title, 80);
      return title ? { type: "rename", title } : null;
    }
    case "timer-start":
    case "timer-pause":
    case "timer-reset":
    case "restart":
      return { type: b.type };
    case "add-game": {
      const game = parseGameInput(b.game);
      return typeof game === "string" ? null : { type: "add-game", game };
    }
    case "remove-game":
    case "win":
    case "loss":
    case "undo-win":
      return gameId ? { type: b.type, gameId } : null;
    case "move-game":
      return gameId && (b.dir === 1 || b.dir === -1) ? { type: "move-game", gameId, dir: b.dir } : null;
    case "edit-game": {
      const game = parseGameInput(b.game);
      if (!gameId || typeof game === "string") return null;
      const a: Extract<Action, { type: "edit-game" }> = { type: "edit-game", gameId, game };
      if (b.progress !== undefined) {
        const p = clampInt(b.progress, 0, MAX_TARGET);
        if (p === null) return null;
        a.progress = p;
      }
      return a;
    }
    default:
      return null;
  }
}

/* ---------- Erzeugen ---------- */

function createGame(input: GameInput): Game {
  return {
    id: newId(),
    ...input,
    wins: 0,
    streak: 0,
    bestStreak: 0,
    losses: 0,
    completedAt: null,
  };
}

export function createChallenge(input: NewChallengeInput, now: number): Challenge {
  return {
    id: newId(),
    title: input.title,
    games: input.games.map(createGame),
    elapsedMs: 0,
    timerStartedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/* ---------- Aktionen anwenden ---------- */

function pause(c: Challenge, now: number): void {
  if (c.timerStartedAt !== null) {
    c.elapsedMs += Math.max(0, now - c.timerStartedAt);
    c.timerStartedAt = null;
  }
}

function syncGame(g: Game, now: number): void {
  const done = progressOf(g) >= g.target;
  if (done && g.completedAt === null) g.completedAt = now;
  else if (!done) g.completedAt = null;
}

function syncChallenge(c: Challenge, now: number): void {
  const done = c.games.length > 0 && c.games.every((g) => g.completedAt !== null);
  if (done && c.completedAt === null) {
    c.completedAt = now;
    pause(c, now); // Gesamt-Timer stoppt, wenn alle Spiele geschafft sind
  } else if (!done) {
    c.completedAt = null;
  }
}

function setProgress(g: Game, value: number): void {
  if (g.mode === "streak") {
    g.streak = value;
    g.bestStreak = Math.max(g.bestStreak, g.streak);
    g.wins = Math.max(g.wins, g.streak);
  } else {
    g.wins = value;
  }
}

/** Wendet eine Aktion an und gibt eine neue Challenge zurück (Original bleibt unverändert). */
export function applyAction(prev: Challenge, action: Action, now: number): Challenge {
  const c: Challenge = { ...prev, games: prev.games.map((g) => ({ ...g })), updatedAt: now };

  switch (action.type) {
    case "rename":
      c.title = action.title;
      return c;
    case "timer-start":
      if (c.timerStartedAt === null && c.completedAt === null) c.timerStartedAt = now;
      return c;
    case "timer-pause":
      pause(c, now);
      return c;
    case "timer-reset":
      c.elapsedMs = 0;
      if (c.timerStartedAt !== null) c.timerStartedAt = now;
      return c;
    case "restart":
      c.games = c.games.map((g) => ({ ...g, wins: 0, streak: 0, bestStreak: 0, losses: 0, completedAt: null }));
      c.elapsedMs = 0;
      c.timerStartedAt = null;
      c.completedAt = null;
      return c;
    case "add-game":
      if (c.games.length < MAX_GAMES) c.games.push(createGame(action.game));
      break;
    case "remove-game":
      c.games = c.games.filter((g) => g.id !== action.gameId);
      break;
    case "move-game": {
      const i = c.games.findIndex((g) => g.id === action.gameId);
      const j = i + action.dir;
      if (i >= 0 && j >= 0 && j < c.games.length) [c.games[i], c.games[j]] = [c.games[j], c.games[i]];
      return c;
    }
    default: {
      const g = c.games.find((x) => x.id === action.gameId);
      if (!g) return c;
      switch (action.type) {
        case "win":
          g.wins += 1;
          g.streak += 1;
          g.bestStreak = Math.max(g.bestStreak, g.streak);
          break;
        case "loss":
          g.losses += 1;
          g.streak = 0;
          break;
        case "undo-win":
          if (g.wins > 0) g.wins -= 1;
          if (g.streak > 0) g.streak -= 1;
          break;
        case "edit-game":
          g.name = action.game.name;
          g.mode = action.game.mode;
          g.target = action.game.target;
          if (action.progress !== undefined) setProgress(g, action.progress);
          break;
      }
      syncGame(g, now);
    }
  }
  syncChallenge(c, now);
  return c;
}
