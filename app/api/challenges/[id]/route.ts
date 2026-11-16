import { NextResponse } from "next/server";
import { applyAction, parseAction } from "@/lib/challenge";
import { getStore } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const action = parseAction(await req.json().catch(() => null));
  if (!action) return NextResponse.json({ error: "Ungültige Aktion" }, { status: 400 });
  try {
    const store = getStore();
    const current = await store.get(id);
    if (!current) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    const now = Date.now();
    const challenge = applyAction(current, action, now);
    await store.save(challenge);
    return NextResponse.json({ challenge, serverNow: now });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    await getStore().remove(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
