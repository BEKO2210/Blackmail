# AEGIS Auto-Switch — Hosted Backend (Cloudflare Worker + D1 + Resend)

Dies ist die **„Engine"** für den gehosteten Dienst: Ein Cloudflare Worker, der

- Switches speichert (D1-Datenbank),
- Check-ins über einen Ein-Klick-Link entgegennimmt,
- **stündlich automatisch** prüft, wer überfällig ist, und
- **aktiv E-Mails** verschickt (Erinnerungen an dich, Benachrichtigungen an deine Guardians) — über **Resend**.

Du (als Betreiber) deployst das **einmal**. Danach kann es **jeder weltweit** über die Webseite nutzen, ohne selbst etwas einzurichten.

---

## Voraussetzungen

1. Ein **Cloudflare-Konto** (kostenlos): https://dash.cloudflare.com/sign-up
2. **Node.js** installiert (für `npx wrangler`).
3. Ein **Resend-Konto** (kostenlos): https://resend.com → API-Key erstellen.
   - Für echten Versand an beliebige Adressen: in Resend eine **eigene Domain verifizieren** und `MAIL_FROM` darauf setzen (z.B. `AEGIS <noreply@deine-domain.de>`). Zum Testen funktioniert `onboarding@resend.dev` (nur an die eigene Resend-Konto-Adresse).

## Schritt-für-Schritt

```bash
cd service
npm install                       # installiert wrangler lokal

npx wrangler login                # einmalig: Cloudflare im Browser autorisieren

# 1) D1-Datenbank anlegen
npx wrangler d1 create aegis
#   -> kopiere die ausgegebene database_id in wrangler.toml (Feld database_id)

# 2) Tabellen anlegen (remote)
npx wrangler d1 execute aegis --remote --file=./schema.sql

# 3) Resend-API-Key als Secret hinterlegen
npx wrangler secret put RESEND_API_KEY
#   -> füge deinen Resend-Key ein

# 4) Deployen
npx wrangler deploy
#   -> du bekommst eine URL wie https://aegis-switch.DEINNAME.workers.dev
```

### Nach dem ersten Deploy

1. Trage deine echte Worker-URL in **`wrangler.toml`** unter `APP_URL` ein
   (wird für die Links in den E-Mails gebraucht) und setze `MAIL_FROM`
   auf deine verifizierte Absenderadresse. Dann erneut `npx wrangler deploy`.
2. Trage dieselbe URL im Frontend ein: **`js/service-config.js`** →
   `window.AEGIS_SERVICE_API = "https://aegis-switch.DEINNAME.workers.dev";`
   und deploye die Webseite neu (Vercel/Pages). Fertig — die `protect.html`-Seite
   („Auto-Switch") nutzt jetzt dein Backend.

## Testen

```bash
# Health-Check
curl https://aegis-switch.DEINNAME.workers.dev/

# Cron lokal simulieren (während `npx wrangler dev` läuft):
curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"
```

## Wie die Automatik arbeitet

Der Cron-Trigger läuft **jede Stunde**. Für jeden aktiven Switch wird gerechnet:

| Zeitpunkt | Aktion |
|-----------|--------|
| `reminder_hours` vor der Frist | Erinnerung an dich (Owner) |
| Frist überschritten | dringende Erinnerung an dich |
| Frist + `grace_hours` überschritten | **Switch löst aus**: alle Guardians erhalten deine Nachricht per E-Mail, du bekommst eine Info |

Ein Check-in (Ein-Klick-Link) setzt den Timer zurück und die Erinnerungsstufe auf 0.

## API (für eigene Integrationen)

| Methode & Pfad | Zweck |
|----------------|-------|
| `POST /api/switch` | Switch anlegen → Bestätigungsmail |
| `GET /verify?token=` | E-Mail bestätigen & aktivieren |
| `GET /checkin?token=` | Ein-Klick-Check-in (Browser) |
| `POST /api/checkin` | Check-in (JSON `{token}`) |
| `GET /manage?token=` | Status-Seite |
| `POST /api/pause` · `/api/resume` · `/api/delete` | verwalten (JSON `{token}` = manage_token) |

## Datenschutz / Sicherheit

- Gespeichert werden: Owner-E-Mail, Guardian-E-Mails, Intervall, deine Nachricht, optionaler Link.
- **Hochsensible Inhalte gehören NICHT direkt in die Nachricht** — nutze dafür das clientseitig verschlüsselte AEGIS-Paket und hinterlege hier nur einen Link.
- Tokens sind zufällig und dienen als Zugriffsschutz (kein Passwort/Login nötig).
- `POST /api/delete` löscht den Switch und alle Guardians.
- CORS ist offen (`*`), da die Tokens die Autorisierung darstellen.
- Für Produktion empfehlenswert: Rate-Limiting (Cloudflare WAF) gegen Missbrauch.
