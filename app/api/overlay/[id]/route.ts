import { NextResponse } from "next/server";
import { isValidOverlayKey } from "@/lib/auth";
import { progressOf } from "@/lib/challenge";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

const noStore = { "Cache-Control": "no-store" };

/** Öffentliche Nur-Lese-Daten für das OBS-Overlay (geschützt durch den Overlay-Schlüssel). */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const key = new URL(req.url).searchParams.get("key");
  if (!(await isValidOverlayKey(id, key))) {
    return NextResponse.json({ error: "Overlay-Link ungültig" }, { status: 403, headers: noStore });
  }
  try {
    const c = await getStore().get(id);
    if (!c) return NextResponse.json({ error: "Challenge nicht gefunden" }, { status: 404, headers: noStore });
    return NextResponse.json(
      {
        title: c.title,
        elapsedMs: c.elapsedMs,
        timerStartedAt: c.timerStartedAt,
        completedAt: c.completedAt,
        games: c.games.map((g) => ({
          id: g.id,
          name: g.name,
          mode: g.mode,
          target: g.target,
          progress: progressOf(g),
          losses: g.losses,
          done: g.completedAt !== null,
        })),
        serverNow: Date.now(),
        // Ändert sich bei jedem Deploy → Overlay lädt sich in OBS selbst neu
        version: process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || "dev",
      },
      { headers: noStore },
    );
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500, headers: noStore });
  }
}
