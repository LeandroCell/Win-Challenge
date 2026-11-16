# Win-Challenge

Kleine, passwortgeschützte Web-App für Gaming-Challenges. Eine Challenge besteht aus mehreren Spielen, z. B. „10-Spiele-Challenge“ mit Fortnite (5 Siege), Rocket League (3 Siege in Folge) usw.

- Beliebig viele Challenges anlegen. Jede enthält bis zu 50 Spiele mit eigenem Ziel.
- Pro Spiel zwei Arten: **Siege insgesamt** oder **Siege in Folge** (dort setzt eine Niederlage die Serie auf 0)
- Buttons für Sieg, Niederlage und zum Zurücknehmen. Der Stand lässt sich auch direkt eintragen.
- Spiele lassen sich nachträglich hinzufügen, bearbeiten, umsortieren und entfernen.
- **Ein Gesamt-Timer pro Challenge** zum Starten und Pausieren. Er stoppt automatisch, wenn alle Spiele geschafft sind.
- Gemeinsame Liste: Alle mit dem Passwort sehen denselben Stand. Die Seite aktualisiert sich alle 5 Sekunden.
- Akzentfarbe (färbt die ganze Seite leicht ein) sowie Hell-, Dunkel- oder Auto-Modus

Technik: Next.js 16, Postgres über [Neon](https://neon.tech) und Deployment auf Vercel.

## OBS-Overlay

Jede Challenge hat ein Overlay für den Stream. Es zeigt den Gesamt-Timer, den Fortschritt und alle Spiele. Das aktuelle Spiel wird hervorgehoben, und ein neuer Sieg blinkt kurz auf. Es sind immer 4 Spiele zu sehen; bei mehr Spielen läuft die Liste gleichmäßig als Endlos-Laufband durch (Anzahl änderbar mit `&rows=5` im Link).

1. Auf der Challenge-Karte auf das **Bildschirm-Symbol** klicken.
2. Zwischen **Komplett** (390 × 380) und **Kompakt** (570 × 110) wählen und den Link kopieren.
3. In OBS: **Quelle hinzufügen → Browser**, den Link einfügen und die Größe übernehmen.

Der Hintergrund ist durchsichtig, das Panel halbtransparent. Die Akzentfarbe kommt aus dem Link (`accent=blue`, `green`, `violet`, `orange`, `pink`, `cyan` oder `graphite`). Der Link enthält einen Nur-Lese-Schlüssel und funktioniert ohne Login. Damit kann man den Stand nur ansehen, nicht ändern. Den Link trotzdem nicht öffentlich posten.

## Deployment

Das Repo ist mit Vercel verbunden: **Jeder Push auf `main` wird automatisch veröffentlicht.**

## Auf Vercel neu einrichten

1. Repo auf GitHub pushen.
2. Auf [vercel.com/new](https://vercel.com/new) das Repo importieren. Framework „Next.js“ wird automatisch erkannt.
3. Im Vercel-Projekt unter **Storage → Create Database → Neon (Postgres)** eine Datenbank anlegen und mit dem Projekt verbinden. Dadurch wird `DATABASE_URL` automatisch gesetzt.
4. Unter **Settings → Environment Variables** eintragen:
   | Name | Wert |
   |---|---|
   | `SITE_PASSWORD` | euer gemeinsames Passwort |
   | `AUTH_SECRET` | langer Zufallswert, z. B. Ausgabe von `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
5. **Redeploy** auslösen, fertig. Die Tabelle wird beim ersten Aufruf automatisch angelegt.

Wenn du `SITE_PASSWORD` änderst, werden alle bestehenden Logins ungültig.

## Lokal entwickeln

```bash
npm install
cp .env.example .env.local   # SITE_PASSWORD und AUTH_SECRET eintragen
npm run dev
```

Ohne `DATABASE_URL` werden die Daten lokal in `.data/win-challenges.json` gespeichert. Mit `DATABASE_URL` in `.env.local` wird stattdessen die echte Datenbank benutzt.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `app/dashboard.tsx` | Hauptseite: Karten, Timer, Formulare |
| `app/theme-picker.tsx` | Farb- und Hell/Dunkel-Auswahl |
| `app/login/page.tsx` | Login |
| `app/api/` | API für Challenges, Login und Logout |
| `lib/challenge.ts` | Logik: Spiele, Siege, Serien, Gesamt-Timer, Abschluss |
| `lib/store.ts` | Speicher: Postgres oder lokale JSON-Datei |
| `app/overlay/` | OBS-Overlay (öffentlich mit Schlüssel) |
| `lib/auth.ts`, `proxy.ts` | Passwortschutz über ein signiertes Cookie, Overlay-Schlüssel |
| `scripts/set-secrets.ps1` | Passwort und Secret in Vercel setzen |
