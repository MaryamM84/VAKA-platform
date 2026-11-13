# VAKA — Testing Guide

## Environment

Backend tests use Django's test runner and Django REST Framework API test classes in `backend/tests/`. The service uses PostgreSQL and PostGIS-dependent location queries, so local tests require a correctly configured test database and extension support.

Prerequisites: Python 3.13, dependencies installed from `backend/requirements.txt`, database connection configured in `backend/.env`, and the test database user granted the needed permissions.

## Backend commands (from `backend/`)

```powershell
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py showmigrations
python manage.py test --keepdb
```

`--keepdb` reuses the test database to accelerate repeated runs. `-v 2` prints individual test names and results; use it for diagnosing failures.

### Focused test suites

```powershell
python manage.py test tests.test_auth_api tests.test_cors_security -v 2 --keepdb
python manage.py test tests.test_tasks_api tests.test_task_discovery tests.test_category_management -v 2 --keepdb
python manage.py test tests.test_offers -v 2 --keepdb
python manage.py test tests.test_worker_service_area tests.test_worker_service_neighborhoods -v 2 --keepdb
python manage.py test tests.test_worker_statistics tests.test_api_schema -v 2 --keepdb
```

The last two commands require the **new** neighborhood/statistics modules to exist in the current branch; they are not present in the earlier uploaded backend snapshot. Do not assume the suite is available on every branch.

### OpenAPI validation

```powershell
python manage.py spectacular --file schema.yaml
```

Review schema-generation warnings and compare new routes with expected `config/urls.py` and app URL patterns. Decide whether the generated file is an official checked-in artifact before adding it to Git.

## Frontend commands (from `frontend/`)

```powershell
npm install
npm run lint
npm run build
npm run dev
```

The frontend package scripts were verified in the supplied frontend archive. The build includes Next.js/TypeScript checks; no claim is made that full automated frontend unit/E2E coverage exists.

## Manual API smoke test

1. `GET /api/health/` returns a healthy application response.
2. Register/login using a local test account; obtain a fresh JWT access token.
3. Create a task with a **different employer account** using `POST /api/tasks/`; assert `201` and `status: DRAFT`.
4. Publish that task with the employer token using `POST /api/tasks/{task_id}/publish/`; assert `200` and `status: OPEN`.
5. Sign in as a **separate approved executor** and call `GET /api/discovery/tasks/` without filters. Confirm the task appears only if its deadlines and other visibility conditions remain valid.
6. Submit a bid as the executor; check employer-side bid visibility with an employer token.
7. Exercise worker skill, service-area, neighborhood and statistics endpoints on a branch that includes them.

**HTTP interpretation:** `401` means login token is missing or invalid; `403` means permissions/eligibility fail; `200` with an empty discovery `results` array means no matching visible tasks. Do not paste live JWTs into PRs, chat screenshots or test reports.

## Regression cases to cover

- Authentication: missing token, invalid/expired token, password/OTP rate limits, Basic authentication rejected if disabled.
- Roles: a worker cannot create employer tasks unless also granted employer role; users cannot read private records owned by another user.
- Tasks: valid draft, invalid input, only owner can publish, publish once, status history, future/expired deadlines, multiple ordered locations.
- Discovery: hides draft, cancelled, expired and own tasks; filters by category, location and radius; avoids leaking private coordinates.
- Bids: eligible executor, one bid per task/executor, employer ownership, bid updates.
- Coverage: citywide flag, name duplication, city change, unowned-neighborhood deletion.
- API schema: paths and response structures match the implementation.

## Test result reporting

For each pull request, record the actual command, run date, total tests and failures. Do **not** tick a passed box unless it passed on the current branch.

```markdown
### Test evidence
- [ ] `python manage.py check`
- [ ] `python manage.py makemigrations --check --dry-run`
- [ ] `python manage.py test --keepdb`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] OpenAPI schema reviewed
```

A previously shared test log had 355 tests, 8 errors and 1 failure caused by task-test fixture/import mixing and an incorrect invalid-token assertion. Replacement test files were prepared, but **a clean complete rerun has not been provided**; the current branch should be retested before merging.

## Data hygiene

Use synthetic test users, disposable test passwords and the automatically managed test database. Never run destructive cleanup against a production database. Avoid checking in `.env`, JWT access/refresh tokens, real user addresses or private identity documents.
