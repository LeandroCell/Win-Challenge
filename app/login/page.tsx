"use client";

import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }).catch(() => null);
    if (res?.ok) {
      window.location.href = "/";
      return;
    }
    const data = res ? await res.json().catch(() => ({})) : {};
    setError(data.error || "Verbindung fehlgeschlagen");
    setBusy(false);
  }

  return (
    <main className="login">
      <form className="card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-dot" />
          <h1>Win-Challenge</h1>
        </div>
        <label className="field">
          <span>Passwort</span>
          <input
            className="input"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy || !password}>
          {busy ? "Prüfe…" : "Einloggen"}
        </button>
      </form>
    </main>
  );
}
