import { NextResponse } from "next/server";
import { overlayKey } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

/** Liefert den Overlay-Schlüssel (nur für eingeloggte Nutzer, siehe proxy.ts). */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const key = await overlayKey(id);
  if (!key) return NextResponse.json({ error: "AUTH_SECRET fehlt" }, { status: 500 });
  return NextResponse.json({ key });
}
