# Stage 06 — Backend Engineer

## Completed

Implemented the initial FastAPI/SQLAlchemy backend under `backend/`, including
the SQLite persistence model, idempotent relative sample seeding, dashboard,
collection views, task creation, and unified search. The app uses local naive
datetimes and server-rendered HTML with Bootstrap CDN styling.

## Decisions and caveats

- `task_commitments` is reserved as the canonical association-table direction;
  the current starter implementation keeps the first vertical slice focused on
  core persistence and list/create/search behavior.
- Explicit reminder rows are actionable; dashboard counts and open-task lists
  are advisory and do not synthesize duplicate reminders.
- Seed records are backend-authored and marked `is_sample`; the sample reset is
  transactional and only removes marked records. The backend includes the
  required action endpoints, collection/create flows, and POST edit handlers
  with basic per-record validation; edit pages provide the detail surface for
  the frontend stage to enhance.
- Form dates accept ISO-compatible local datetime strings.
