export const REVISION = 'executive-assistant-browser-poc-v1';
export const tables = ['app_meta','tasks','commitments','contacts','notes','reminders','inbox_items','task_commitments','task_contacts','task_notes','commitment_contacts','contact_notes'];

export const seedSql = `
PRAGMA foreign_keys=ON;
CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT INTO app_meta VALUES ('schema_revision', '${REVISION}');
CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL CHECK(length(title) <= 200), description TEXT NOT NULL DEFAULT '', priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high')), due_at TEXT, status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','completed')), completed_at TEXT, recurrence TEXT NOT NULL DEFAULT 'none' CHECK(recurrence IN ('none','daily','weekly','monthly')), recurrence_until TEXT, source_task_id INTEGER REFERENCES tasks(id), is_sample INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE commitments (id INTEGER PRIMARY KEY, title TEXT NOT NULL CHECK(length(title) <= 200), kind TEXT NOT NULL DEFAULT 'other' CHECK(kind IN ('meeting','other')), starts_at TEXT NOT NULL, duration_minutes INTEGER CHECK(duration_minutes IS NULL OR duration_minutes > 0), location TEXT NOT NULL DEFAULT '', attendees TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','cancelled','completed')), is_sample INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE contacts (id INTEGER PRIMARY KEY, name TEXT NOT NULL CHECK(length(name) <= 160), email TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', organization TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT '', relationship_context TEXT NOT NULL DEFAULT '', is_sample INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE notes (id INTEGER PRIMARY KEY, title TEXT NOT NULL DEFAULT '', content TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'general' CHECK(kind IN ('general','preparation','follow_up')), commitment_id INTEGER REFERENCES commitments(id), is_sample INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE reminders (id INTEGER PRIMARY KEY, title TEXT NOT NULL CHECK(length(title) <= 200), remind_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'upcoming' CHECK(status IN ('upcoming','acknowledged','snoozed','dismissed')), task_id INTEGER REFERENCES tasks(id), commitment_id INTEGER REFERENCES commitments(id), is_sample INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, CHECK(NOT(task_id IS NOT NULL AND commitment_id IS NOT NULL)));
CREATE TABLE inbox_items (id INTEGER PRIMARY KEY, content TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processed','dismissed')), processed_type TEXT CHECK(processed_type IS NULL OR processed_type IN ('task','note','reminder')), processed_id INTEGER, is_sample INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE task_commitments (task_id INTEGER NOT NULL REFERENCES tasks(id), commitment_id INTEGER NOT NULL REFERENCES commitments(id), PRIMARY KEY(task_id,commitment_id));
CREATE TABLE task_contacts (task_id INTEGER NOT NULL REFERENCES tasks(id), contact_id INTEGER NOT NULL REFERENCES contacts(id), PRIMARY KEY(task_id,contact_id));
CREATE TABLE task_notes (task_id INTEGER NOT NULL REFERENCES tasks(id), note_id INTEGER NOT NULL REFERENCES notes(id), PRIMARY KEY(task_id,note_id));
CREATE TABLE commitment_contacts (commitment_id INTEGER NOT NULL REFERENCES commitments(id), contact_id INTEGER NOT NULL REFERENCES contacts(id), PRIMARY KEY(commitment_id,contact_id));
CREATE TABLE contact_notes (contact_id INTEGER NOT NULL REFERENCES contacts(id), note_id INTEGER NOT NULL REFERENCES notes(id), PRIMARY KEY(contact_id,note_id));
`;

export function validateDatabase(db) {
  const found = new Set(db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0]?.values.map(([name]) => name) || []);
  const missing = tables.filter((name) => !found.has(name));
  if (missing.length) throw new Error(`Unsupported Executive Assistant workspace: missing ${missing.join(', ')}`);
  const result = db.exec("SELECT value FROM app_meta WHERE key='schema_revision'");
  if (result[0]?.values?.[0]?.[0] !== REVISION) throw new Error('Unsupported Executive Assistant workspace revision');
  if (db.exec('PRAGMA integrity_check')[0]?.values?.[0]?.[0] !== 'ok') throw new Error('Workspace integrity check failed');
  if ((db.exec('PRAGMA foreign_key_check')[0]?.values || []).length) throw new Error('Workspace foreign-key check failed');
}
