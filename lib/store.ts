import { neon } from "@neondatabase/serverless";
import { promises as fs } from "fs";
import path from "path";
import type { Challenge, Game } from "./challenge";

export interface Store {
  list(): Promise<Challenge[]>;
  get(id: string): Promise<Challenge | null>;
  save(c: Challenge): Promise<void>; // insert oder update
  remove(id: string): Promise<void>;
}

const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

/* ---------- Postgres (Neon) ---------- */

type Row = {
  id: string;
  title: string;
  games: Game[] | string;
  elapsed_ms: string | number;
  timer_started_at: string | number | null;
  completed_at: string | number | null;
  created_at: string | number;
  updated_at: string | number;
};

const numOrNull = (v: string | number | null) => (v === null ? null : Number(v));

function fromRow(r: Row): Challenge {
  return {
    id: r.id,
    title: r.title,
    games: typeof r.games === "string" ? JSON.parse(r.games) : r.games,
    elapsedMs: Number(r.elapsed_ms),
    timerStartedAt: numOrNull(r.timer_started_at),
    completedAt: numOrNull(r.completed_at),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

function postgresStore(url: string): Store {
  const sql = neon(url);
  let ready: Promise<unknown> | null = null;
  // Tabelle wird beim ersten Zugriff automatisch angelegt.
  const init = () =>
    (ready ??= sql`
      CREATE TABLE IF NOT EXISTS win_challenges (
        id               text PRIMARY KEY,
        title            text NOT NULL,
        games            jsonb NOT NULL DEFAULT '[]'::jsonb,
        elapsed_ms       bigint NOT NULL DEFAULT 0,
        timer_started_at bigint,
        completed_at     bigint,
        created_at       bigint NOT NULL,
        updated_at       bigint NOT NULL
      )`.catch((e) => {
      ready = null;
      throw e;
    }));

  return {
    async list() {
      await init();
      const rows = (await sql`SELECT * FROM win_challenges ORDER BY created_at DESC`) as Row[];
      return rows.map(fromRow);
    },
    async get(id) {
      await init();
      const rows = (await sql`SELECT * FROM win_challenges WHERE id = ${id}`) as Row[];
      return rows[0] ? fromRow(rows[0]) : null;
    },
    async save(c) {
      await init();
      const games = JSON.stringify(c.games);
      await sql`
        INSERT INTO win_challenges (id, title, games, elapsed_ms, timer_started_at, completed_at,
                                    created_at, updated_at)
        VALUES (${c.id}, ${c.title}, ${games}::jsonb, ${c.elapsedMs}, ${c.timerStartedAt},
                ${c.completedAt}, ${c.createdAt}, ${c.updatedAt})
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title, games = EXCLUDED.games, elapsed_ms = EXCLUDED.elapsed_ms,
          timer_started_at = EXCLUDED.timer_started_at, completed_at = EXCLUDED.completed_at,
          updated_at = EXCLUDED.updated_at`;
    },
    async remove(id) {
      await init();
      await sql`DELETE FROM win_challenges WHERE id = ${id}`;
    },
  };
}

/* ---------- Lokale JSON-Datei (nur Entwicklung) ---------- */

function fileStore(): Store {
  const file = path.join(process.cwd(), ".data", "win-challenges.json");
  async function readAll(): Promise<Challenge[]> {
    try {
      return JSON.parse(await fs.readFile(file, "utf8")) as Challenge[];
    } catch {
      return [];
    }
  }
  async function writeAll(all: Challenge[]) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(all, null, 2));
  }
  return {
    async list() {
      return (await readAll()).sort((a, b) => b.createdAt - a.createdAt);
    },
    async get(id) {
      return (await readAll()).find((c) => c.id === id) ?? null;
    },
    async save(c) {
      const all = await readAll();
      const i = all.findIndex((x) => x.id === c.id);
      if (i >= 0) all[i] = c;
      else all.push(c);
      await writeAll(all);
    },
    async remove(id) {
      await writeAll((await readAll()).filter((c) => c.id !== id));
    },
  };
}

let cached: Store | null = null;

export function getStore(): Store {
  if (cached) return cached;
  if (dbUrl) return (cached = postgresStore(dbUrl));
  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL fehlt. Bitte in Vercel eine Neon-Postgres-Datenbank verbinden.");
  }
  return (cached = fileStore());
}
