# 🛡️ AEGIS — Dead Man's Switch

**Clientseitig verschlüsselter Dead Man's Switch mit Shamir's Secret Sharing**

AEGIS schützt deine Informationen und gibt sie automatisch frei, wenn du dich nicht mehr melden kannst. Alles läuft im Browser — kein Server, keine Accounts, kein Vertrauen nötig.

> **Sprachen:** Die Oberfläche ist zweisprachig (Deutsch / Englisch), umschaltbar über den `EN / DE`-Button.

## Features

- **AES-256-GCM Verschlüsselung** — Militärgrad, direkt im Browser via Web Crypto API
- **PBKDF2 (600.000 Iterationen)** — starke Schlüsselableitung aus deiner Passphrase
- **Shamir's Secret Sharing** — Schlüssel wird in Fragmente aufgeteilt (M-von-N)
- **Dead Man's Switch** — Regelmäßiges Check-in hält das System still
- **Duress-Code** — Geheimer Notfall-Code signalisiert Guardians heimlich Zwang
- **Proof of Existence** — SHA-256 Hash als Existenzbeweis
- **Metadata Stripping** — Automatische EXIF/GPS-Bereinigung bei Bildern
- **Automatische Überwachung** — optionale GitHub-Action benachrichtigt Guardians bei ausbleibendem Check-in
- **100% Offline-fähig** — Kein Backend, kein Server, keine Datenbank

## Struktur

```
.
├── index.html          ← Landing Page
├── setup.html          ← Einrichtungs-Wizard
├── checkin.html        ← Check-in mit Token-Generierung
├── guardian.html       ← Guardian-Dashboard & Entschlüsselung
├── verify.html         ← Proof of Existence Verifizierung
├── howitworks.html     ← Erklärung
├── privacy.html        ← Datenschutz
├── imprint.html        ← Impressum
├── js/
│   ├── crypto.js       ← AES-256, PBKDF2, SHA-256, Metadata Stripping
│   ├── shamir.js       ← Shamir's Secret Sharing (GF256)
│   ├── checkin.js      ← Token-Generierung & Duress-Erkennung
│   ├── github-checkin.js ← Automatischer Heartbeat via GitHub API
│   ├── icons.js        ← SVG-Icon-System
│   ├── lang.js         ← Zweisprachigkeit (i18n)
│   └── main.js         ← Navigation & gemeinsame Hilfsfunktionen
├── i18n/
│   ├── de.json         ← Deutsche Texte
│   └── en.json         ← Englische Texte
├── css/style.css       ← Design System
├── heartbeat.json      ← Status für die Dead-Man's-Switch-Überwachung
└── .github/workflows/
    ├── deadman-check.yml ← Überwacht Check-ins, benachrichtigt Guardians
    └── pages.yml         ← Deployt die Seite automatisch auf GitHub Pages
```

## Zwei Betriebsarten

AEGIS bietet zwei Wege — du kannst sie kombinieren:

### 1. Selbstverwaltet (100% clientseitig, ohne Server)
Setup → Guardian-Kits verteilen → regelmäßig Check-in-Token an Guardians senden. Maximale Privatsphäre, aber Guardians müssen die Tokens selbst prüfen und im Ernstfall manuell handeln.

1. **Setup:** Passphrase + Duress-Passphrase wählen → Beweise hochladen → Verschlüsselung → Guardian-Kits generieren
2. **Verteilen:** Guardian-Kits an Vertrauenspersonen verteilen, Proof-Hash veröffentlichen
3. **Check-in:** Regelmäßig Passphrase eingeben → Token an Guardians senden
4. **Eskalation:** Kein Check-in → Guardians führen Fragmente zusammen → Entschlüsselung

