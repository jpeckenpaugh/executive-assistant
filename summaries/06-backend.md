# Stage 06 — Backend Engineer

## Completed

Implemented the complete FastAPI/SQLAlchemy backend under `backend/`, organized
into database, models, validation helpers, services, routers, templates, and
static assets. It provides all architecture-contract routes, SQLite persistence,
associations, dashboard calculations, task recurrence, advisory commitment
overlap detection, safe contact deletion, inbox processing, reminders, search,
and idempotent sample seeding/reset.

## Decisions and caveats

- `task_commitments` is the canonical task/commitment association. The
  architecture's duplicate `commitment_tasks` name was intentionally omitted
  under the approved interpretation.
- Explicit reminder rows are actionable; dashboard responsibility lists do not
  synthesize duplicate reminders. Reminder tokens/external delivery are out of
  scope.
- Seed records are backend-authored, relative to local startup time, and marked
  `is_sample`. Reset deletes and recreates only sample records, retaining user
  rows.
- Forms accept local ISO-compatible datetime input. Validation errors return
  HTTP 422 with a clear server-side error; successful mutations use redirects
  and flash-style query messages.
