# Executive Assistant browser workspace POC

This is an isolated static-browser proof of concept. It replaces the FastAPI/
SQLAlchemy runtime with SQLite running in a Web Worker through `sql.js`, and
persists the workspace in the browser's Origin Private File System (OPFS).
The original `backend/` application is unchanged.

## Run

```sh
python3 poc-browser/serve.py --port 8012
```

Open <http://127.0.0.1:8012> in a current Chromium-based browser. No FastAPI
process is needed. `localhost` is an OPFS-compatible secure context.

## Boundaries

- The worker serializes reads and writes. A successful mutation is reported
  only after its SQLite snapshot has been written and closed in OPFS.
- First launch creates the current Executive Assistant schema and sample data
  in the browser. The server's `assistant.db` is not read or changed. Reset
  replaces sample records while retaining user-created records.
- Export creates a standard SQLite database. Import validates the expected
  POC schema, revision, SQLite integrity, and foreign keys before replacing
  the active workspace.
- This is a single-browser, single-tab POC. Browser storage can be cleared;
  use Export as a backup. Authentication, sync, notifications, migrations,
  and native SQLite OPFS VFS are outside scope.

## Implementation notes

The browser UI is intentionally new because the source app is Jinja-rendered,
not an existing SPA. The worker retains the source app's core domain rules:
task recurrence, commitment overlap warnings, guarded contact deletion,
atomic inbox processing, reminder link exclusivity, relationship tables, and
sample reset. The current browser schema revision is
`executive-assistant-browser-poc-v1`.
