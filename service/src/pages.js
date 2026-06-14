// Minimal styled HTML pages returned by the Worker for link-based actions
// (verify / check-in / manage). Kept dependency-free.

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}

export function page(title, bodyHtml) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(title)} — AEGIS</title>
  <style>
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:radial-gradient(900px circle at 20% 0%,rgba(59,130,246,.12),transparent 55%),#0a0d12;
      font-family:Arial,Helvetica,sans-serif;color:#e8eaed;padding:24px}
    .card{max-width:480px;width:100%;background:#141924;border:1px solid rgba(255,255,255,.08);
      border-radius:18px;padding:32px;text-align:center;box-shadow:0 16px 48px rgba(0,0,0,.5)}
    .logo{font-size:20px;font-weight:700;letter-spacing:2px;color:#3b82f6;margin-bottom:18px}
    h1{font-size:22px;margin:0 0 10px}
    p{color:#8b92a5;line-height:1.6;margin:8px 0}
    .big{font-size:40px;margin-bottom:8px}
    code{background:#0a0d12;padding:2px 8px;border-radius:6px;color:#3b82f6;word-break:break-all}
    a.btn{display:inline-block;margin-top:18px;background:#3b82f6;color:#fff;text-decoration:none;
      padding:12px 22px;border-radius:10px;font-weight:600}
    .muted{color:#5a6178;font-size:13px}
  </style></head><body><div class="card">
  <div class="logo">🛡️ AEGIS</div>${bodyHtml}</div></body></html>`;
}

export function okPage(title, emoji, msg, extra) {
  return page(
    title,
    `<div class="big">${emoji}</div><h1>${esc(title)}</h1><p>${msg}</p>${extra || ''}`
  );
}

export { esc };
