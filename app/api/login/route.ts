import { NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  checkPassword,
  expectedToken,
  isConfigured,
} from "@/lib/auth";

export async function POST(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json(
      { error: "SITE_PASSWORD und AUTH_SECRET sind nicht gesetzt." },
      { status: 500 },
    );
  }
  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";

  if (!(await checkPassword(password))) {
    await new Promise((r) => setTimeout(r, 600)); // bremst Durchprobieren
    return NextResponse.json({ error: "Falsches Passwort" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, (await expectedToken())!, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
