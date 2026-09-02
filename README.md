# Executive Assistant

A local, single-user web app for organizing daily responsibilities, priorities,
commitments, meetings, follow-ups, contacts, notes, reminders, and quick-capture
items in one place.

## Current status

The initial build has completed the concept, feature, environment, architecture,
backend, and frontend stages. The backend is FastAPI with SQLAlchemy and SQLite;
the interface is server-rendered with Jinja2 and Bootstrap from a CDN.

Formal verification has not completed yet. Known items to check include reminder
visibility on related detail pages and the presentation of HTTP 422 validation
responses.

## Features

- Daily dashboard with priorities, overdue work, upcoming commitments, reminders,
  and quick actions.
- Task management with low/medium/high priority, due dates, postponement,
  completion, and daily/weekly/monthly recurrence.
- Meeting and other commitment tracking with cancellation, completion, and
  advisory overlap warnings.
- Meeting preparation and follow-up notes.
- Contact and relationship tracking.
- Quick-capture inbox with processing into tasks, notes, or reminders, or
  dismissal without destructive deletion.
- Unified case-insensitive search with record-type filtering.
- In-app reminders with acknowledge, snooze, and dismiss actions.
- Resettable sample data that preserves user-created records.

## Setup and run

Requirements: Python 3.12 or a compatible newer Python 3 release.

```bash
bash install.sh
bash run.sh
```

Then open `http://localhost:8000`. `install.sh` creates a project-local `.venv`
and installs pinned dependencies. `run.sh` starts `backend.main:app` with
Uvicorn reload enabled for development.

## Data and scope

The app stores data in a local SQLite database and is designed for one local
user. Authentication, external calendar synchronization, email delivery, push
notifications, and background workers are out of scope. Dates and times use the
host machine's local timezone.

## Project structure

```text
concept.md                 product seed
features/                  capabilities and behavioral briefs
docs/architecture.md       technical specification
backend/                   FastAPI app, models, services, routers, templates
requirements.txt           pinned Python dependencies
install.sh / run.sh        environment and startup scripts
summaries/                 stage handoff summaries
instructions/              build, enhancement, debug, and Stage Manager roles
```

See [docs/architecture.md](docs/architecture.md) for the data model and route
contracts. The workflow is documented in
`instructions/meta/00-stage-manager.md`.

## License

MIT. See [LICENSE](LICENSE).
