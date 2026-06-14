// AEGIS hosted Dead Man's Switch — Cloudflare Worker
// Endpoints (fetch) + hourly escalation (scheduled).
//
//   POST /api/switch        create a switch  -> sends verification email
//   GET  /verify?token=     verify + activate owner email
//   GET  /checkin?token=    reset the timer (one click, no login)
//   POST /api/checkin       JSON { token }
//   GET  /manage?token=     status page
//   POST /api/pause         JSON { token }   (manage_token)
//   POST /api/resume        JSON { token }
//   POST /api/delete        JSON { token }
//   GET  /api/status?token= JSON status (manage_token)

import {
  ensureSchema, token, createSwitch, addGuardians, getBy, getGuardians,
  updateSwitch, markGuardianNotified, activeSwitches, logEvent
} from './db.js';
import {
  sendEmail, tplVerify, tplActive, tplReminder, tplTriggeredOwner, tplGuardian
} from './email.js';
import { okPage, page } from './pages.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS }
  });

const html = (body, status = 200) =>
  new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clampInt = (v, min, max, dflt) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return dflt;
  return Math.min(max, Math.max(min, n));
};

export default {
  async fetch(request, env) {
    try {
      await ensureSchema(env.DB);
    } catch (e) {
      console.error('schema error', e);
      return json({ ok: false, error: 'database not initialized' }, 500);
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    try {
      if (path === '/' || path === '/health') return json({ ok: true, service: 'aegis-switch' });
      if (path === '/api/switch' && request.method === 'POST') return createHandler(request, env);
      if (path === '/verify' && request.method === 'GET') return verifyHandler(url, env);
      if (path === '/checkin' && request.method === 'GET') return checkinPageHandler(url, env);
      if (path === '/api/checkin' && request.method === 'POST') return checkinApiHandler(request, env);
      if (path === '/manage' && request.method === 'GET') return manageHandler(url, env);
      if (path === '/api/status' && request.method === 'GET') return statusHandler(url, env);
      if (path === '/api/pause' && request.method === 'POST') return setStatusHandler(request, env, 'paused');
      if (path === '/api/resume' && request.method === 'POST') return setStatusHandler(request, env, 'active');
      if (path === '/api/delete' && request.method === 'POST') return deleteHandler(request, env);
      return json({ ok: false, error: 'not found' }, 404);
    } catch (e) {
      console.error('handler error', e);
      return json({ ok: false, error: 'internal error' }, 500);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runEscalation(env));
  }
};

// ─── Create ───
async function createHandler(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid JSON' }, 400);
  }

  const owner_email = String(body.owner_email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(owner_email)) return json({ ok: false, error: 'invalid owner email' }, 400);

  let guardians = Array.isArray(body.guardians) ? body.guardians : [];
  guardians = guardians
    .map((g) => ({ email: String(g.email || '').trim().toLowerCase(), name: (g.name || '').trim() }))
    .filter((g) => EMAIL_RE.test(g.email))
    .slice(0, 10);
  if (!guardians.length) return json({ ok: false, error: 'at least one valid guardian email required' }, 400);

  const message = String(body.message || '').slice(0, 5000);
  const evidence_url = String(body.evidence_url || '').trim().slice(0, 1000);
  if (evidence_url && !/^https?:\/\//i.test(evidence_url))
    return json({ ok: false, error: 'evidence_url must start with http(s)://' }, 400);

  const sw = {
    id: crypto.randomUUID(),
    owner_email,
    manage_token: token(24),
    checkin_token: token(24),
    verify_token: token(24),
    interval_hours: clampInt(body.interval_hours, 1, 8760, 48),
    grace_hours: clampInt(body.grace_hours, 0, 720, 24),
    reminder_hours: clampInt(body.reminder_hours, 0, 720, 12),
    message,
    evidence_url: evidence_url || null,
    created_at: new Date().toISOString()
  };

  await createSwitch(env.DB, sw);
  await addGuardians(env.DB, sw.id, guardians);
  await logEvent(env.DB, sw.id, 'created', `${guardians.length} guardians`);

  const mail = tplVerify(env, sw);
  const sent = await sendEmail(env, { to: owner_email, ...mail });

  return json({
    ok: true,
    message: 'Switch created. Check your email to verify and activate.',
    email_sent: sent.ok,
    email_error: sent.ok ? undefined : sent.error
  });
}

// ─── Verify ───
async function verifyHandler(url, env) {
  const t = url.searchParams.get('token') || '';
  const sw = await getBy(env.DB, 'verify_token', t);
  if (!sw) return html(okPage('Ungültiger Link', '⚠️', 'Dieser Bestätigungslink ist ungültig oder bereits benutzt.'), 404);

  if (sw.status === 'pending') {
    const now = new Date().toISOString();
    await updateSwitch(env.DB, sw.id, {
      status: 'active', verified_at: now, last_checkin: now, reminder_stage: 0, verify_token: null
    });
    await logEvent(env.DB, sw.id, 'verified', null);
    const active = { ...sw, last_checkin: now };
    await sendEmail(env, { to: sw.owner_email, ...tplActive(env, active) });
  }

  const checkin = `${env.APP_URL}/checkin?token=${sw.checkin_token}`;
  const manage = `${env.APP_URL}/manage?token=${sw.manage_token}`;
  return html(
    okPage(
      'Switch aktiv',
      '✅',
      `Dein Dead Man's Switch ist aktiv. Du musst dich alle <b>${sw.interval_hours} Stunden</b> melden. Wir haben dir die Links auch per E-Mail geschickt.`,
      `<a class="btn" href="${checkin}">Jetzt einchecken</a>
       <p class="muted" style="margin-top:18px">Verwaltungs-Link (sicher aufbewahren):<br><code>${manage}</code></p>`
    )
  );
}

// ─── Check-in (browser link) ───
async function checkinPageHandler(url, env) {
  const t = url.searchParams.get('token') || '';
  const sw = await getBy(env.DB, 'checkin_token', t);
  if (!sw) return html(okPage('Ungültiger Link', '⚠️', 'Dieser Check-in-Link ist ungültig.'), 404);
  if (sw.status === 'deleted') return html(okPage('Gelöscht', '⚠️', 'Dieser Switch wurde gelöscht.'), 410);

  const next = await doCheckin(env, sw);
  return html(
    okPage(
      'Eingecheckt',
      '🟢',
      `Alles klar! Dein nächster Check-in ist fällig am<br><b>${next}</b>.`,
      `<p class="muted" style="margin-top:14px">Du kannst diese Seite schließen. Lege dir diesen Link als Lesezeichen an.</p>`
    )
  );
}

async function checkinApiHandler(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid JSON' }, 400); }
  const sw = await getBy(env.DB, 'checkin_token', String(body.token || ''));
  if (!sw) return json({ ok: false, error: 'invalid token' }, 404);
  if (sw.status === 'deleted') return json({ ok: false, error: 'switch deleted' }, 410);
  const next = await doCheckin(env, sw);
  return json({ ok: true, next_due: next });
}

async function doCheckin(env, sw) {
  const now = new Date();
  await updateSwitch(env.DB, sw.id, {
    last_checkin: now.toISOString(),
    status: 'active',
    reminder_stage: 0
  });
  await logEvent(env.DB, sw.id, 'checkin', null);
  const next = new Date(now.getTime() + sw.interval_hours * 3600 * 1000);
  return next.toLocaleString('de-DE');
}

// ─── Manage page ───
async function manageHandler(url, env) {
  const t = url.searchParams.get('token') || '';
  const sw = await getBy(env.DB, 'manage_token', t);
  if (!sw) return html(okPage('Ungültiger Link', '⚠️', 'Dieser Verwaltungslink ist ungültig.'), 404);
  const guardians = await getGuardians(env.DB, sw.id);
  const next = sw.last_checkin
    ? new Date(new Date(sw.last_checkin).getTime() + sw.interval_hours * 3600 * 1000).toLocaleString('de-DE')
    : '—';

  const body = `
    <h1>Switch verwalten</h1>
    <p>Status: <b>${sw.status}</b></p>
    <p class="muted">Intervall: ${sw.interval_hours}h · Kulanz: ${sw.grace_hours}h · Guardians: ${guardians.length}</p>
    <p>Nächster Check-in fällig:<br><b>${next}</b></p>
    <a class="btn" href="${env.APP_URL}/checkin?token=${sw.checkin_token}">Jetzt einchecken</a>
    <p class="muted" style="margin-top:22px">Diese Aktionen kannst du per Verwaltungs-Link ausführen. Zum Pausieren, Fortsetzen oder Löschen nutze die App oder die API mit deinem Token.</p>`;
  return html(page('Verwalten', body));
}

async function statusHandler(url, env) {
  const sw = await getBy(env.DB, 'manage_token', url.searchParams.get('token') || '');
  if (!sw) return json({ ok: false, error: 'invalid token' }, 404);
  const guardians = await getGuardians(env.DB, sw.id);
  return json({
    ok: true,
    status: sw.status,
    interval_hours: sw.interval_hours,
    grace_hours: sw.grace_hours,
    last_checkin: sw.last_checkin,
    guardians: guardians.length,
    next_due: sw.last_checkin
      ? new Date(new Date(sw.last_checkin).getTime() + sw.interval_hours * 3600 * 1000).toISOString()
      : null
  });
}

async function setStatusHandler(request, env, newStatus) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid JSON' }, 400); }
  const sw = await getBy(env.DB, 'manage_token', String(body.token || ''));
  if (!sw) return json({ ok: false, error: 'invalid token' }, 404);
  if (sw.status === 'deleted') return json({ ok: false, error: 'switch deleted' }, 410);

  const fields = { status: newStatus };
  if (newStatus === 'active') {
    fields.last_checkin = new Date().toISOString();
    fields.reminder_stage = 0;
  }
  await updateSwitch(env.DB, sw.id, fields);
  await logEvent(env.DB, sw.id, newStatus, null);
  return json({ ok: true, status: newStatus });
}

