# Environment Notes

## Runtime

- Python 3.12 or a compatible newer Python 3 release is recommended.
- The application runs from a project-local `.venv` virtual environment.
- `install.sh` creates the virtual environment and installs the pinned Python
  dependencies from `requirements.txt`.
- `run.sh` starts the FastAPI application with Uvicorn at its default local
  address and enables reload for development.

## Stack assumptions

- FastAPI and Uvicorn provide the web runtime.
- Jinja2 provides server-rendered HTML templates.
- Bootstrap is loaded from its CDN; an internet connection is therefore useful
  for the browser to render the intended styling.
- SQLAlchemy provides database access to a local SQLite database.
- `python-multipart` supports HTML form submissions.

## Platform and data caveats

- The app is designed for one local user and does not require external
  services, authentication, calendar synchronization, email, or background
  notification workers.
- Dates and times use the host machine's local timezone and are stored as local
  SQLite datetimes. The Architect should preserve this convention when defining
  schemas and queries.
- The backend entry point expected by `run.sh` is `backend.main:app`.
- A local database file and runtime caches are ignored by Git.
