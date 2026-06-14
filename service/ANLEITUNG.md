# AEGIS Auto-Switch — Einrichtung (für dich, Schritt für Schritt)

Persönliche Anleitung, zugeschnitten auf:
- **Domain:** `it-handwerk-stuttgart.de` (Jellyfin läuft auf `jellyfin.it-handwerk-stuttgart.de` — bleibt unberührt)
- **Sende-Subdomain für E-Mails:** `send.it-handwerk-stuttgart.de` (neu, kollidiert NICHT mit Jellyfin)
- **System:** Linux
- **Konten:** Cloudflare + Resend hast du bereits

> ⏱️ Dauer: ca. 15–20 Minuten. Du brauchst nur Copy-&-Paste.
> 🛟 Wichtigste Regel: Du **fügst** DNS-Einträge nur **hinzu**. Du **löschst/änderst nichts Bestehendes** → Jellyfin läuft garantiert weiter.

---

## Schritt 1 — Resend: Sende-Domain anlegen

1. Einloggen auf https://resend.com → **Domains** → **Add Domain**.
2. Eintragen: `send.it-handwerk-stuttgart.de` → **Add**.
3. Resend zeigt dir jetzt mehrere DNS-Einträge an (meist **MX**, **TXT (SPF)**, **CNAME/TXT (DKIM)**, optional **DMARC**). Lass die Seite offen.

## Schritt 2 — Diese Einträge bei Cloudflare hinzufügen

1. https://dash.cloudflare.com → deine Domain `it-handwerk-stuttgart.de` → **DNS** → **Records**.
2. Für **jeden** von Resend angezeigten Eintrag: **Add record** → Typ, Name und Wert **exakt** wie bei Resend übernehmen.
   - Beim Namen reicht meist der Teil vor der Domain (Cloudflare hängt die Domain automatisch an). Resend nennt z. B. `send` oder `resend._domainkey.send` — genau so eintragen.
   - **Proxy-Status:** bei diesen E-Mail-Einträgen immer **„DNS only"** (graue Wolke), **nicht** orange!
3. Nichts am bestehenden `jellyfin`-Eintrag anfassen.
4. Zurück bei Resend: **Verify**. Bis zur Bestätigung können ein paar Minuten vergehen (manchmal länger). Status soll **„Verified"** werden.

## Schritt 3 — Resend API-Key erstellen

1. Resend → **API Keys** → **Create API Key** (Berechtigung „Sending access" reicht).
2. Den Key **kopieren** und kurz sicher zwischenspeichern (er wird nur einmal angezeigt). Brauchst du in Schritt 5.

---

## Schritt 4 — Worker vorbereiten (Terminal)

```bash
# Ins Projekt wechseln (Pfad ggf. anpassen)
cd /pfad/zu/Blackmail/service

# Wrangler installieren
npm install

# Cloudflare im Browser autorisieren (einmalig)
npx wrangler login

# D1-Datenbank anlegen
npx wrangler d1 create aegis
```

Der letzte Befehl gibt eine `database_id` aus. **Kopiere sie** und trage sie in `wrangler.toml` ein:

```toml
[[d1_databases]]
binding = "DB"
database_name = "aegis"
database_id = "HIER_DEINE_DATABASE_ID_EINFUEGEN"
```

Dann die Tabellen anlegen:

```bash
npx wrangler d1 execute aegis --remote --file=./schema.sql
```

## Schritt 5 — Resend-Key als Secret + Mail-Absender setzen

```bash
npx wrangler secret put RESEND_API_KEY
# -> wenn gefragt, deinen Resend-API-Key aus Schritt 3 einfügen
```

In `wrangler.toml` den Absender auf deine verifizierte Domain setzen:

```toml
[vars]
SERVICE_NAME = "AEGIS"
APP_URL = "https://aegis-switch.DEINNAME.workers.dev"   # wird in Schritt 6 final gesetzt
MAIL_FROM = "AEGIS <aegis@send.it-handwerk-stuttgart.de>"
```

## Schritt 6 — Deployen & APP_URL final setzen

```bash
npx wrangler deploy
```

Du bekommst eine URL wie `https://aegis-switch.DEINNAME.workers.dev`.
1. Diese URL in `wrangler.toml` bei **`APP_URL`** eintragen (ersetzt den Platzhalter).
2. Nochmal deployen, damit die E-Mail-Links korrekt sind:

```bash
npx wrangler deploy
```

Schnelltest, ob der Worker lebt:

```bash
curl https://aegis-switch.DEINNAME.workers.dev/
# erwartet: {"ok":true,"service":"aegis-switch"}
```

---

## Schritt 7 — Frontend mit dem Worker verbinden

Datei **`js/service-config.js`** (im Projekt-Hauptordner) öffnen und die URL eintragen:

```js
window.AEGIS_SERVICE_API = "https://aegis-switch.DEINNAME.workers.dev";
```

Dann die Webseite neu deployen (GitHub Pages: einfach committen & pushen → Auto-Deploy; Vercel: deployt automatisch).

## Schritt 8 — Testen 🎉

1. Webseite öffnen → **Auto-Switch**.
2. Deine eigene E-Mail eintragen, kurzes Intervall wählen, dich selbst als Guardian eintragen, Nachricht schreiben → **Switch erstellen**.
3. Bestätigungs-E-Mail kommt → Link klicken → „Switch aktiv".
4. Optional: Eskalation sofort testen, indem du `grace_hours` und Intervall klein hältst und den stündlichen Cron abwartest — oder lokal mit `npx wrangler dev` und
   `curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"`.

---

## Wenn etwas klemmt

| Problem | Lösung |
|--------|--------|
| Keine E-Mail | Resend-Domain wirklich „Verified"? `MAIL_FROM` exakt auf `@send.it-handwerk-stuttgart.de`? Spam-Ordner prüfen. Logs: `npx wrangler tail` |
| `database not initialized` | Schema-Schritt (`d1 execute ... schema.sql`) nochmal ausführen; `database_id` in `wrangler.toml` korrekt? |
| Frontend zeigt „Dienst nicht konfiguriert" | `js/service-config.js` URL gesetzt? Webseite neu deployt? |
| Jellyfin-Sorge | Es wurde nichts am `jellyfin`-Eintrag geändert — nur `send`-Einträge neu hinzugefügt. Alles getrennt. |

## Laufender Betrieb

- **Live-Logs:** `npx wrangler tail`
- **Switch löschen (Daten weg):** Owner ruft `POST /api/delete` mit seinem `manage_token` auf (oder über die App).
- Der Cron läuft automatisch **jede Stunde** — du musst nichts weiter tun.

> Sag mir morgen einfach Bescheid, an welchem Schritt du bist — dann gehen wir es zusammen durch.
