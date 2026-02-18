# 🛡️ AEGIS — Dead Man's Switch

**Clientseitig verschlüsselter Dead Man's Switch mit Shamir's Secret Sharing**

AEGIS schützt deine Informationen und gibt sie automatisch frei, wenn du dich nicht mehr melden kannst. Alles läuft im Browser — kein Server, keine Accounts, kein Vertrauen nötig.

## Features

- **AES-256-GCM Verschlüsselung** — Militärgrad, direkt im Browser via Web Crypto API
- **Shamir's Secret Sharing** — Schlüssel wird in Fragmente aufgeteilt (M-von-N)
- **Dead Man's Switch** — Regelmäßiges Check-in hält das System still
- **Duress-Code** — Geheimer Notfall-Code signalisiert Guardians heimlich Zwang
- **Proof of Existence** — SHA-256 Hash als Existenzbeweis
- **Metadata Stripping** — Automatische EXIF/GPS-Bereinigung bei Bildern
- **100% Offline-fähig** — Kein Backend, kein Server, keine Datenbank

## Architektur

```
aegis/
├── index.html              ← Landing Page
├── app/
│   ├── setup.html          ← Einrichtungs-Wizard
│   ├── checkin.html         ← Check-in mit Token-Generierung
│   ├── guardian.html        ← Guardian-Dashboard & Entschlüsselung
│   └── verify.html          ← Proof of Existence Verifizierung
├── js/
│   ├── crypto.js            ← AES-256, PBKDF2, SHA-256, Metadata Stripping
│   ├── shamir.js            ← Shamir's Secret Sharing (GF256)
│   └── checkin.js           ← Token-Generierung & Duress-Erkennung
├── css/
│   └── style.css            ← Design System
└── README.md
```

## Ablauf

1. **Setup:** Passphrase + Duress-Passphrase wählen → Beweise hochladen → Verschlüsselung → Guardian-Kits generieren
2. **Verteilen:** Guardian-Kits an Vertrauenspersonen verteilen, Proof-Hash veröffentlichen
3. **Check-in:** Regelmäßig Passphrase eingeben → Token an Guardians senden
4. **Eskalation:** Kein Check-in → Guardians führen Fragmente zusammen → Entschlüsselung

## Hosting auf GitHub Pages

```bash
# Repository erstellen und pushen
git init
git add .
git commit -m "AEGIS v1.0"
git remote add origin https://github.com/DEIN-USERNAME/aegis.git
git push -u origin main

# In GitHub: Settings → Pages → Source: main branch
```

## Sicherheit

- Keine externen Dependencies für Kryptografie (nur Web Crypto API)
- Keine Tracker, keine Analytics, keine externen Requests
- Alle Operationen clientseitig
- Open Source & auditierbar

## Lizenz

MIT — Frei nutzbar für alle.
