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

## Auf Vercel veröffentlichen

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
| `lib/auth.ts`, `proxy.ts` | Passwortschutz über ein signiertes Cookie |
