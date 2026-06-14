// D1 data-access helpers for the AEGIS hosted switch.

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS switches (
    id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, manage_token TEXT NOT NULL,
    checkin_token TEXT NOT NULL, verify_token TEXT, status TEXT NOT NULL DEFAULT 'pending',
    interval_hours INTEGER NOT NULL, grace_hours INTEGER NOT NULL DEFAULT 24,
    reminder_hours INTEGER NOT NULL DEFAULT 12, reminder_stage INTEGER NOT NULL DEFAULT 0,
    last_checkin TEXT, message TEXT, evidence_url TEXT, created_at TEXT NOT NULL,
    verified_at TEXT, triggered_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS idx_switches_status ON switches(status)`,
  `CREATE INDEX IF NOT EXISTS idx_switches_checkin ON switches(checkin_token)`,
  `CREATE INDEX IF NOT EXISTS idx_switches_manage ON switches(manage_token)`,
  `CREATE INDEX IF NOT EXISTS idx_switches_verify ON switches(verify_token)`,
  `CREATE TABLE IF NOT EXISTS guardians (
    id TEXT PRIMARY KEY, switch_id TEXT NOT NULL, email TEXT NOT NULL,
    name TEXT, notified INTEGER NOT NULL DEFAULT 0)`,
  `CREATE INDEX IF NOT EXISTS idx_guardians_switch ON guardians(switch_id)`,
  `CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, switch_id TEXT, type TEXT, detail TEXT, at TEXT NOT NULL)`
];

let schemaReady = false;

export async function ensureSchema(db) {
  if (schemaReady) return;
  await db.batch(SCHEMA.map((sql) => db.prepare(sql)));
  schemaReady = true;
}

export function token(bytes = 24) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createSwitch(db, s) {
  await db
    .prepare(
      `INSERT INTO switches (id, owner_email, manage_token, checkin_token, verify_token,
        status, interval_hours, grace_hours, reminder_hours, reminder_stage,
        message, evidence_url, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,0,?,?,?)`
    )
    .bind(
      s.id, s.owner_email, s.manage_token, s.checkin_token, s.verify_token,
      'pending', s.interval_hours, s.grace_hours, s.reminder_hours,
      s.message, s.evidence_url, s.created_at
    )
    .run();
}

export async function addGuardians(db, switchId, guardians) {
  if (!guardians.length) return;
  const stmts = guardians.map((g) =>
    db
      .prepare(`INSERT INTO guardians (id, switch_id, email, name, notified) VALUES (?,?,?,?,0)`)
      .bind(token(8), switchId, g.email, g.name || null)
  );
  await db.batch(stmts);
}

export async function getBy(db, field, value) {
  const allowed = ['verify_token', 'checkin_token', 'manage_token', 'id'];
  if (!allowed.includes(field)) throw new Error('bad field');
  return db.prepare(`SELECT * FROM switches WHERE ${field} = ?`).bind(value).first();
}

export async function getGuardians(db, switchId) {
  const r = await db.prepare(`SELECT * FROM guardians WHERE switch_id = ?`).bind(switchId).all();
  return r.results || [];
}

export async function updateSwitch(db, id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const set = keys.map((k) => `${k} = ?`).join(', ');
  await db
    .prepare(`UPDATE switches SET ${set} WHERE id = ?`)
    .bind(...keys.map((k) => fields[k]), id)
    .run();
}

export async function markGuardianNotified(db, id) {
  await db.prepare(`UPDATE guardians SET notified = 1 WHERE id = ?`).bind(id).run();
}

export async function activeSwitches(db) {
  const r = await db
    .prepare(`SELECT * FROM switches WHERE status = 'active' AND last_checkin IS NOT NULL`)
    .all();
  return r.results || [];
}

export async function logEvent(db, switchId, type, detail) {
  await db
    .prepare(`INSERT INTO events (switch_id, type, detail, at) VALUES (?,?,?,?)`)
    .bind(switchId, type, detail || null, new Date().toISOString())
    .run();
}
