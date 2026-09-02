# Executive Assistant Architecture

## Scope and principles

This is a single-user, local FastAPI application using server-rendered Jinja2
templates, Bootstrap from its CDN, and SQLAlchemy over SQLite. All datetimes
are naive local values in the host timezone. There is no authentication,
external calendar, email, push notification, or background-worker integration.

## Project structure

```text
backend/
  main.py                 # FastAPI app, startup and route registration
  db.py                   # SQLite engine, session dependency, initialization
  models.py               # SQLAlchemy entities and association tables
  schemas.py              # request/response validation objects
  services/               # dashboard, recurrence, reminders, search, seed reset
  routers/                # dashboard, tasks, commitments, contacts, notes, inbox, search
  templates/              # base layout and feature pages/forms
  static/                 # local CSS/JS only when needed
docs/architecture.md
features/briefs/
```

Routers own HTTP concerns and validation; services own business rules and
transactions; models own persistence. Templates render view models and forms,
while browser JavaScript is limited to progressive enhancement.

## Data model

All tables have an integer primary key and `created_at`, `updated_at` local
datetime fields unless noted. Foreign keys use restrictive behavior by
default. Sample rows have `is_sample` and may be reset without touching user
rows.

### `tasks`

`id`, `title` (required), `description`, `priority` (`low|medium|high`),
`due_at` (nullable local datetime), `status` (`open|completed`),
`completed_at`, `recurrence` (`none|daily|weekly|monthly`),
`recurrence_until`, `source_task_id` (nullable self-reference), `is_sample`.
Completing a recurring task transactionally creates exactly one next open
occurrence when the next due date is within its recurrence limit.

### `commitments`

`id`, `title` (required), `kind` (`meeting|other`), `starts_at` (required),
`duration_minutes` (nullable positive integer), `location`, `attendees`,
`notes`, `status` (`scheduled|cancelled|completed`), `is_sample`.
Overlap warnings are advisory and compare intervals only when duration exists.

### `contacts`

`id`, `name` (required), `email`, `phone`, `organization`, `role`,
`relationship_context`, `is_sample`. Deletion is allowed only when no links
remain; otherwise the UI requires unlinking first.

### `notes`

`id`, `title`, `content` (required), `kind` (`general|preparation|follow_up`),
`commitment_id`, `is_sample`. Notes may additionally link to tasks and contacts
through association tables. Preparation and follow-up are distinct note kinds.

### `reminders`

`id`, `title`, `remind_at` (required), `status` (`upcoming|acknowledged|snoozed|dismissed`),
`task_id`, `commitment_id`, `is_sample`. Reminders are explicitly created;
dashboard queries also surface due/overdue responsibilities without creating
duplicate reminder rows. Acknowledge/dismiss affect only the reminder; snooze
requires and replaces `remind_at`.

### `inbox_items`

`id`, `content` (required), `status` (`pending|processed|dismissed`),
`processed_type` (`task|note|reminder`, nullable), `processed_id` (nullable),
`is_sample`. Dismissal is retained, never destructive.

Association tables: `task_commitments`, `task_contacts`, `task_notes`,
`commitment_contacts`, `commitment_tasks`, `contact_notes`, and
`reminder` links to at most one task or commitment. Unique pairs prevent
duplicates. Inbox processing and the resulting record are one transaction.

## HTTP contracts

HTML GET routes return pages; HTML POST routes validate form data, mutate in a
transaction, then redirect (PRG) with a flash message. Validation failures
return the form with field errors and HTTP 422. IDs are integers; missing rows
return 404.

| Method | Route | Purpose |
|---|---|---|
| GET | `/` | Dashboard: local today, overdue/open tasks, next 7 days commitments, pending inbox, reminders |
| GET/POST | `/tasks`, `/tasks/new` | List/filter and create tasks |
| GET/POST | `/tasks/{id}/edit` | Edit task |
| POST | `/tasks/{id}/complete` | Complete and, if recurring, create next occurrence |
| POST | `/tasks/{id}/postpone` | Require and set a new due date |
| GET/POST | `/commitments`, `/commitments/new` | List and create commitments; show overlap warnings |
| GET/POST | `/commitments/{id}/edit` | Edit commitment |
| POST | `/commitments/{id}/cancel`, `/commitments/{id}/complete` | Change status |
| GET/POST | `/contacts`, `/contacts/new` | List and create contacts |
| GET/POST | `/contacts/{id}/edit` | Edit contact |
| POST | `/contacts/{id}/delete` | Safe delete or validation error when linked |
| GET/POST | `/notes`, `/notes/new` | List and create typed notes |
| GET/POST | `/notes/{id}/edit` | Edit note and associations |
| GET/POST | `/inbox`, `/inbox/new` | Capture and edit pending items |
| POST | `/inbox/{id}/process` | Create selected task/note/reminder and mark processed |
| POST | `/inbox/{id}/dismiss` | Retain item with dismissed status |
| GET/POST | `/reminders`, `/reminders/{id}/snooze` | List and snooze reminders |
| POST | `/reminders/{id}/acknowledge`, `/reminders/{id}/dismiss` | Update reminder state |
| GET | `/search?q=&type=` | Case-insensitive search across all six record types |
| POST | `/seed/reset` | Transactionally replace only sample rows |

Search results are labeled by type and link to detail/edit pages. `type` is
optional and accepts `task`, `commitment`, `contact`, `note`, `reminder`, or
`inbox`.

## State flow and responsibilities

Forms submit to routers, routers validate and call services, services update
SQLAlchemy models in one transaction, and redirects cause templates to render
fresh state. The dashboard service computes local-day boundaries and the
seven-day inclusive horizon. The frontend must expose status, priority, due
state, recurrence, and sample labels, and must never imply synchronization or
external delivery. The backend is authoritative for validation, recurrence,
overlap detection, safe deletion, search, and seed reset.

## Cross-cutting rules

Use a shared local-clock utility for `today`, `now`, and date arithmetic.
Escape user content through Jinja defaults. Use POST for all mutations and
CSRF-ready form boundaries even though authentication is out of scope. Keep
database initialization and sample seeding idempotent on startup.
