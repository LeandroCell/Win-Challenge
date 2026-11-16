import { NextResponse } from "next/server";
import { createChallenge, parseNewChallenge } from "@/lib/challenge";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const challenges = await getStore().list();
    return NextResponse.json({ challenges, serverNow: Date.now() });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const input = parseNewChallenge(await req.json().catch(() => null));
  if (typeof input === "string") return NextResponse.json({ error: input }, { status: 400 });
  try {
    const challenge = createChallenge(input, Date.now());
    await getStore().save(challenge);
    return NextResponse.json({ challenge, serverNow: Date.now() }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
