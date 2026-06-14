// Resend email delivery + templates for the AEGIS hosted switch.

export async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY) {
    console.error('RESEND_API_KEY not set — cannot send email to', to);
    return { ok: false, error: 'RESEND_API_KEY not configured' };
  }
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'AEGIS <onboarding@resend.dev>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html
    })
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    console.error('Resend error', resp.status, t);
    return { ok: false, error: `Resend HTTP ${resp.status}` };
  }
  return { ok: true };
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}

function layout(inner) {
  return `<!doctype html><html><body style="margin:0;background:#0a0d12;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#e8eaed">
  <div style="max-width:560px;margin:0 auto;background:#141924;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px">
    <div style="font-size:18px;font-weight:700;letter-spacing:2px;color:#3b82f6;margin-bottom:18px">🛡️ AEGIS</div>
    ${inner}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:24px 0">
    <div style="font-size:12px;color:#5a6178">AEGIS — Dead Man's Switch. Diese Nachricht wurde automatisch versendet.</div>
  </div></body></html>`;
}

function btn(href, label, color) {
  return `<a href="${esc(href)}" style="display:inline-block;background:${color || '#3b82f6'};color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">${esc(label)}</a>`;
}

export function tplVerify(env, sw) {
  const link = `${env.APP_URL}/verify?token=${sw.verify_token}`;
  return {
    subject: 'AEGIS — bestätige deinen Switch',
    html: layout(`
      <h2 style="margin:0 0 12px;font-size:20px">Bestätige deinen Dead Man's Switch</h2>
      <p style="color:#8b92a5;line-height:1.6">Klicke zum Aktivieren. Danach musst du dich alle <b>${sw.interval_hours} Stunden</b> melden. Tust du das nicht, werden deine Guardians automatisch benachrichtigt.</p>
      <p style="margin:22px 0">${btn(link, 'Switch aktivieren')}</p>
      <p style="color:#5a6178;font-size:13px;word-break:break-all">Falls der Button nicht geht: ${esc(link)}</p>
      <p style="color:#5a6178;font-size:13px">Hast du das nicht angefordert? Ignoriere diese E-Mail.</p>`)
  };
}

export function tplActive(env, sw) {
  const checkin = `${env.APP_URL}/checkin?token=${sw.checkin_token}`;
  const manage = `${env.APP_URL}/manage?token=${sw.manage_token}`;
  return {
    subject: 'AEGIS — dein Switch ist aktiv',
    html: layout(`
      <h2 style="margin:0 0 12px;font-size:20px">✅ Dein Switch ist aktiv</h2>
      <p style="color:#8b92a5;line-height:1.6">Melde dich alle <b>${sw.interval_hours} Stunden</b>. Wir erinnern dich rechtzeitig per E-Mail. Speichere dir diese beiden Links:</p>
      <p style="margin:22px 0">${btn(checkin, 'Jetzt einchecken', '#10b981')}</p>
      <p style="margin:14px 0">${btn(manage, 'Switch verwalten', '#1a2033')}</p>
      <p style="color:#5a6178;font-size:13px">Bewahre besonders den Verwaltungs-Link sicher auf — wer ihn hat, kann den Switch steuern.</p>`)
  };
}

export function tplReminder(env, sw, hoursLeft, urgent) {
  const checkin = `${env.APP_URL}/checkin?token=${sw.checkin_token}`;
  return {
    subject: urgent ? '🔴 AEGIS — Check-in überfällig!' : '⚠️ AEGIS — bitte einchecken',
    html: layout(`
      <h2 style="margin:0 0 12px;font-size:20px">${urgent ? '🔴 Dein Check-in ist überfällig' : '⚠️ Check-in fällig'}</h2>
      <p style="color:#8b92a5;line-height:1.6">${
        urgent
          ? `Du bist über deine Frist. In <b>${Math.max(0, Math.round(hoursLeft))} Stunden</b> werden deine Guardians automatisch benachrichtigt.`
          : `Deine nächste Frist ist in etwa <b>${Math.max(0, Math.round(hoursLeft))} Stunden</b>.`
      }</p>
      <p style="margin:22px 0">${btn(checkin, 'Jetzt einchecken', urgent ? '#ef4444' : '#3b82f6')}</p>`)
  };
}

export function tplTriggeredOwner(env, sw) {
  return {
    subject: 'AEGIS — Switch ausgelöst, Guardians benachrichtigt',
    html: layout(`
      <h2 style="margin:0 0 12px;font-size:20px">🚨 Dein Switch wurde ausgelöst</h2>
      <p style="color:#8b92a5;line-height:1.6">Du hast dich nicht rechtzeitig gemeldet. Deine Guardians wurden soeben automatisch benachrichtigt. Falls das ein Fehler war, kontaktiere sie umgehend.</p>`)
  };
}

export function tplGuardian(env, sw, guardian) {
  return {
    subject: '🚨 AEGIS — eine wichtige Nachricht wurde dir anvertraut',
    html: layout(`
      <h2 style="margin:0 0 12px;font-size:20px">Du wurdest als Guardian benachrichtigt</h2>
      <p style="color:#8b92a5;line-height:1.6">Hallo${guardian.name ? ' ' + esc(guardian.name) : ''}, <b>${esc(sw.owner_email)}</b> hat einen AEGIS Dead Man's Switch eingerichtet und sich nicht mehr rechtzeitig gemeldet. Gemäß den Anweisungen erhältst du jetzt diese Nachricht:</p>
      <div style="background:#0a0d12;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:16px;margin:18px 0;white-space:pre-wrap;line-height:1.6">${esc(sw.message) || '<i style="color:#5a6178">(keine Nachricht hinterlegt)</i>'}</div>
      ${sw.evidence_url ? `<p style="margin:18px 0">${btn(sw.evidence_url, 'Hinterlegte Daten öffnen')}</p>` : ''}
      <p style="color:#5a6178;font-size:13px;line-height:1.6">Bitte handle verantwortungsvoll und gemäß den Absprachen mit der Person.</p>`)
  };
}