async function deleteHandler(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'invalid JSON' }, 400); }
  const sw = await getBy(env.DB, 'manage_token', String(body.token || ''));
  if (!sw) return json({ ok: false, error: 'invalid token' }, 404);
  await updateSwitch(env.DB, sw.id, { status: 'deleted', message: null, evidence_url: null });
  await env.DB.prepare(`DELETE FROM guardians WHERE switch_id = ?`).bind(sw.id).run();
  await logEvent(env.DB, sw.id, 'deleted', null);
  return json({ ok: true });
}

// ─── Escalation (cron) ───
async function runEscalation(env) {
  await ensureSchema(env.DB);
  const switches = await activeSwitches(env.DB);
  const now = Date.now();

  for (const sw of switches) {
    const last = new Date(sw.last_checkin).getTime();
    const deadline = last + sw.interval_hours * 3600 * 1000;
    const triggerAt = deadline + sw.grace_hours * 3600 * 1000;
    const remindAt = deadline - sw.reminder_hours * 3600 * 1000;

    try {
      if (now >= triggerAt && sw.reminder_stage < 3) {
        // Fire the switch: notify all guardians, then the owner.
        const guardians = await getGuardians(env.DB, sw.id);
        for (const g of guardians) {
          if (g.notified) continue;
          const res = await sendEmail(env, { to: g.email, ...tplGuardian(env, sw, g) });
          if (res.ok) await markGuardianNotified(env.DB, g.id);
        }
        await sendEmail(env, { to: sw.owner_email, ...tplTriggeredOwner(env, sw) });
        await updateSwitch(env.DB, sw.id, {
          status: 'triggered', reminder_stage: 3, triggered_at: new Date().toISOString()
        });
        await logEvent(env.DB, sw.id, 'triggered', `${guardians.length} guardians notified`);
      } else if (now >= deadline && sw.reminder_stage < 2) {
        const hoursLeft = (triggerAt - now) / 3600000;
        await sendEmail(env, { to: sw.owner_email, ...tplReminder(env, sw, hoursLeft, true) });
        await updateSwitch(env.DB, sw.id, { reminder_stage: 2 });
        await logEvent(env.DB, sw.id, 'reminder_urgent', null);
      } else if (now >= remindAt && sw.reminder_stage < 1) {
        const hoursLeft = (deadline - now) / 3600000;
        await sendEmail(env, { to: sw.owner_email, ...tplReminder(env, sw, hoursLeft, false) });
        await updateSwitch(env.DB, sw.id, { reminder_stage: 1 });
        await logEvent(env.DB, sw.id, 'reminder', null);
      }
    } catch (e) {
      console.error('escalation error for switch', sw.id, e);
    }
  }
}

// Exported for unit testing of the timing logic.
export function computeAction(sw, now) {
  const last = new Date(sw.last_checkin).getTime();
  const deadline = last + sw.interval_hours * 3600 * 1000;
  const triggerAt = deadline + sw.grace_hours * 3600 * 1000;
  const remindAt = deadline - sw.reminder_hours * 3600 * 1000;
  if (now >= triggerAt && sw.reminder_stage < 3) return 'trigger';
  if (now >= deadline && sw.reminder_stage < 2) return 'urgent';
  if (now >= remindAt && sw.reminder_stage < 1) return 'remind';
  return 'none';
}