### 2. Auto-Switch (gehosteter Dienst, aktive E-Mails — für alle nutzbar)
Die Seite **`protect.html`** („Auto-Switch"): Nutzer geben nur ihre E-Mail, ein Intervall und die E-Mail-Adressen ihrer Guardians ein. Ein gehosteter **Cloudflare Worker** prüft stündlich und **verschickt automatisch E-Mails** (Erinnerungen an den Nutzer, Benachrichtigungen an die Guardians, wenn ein Check-in ausbleibt). Guardians brauchen **kein** GitHub-Konto und keine App.

→ Der Betreiber richtet das Backend **einmal** ein: siehe **[`service/README.md`](service/README.md)**. Danach trägt er die Worker-URL in `js/service-config.js` ein, und der Dienst steht weltweit allen zur Verfügung.

> Hinweis: Der Auto-Switch nutzt bewusst einen Server (speichert E-Mails, Intervall, Nachricht), um aktiv mailen zu können. Hochsensible Beweise gehören weiterhin ins clientseitig verschlüsselte Paket — im Auto-Switch nur verlinken.

---

## 🚀 Deployment — So bringst du das System zum Laufen

Die App ist eine **rein statische Website** (HTML/CSS/JS, kein Build-Schritt). Du kannst sie überall hosten. Empfohlen wird **GitHub Pages**, weil dort auch die automatische Überwachung läuft.

### Option A — GitHub Pages (empfohlen, alles an einem Ort)

1. Dieses Repository zu deinem eigenen GitHub-Account **forken** (oder pushen).
2. In GitHub: **Settings → Pages → Build and deployment → Source: „GitHub Actions“** auswählen.
3. Fertig. Bei jedem Push auf `main` deployt der Workflow `pages.yml` die Seite automatisch.
   Deine URL: `https://DEIN-USERNAME.github.io/DEIN-REPO/`

> Die automatische Guardian-Benachrichtigung (`deadman-check.yml`) läuft hier ohne weitere Konfiguration alle 6 Stunden.

### Option B — Vercel

1. Auf [vercel.com](https://vercel.com) einloggen → **Add New… → Project**.
2. Das GitHub-Repository importieren.
3. Einstellungen: **Framework Preset = „Other“**, **Build Command = leer**, **Output Directory = `.`** (Punkt = Projektwurzel).
4. **Deploy** klicken. Vercel nutzt automatisch `vercel.json` (saubere URLs + Sicherheits-Header).

> Hinweis: Die automatische Überwachung (GitHub Actions) läuft weiterhin im GitHub-Repo — auch wenn das Frontend auf Vercel liegt. Beim Check-in wird `heartbeat.json` per GitHub-API ins Repo geschrieben, und die Action wertet das aus.

### Option C — Lokal / Offline

```bash
# Im Projektordner einen einfachen Webserver starten:
python3 -m http.server 8000
# Dann im Browser öffnen: http://localhost:8000
```

> Direktes Öffnen der HTML-Datei (`file://`) funktioniert eingeschränkt, weil die Sprachdateien per `fetch` geladen werden. Nutze daher einen lokalen Server.

---

## ⚙️ Automatische Überwachung aktivieren (optional)

Damit Guardians automatisch benachrichtigt werden, wenn du dich nicht meldest:

1. Auf GitHub ein **Fine-Grained Personal Access Token (PAT)** erstellen
   (Settings → Developer settings → Fine-grained tokens), beschränkt auf dein AEGIS-Repo,
   mit Berechtigung **Contents: Read and write**.
2. In AEGIS unter **Setup → „Automatische Überwachung“** Username, Repo, PAT und die
   GitHub-Benutzernamen deiner Guardians eintragen → **Verbindung testen → Speichern**.
3. Beim Check-in wird `heartbeat.json` aktualisiert. Bleibt das Check-in aus, erstellt die
   GitHub-Action eskalierende Issues und erwähnt (`@`) deine Guardians.

Das PAT wird **ausschließlich im `localStorage` deines Browsers** gespeichert und nur an `api.github.com` gesendet.

## Sicherheit

- Keine externen Dependencies für Kryptografie (nur Web Crypto API)
- Keine Tracker, keine Analytics
- Alle kryptografischen Operationen clientseitig
- Content-Security-Policy & Sicherheits-Header via `vercel.json`
- Open Source & auditierbar

## Lizenz

MIT — Frei nutzbar für alle.
