# VAKA — Business Rules

This document distinguishes **implemented behavior** confirmed in backend source and the supplied OpenAPI file from **open product decisions**. Proposed behavior must not be presented as a working API until implemented and tested.

## 1. Account and role rules

- The account uses a phone-based identity with password and OTP login/verification flows.
- API access requires suitable authentication. Protected endpoints return `401` if credentials are absent or invalid.
- Operations may require the `EMPLOYER` or `EXECUTOR` role. A user can have multiple role assignments.
- Employer task creation and publication require an authenticated active user with the employer role.
- An executor's profile may have verification status `APPROVED`, along with an active profile state; executor-specific discovery and bid operations enforce eligibility.
- Worker identity verification is not the same as phone verification. An approved worker does not imply an implemented employer-identity-verification workflow.

## 2. Task creation

1. An authenticated employer submits `POST /api/tasks/`.
2. The server assigns the employer and initial status `DRAFT`; clients cannot self-declare ownership/status.
3. The task and its required skills and ordered locations are saved together as part of a transactional operation.
4. Task status history records the creation event.

The frontend wizard may save the task draft, but **draft creation is not publication**.

## 3. Task publication

- `POST /api/tasks/{task_id}/publish/` can only publish a `DRAFT` owned by the authenticated employer.
- Repeated publication or publication of another non-draft state is rejected; the service uses a database row lock and transaction.
- Publication checks a non-blank title, description and delivery criteria; active category; estimated duration 1–300 minutes; non-negative wage and item cap; end time later than start; and a non-null proposal deadline.
- On success, status transitions from `DRAFT` to `OPEN`; the server sets `published_at`, increments version and records status history.
- **No separate admin-approval step is present in this implemented publication path.**
- **Known gap:** the inspected publish service validates time ordering but does not require the proposal/execution deadlines to be later than the publication time. An already-expired task can therefore become `OPEN` yet remain invisible in discovery.

## 4. Discovery visibility

- Discovery requires an authenticated caller and discovery-specific authorization.
- `GET /api/discovery/tasks/` only shows eligible `OPEN`, published, non-expired tasks in active categories.
- A caller cannot discover their own tasks in this view.
- Optional filters include category, city, region, geospatial radius, budget range, title/description/search, ordering and pagination.
- A valid `200` response with `results: []` means no tasks matched visibility rules and filters; it is not the same as `401`.
- `OPEN` alone does **not** guarantee visibility.

## 5. Bids

- An eligible executor may submit a bid on an appropriate open task.
- Each executor may submit at most one bid on the same task (`UNIQUE(task, executor_profile)`).
- A task may have at most one accepted bid (conditional uniqueness constraint).
- Bid wage must not be negative; proposed duration must be 1–300 minutes.
- Employers can view bids only for tasks they own; executors can access their own bids.
- The inspected code does not yet implement the full assignment, completion, escrow or settlement workflows shown in the proposed ERD.

## 6. Worker skills and service coverage

- Workers choose skills from the skill catalog and can manage their own skill records.
- The service area stores one selected city/region plus optional latitude/longitude/radius as a coherent group.
- The newer coverage change provides `covers_entire_city` and a list of selected neighborhood names. A city must be set before enabling whole-city coverage or adding neighborhoods.
- Duplicated neighborhood names (case-insensitive) are rejected. A worker cannot remove someone else's selected neighborhood.
- Changing the city removes the old city's saved neighborhood selections; switching city-wide coverage on/off does not remove them.
- These settings **store worker preferences**; they do not yet automatically filter/match every available task by neighborhood boundaries.

## 7. Worker statistics (provisional contract)

- `submitted_bids_count`: number of bids submitted by this worker.
- `completed_tasks_count`: provisional count of tasks marked `COMPLETED` with this worker's bid `ACCEPTED`; revisit when assignment/completion models are implemented.
- `average_rating`: `null` while review data is unavailable.
- `received_offers_count`: `null` while a received-offer workflow for executors is undefined.
- `profile_completion_percent`: initial equal-weight checklist, not a final product acceptance rule.

## 8. Open questions / product decisions

These require explicit agreement before implementation:

- Must an admin approve employer tasks before publication? Currently **no**; changing this requires a review state, permissions and endpoints.
- How should expired deadlines be rejected at task creation/publish time?
- What is the authoritative neighborhood catalog and geographic boundary source?
- Should discovery automatically apply the worker's city, neighborhood and radius settings?
- What is the final source of truth for completed jobs, ratings, invitations and profile completeness?
- When will employer identity verification, assignments, payments, reviews and cancellation settlement be implemented?

## Related references

- `backend/tasks/services.py`, `backend/tasks/views.py`, `backend/tasks/permissions.py`
- `backend/offers/models.py`, `backend/offers/views.py`
- `backend/accounts/models.py`, worker profile/verification views
- `docs/API.md`, `docs/DATABASE.md`
