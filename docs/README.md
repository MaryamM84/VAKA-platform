# VAKA — Project Documentation

VAKA is a two-sided services platform where employers create tasks and executors discover tasks and submit bids. This directory documents **what exists in the application** separately from features that appear only in the proposed database diagrams.

> **Documentation baseline:** Backend snapshot and generated OpenAPI schema supplied in November 2026, plus the team's architecture and implementation notes. Verify the current branch before treating a feature as deployed. These documents are intended for review in a dedicated documentation PR.

## Documentation index

| File | Purpose |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System components, data flow, technical decisions, and planned modules |
| [API.md](API.md) | API entry points, authentication, task lifecycle, and worker profile endpoints |
| [DATABASE.md](DATABASE.md) | Implemented models, relationships, migrations, location storage, and ERD status |
| [BUSINESS_RULES.md](BUSINESS_RULES.md) | Current authorization and task/bid rules; proposed rules kept separate |
| [TESTING.md](TESTING.md) | Local checks, test commands, test data, and PR verification |
| [AI_USAGE.md](AI_USAGE.md) | AI-assistance disclosure template, review responsibilities, and safeguards |

## Repository layout

```text
VAKA-platform/
├── backend/              # Django, DRF, PostgreSQL, migrations and tests
├── frontend/             # Next.js App Router application
└── docs/                 # Project-level documentation
```

## Local development (Windows / PowerShell)

**Backend** — requires Python 3.13 and a configured PostgreSQL database, including the PostGIS functionality used by task-location operations:

```powershell
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
# Configure backend/.env with the database connection settings.
python manage.py migrate
python manage.py runserver
```

Development URLs:

- Backend health: `http://127.0.0.1:8000/api/health/`
- OpenAPI schema: `http://127.0.0.1:8000/api/schema/`
- Swagger UI: `http://127.0.0.1:8000/api/docs/`

**Frontend** — from another terminal:

```powershell
cd frontend
npm install
# Set NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000 in frontend/.env.local
npm run dev
```

Default frontend URL: `http://localhost:3000/`. The base URL depends on how the frontend request helper concatenates API paths; confirm it before changing configuration.

Do not commit `.env`, `.env.local`, passwords, access tokens, private verification documents, or other secrets.

## Key workflow

1. An employer creates a task with `POST /api/tasks/`; it is stored as `DRAFT`.
2. The owning employer publishes it with `POST /api/tasks/{task_id}/publish/`; a valid draft transitions to `OPEN`.
3. A permitted viewer retrieves eligible tasks with `GET /api/discovery/tasks/`.
4. An approved executor can submit a bid via `POST /api/offers/bids/`.

**Important:** Publishing is currently performed by the employer, not an admin reviewer. Discovery excludes the caller's own tasks and tasks that fail visibility/expiry conditions. Publication is a state change in the main database, not a transfer to a separate discovery database.

## Development workflow

- Create a focused branch from updated `main` (for example, `docs/project-documentation`).
- Use descriptive commits such as `docs: document task lifecycle`.
- Open a pull request to `main`; obtain another team member's review.
- Run backend tests and frontend checks relevant to the change.
- Keep descriptions in this folder aligned with **the latest source code and generated OpenAPI schema**.

Existing source notes in the supplied archive — `architecture/Technology-Stack.md`, `architecture/erd/`, `setup/backend-setup.md`, `frontend/task-creation-wizard.md`, and `strategy.md` — remain useful supporting documents and should not be deleted without review. Some describe intended future architecture rather than the present implementation.
