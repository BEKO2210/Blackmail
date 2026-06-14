-- AEGIS hosted Dead Man's Switch — D1 schema
-- Apply with: wrangler d1 execute aegis --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS switches (
  id              TEXT PRIMARY KEY,
  owner_email     TEXT NOT NULL,
  manage_token    TEXT NOT NULL,
  checkin_token   TEXT NOT NULL,
  verify_token    TEXT,
  -- pending | active | paused | triggered | deleted
  status          TEXT NOT NULL DEFAULT 'pending',
  interval_hours  INTEGER NOT NULL,
  grace_hours     INTEGER NOT NULL DEFAULT 24,
  reminder_hours  INTEGER NOT NULL DEFAULT 12,
  -- 0 none, 1 approaching sent, 2 overdue sent, 3 triggered
  reminder_stage  INTEGER NOT NULL DEFAULT 0,
  last_checkin    TEXT,
  message         TEXT,
  evidence_url    TEXT,
  created_at      TEXT NOT NULL,
  verified_at     TEXT,
  triggered_at    TEXT
);
CREATE INDEX IF NOT EXISTS idx_switches_status ON switches(status);
CREATE INDEX IF NOT EXISTS idx_switches_checkin ON switches(checkin_token);
CREATE INDEX IF NOT EXISTS idx_switches_manage ON switches(manage_token);
CREATE INDEX IF NOT EXISTS idx_switches_verify ON switches(verify_token);

CREATE TABLE IF NOT EXISTS guardians (
  id         TEXT PRIMARY KEY,
  switch_id  TEXT NOT NULL,
  email      TEXT NOT NULL,
  name       TEXT,
  notified   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_guardians_switch ON guardians(switch_id);

CREATE TABLE IF NOT EXISTS events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  switch_id  TEXT,
  type       TEXT,
  detail     TEXT,
  at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_switch ON events(switch_id);
