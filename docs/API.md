# VAKA — API Reference and Integration Guide

## Source of truth

This document is a human-readable entry point, not a replacement for the generated specification. Generate the live contract from the backend and compare it with the checked-in OpenAPI export before releasing changes.

- Development Swagger UI: `http://127.0.0.1:8000/api/docs/`
- Machine-readable schema: `http://127.0.0.1:8000/api/schema/`
- ReDoc: `http://127.0.0.1:8000/api/redoc/`
- Health endpoint: `GET /api/health/`

Documented routes below are based on the newer `VAKA Platform API(1).yaml` supplied in November 2026. The backend ZIP supplied earlier predates some worker coverage/statistics changes; verify that the branch being deployed includes them.

## Authentication

Protected endpoints accept JWT Bearer tokens:

```http
Authorization: Bearer <access_token>
```

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register/` | Register and initiate phone verification |
| POST | `/api/auth/register/verify-otp/` | Verify registration OTP |
| POST | `/api/auth/login/password/` | Log in using phone and password |
| POST | `/api/auth/login/otp/send/` | Request login OTP |
| POST | `/api/auth/login/otp/verify/` | Log in with OTP |
| POST | `/api/auth/otp/resend/` | Resend OTP |
| POST | `/api/auth/token/refresh/` | Refresh access token |
| POST | `/api/auth/token/verify/` | Check token validity |

In the inspected settings, access tokens live 15 minutes. A `401` means credentials are missing or invalid/expired; a `403` generally indicates the authenticated account lacks the necessary permission or state.

## Task catalog and task lifecycle

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/task-categories/` | List active task categories |
| GET | `/api/task-categories/{category_id}/subcategories/` | List direct subcategories |
| GET | `/api/skills/` | List active catalog skills; optional `category_id` |
| GET | `/api/tasks/` | List the authenticated employer's own tasks |
| POST | `/api/tasks/` | Create an employer-owned `DRAFT` task |
| POST | `/api/tasks/{task_id}/publish/` | Validate and publish a draft to `OPEN` |
| GET | `/api/discovery/tasks/` | Paginated list of discoverable eligible tasks |
| GET | `/api/discovery/tasks/{task_id}/` | Discoverable task detail |
| GET | `/api/task-categories/{category_id}/tasks/` | Discoverable tasks directly under a category |

Example draft creation (illustrative; use a **real** active category UUID and future UTC timestamps):

```json
{
  "category_id": "<existing-active-category-uuid>",
  "title": "خرید و تحویل دسته گل",
  "description": "خرید یک دسته گل تازه و تحویل در تهران",
  "estimated_duration_minutes": 60,
  "wage_budget_amount": 350000,
  "item_cost_cap_amount": 2000000,
  "receipt_required": true,
  "execution_window_start_at": "2026-11-16T12:00:00Z",
  "execution_window_end_at": "2026-11-16T14:00:00Z",
  "deadline_at": "2026-11-16T14:00:00Z",
  "proposal_deadline_at": "2026-11-16T10:00:00Z",
  "delivery_criteria": "تحویل سالم همراه رسید",
  "required_skills": [],
  "locations": [{
    "location_type": "SERVICE",
    "stop_order": 1,
    "city": "Tehran",
    "region": "Vanak",
    "latitude": 35.7587,
    "longitude": 51.4113
  }]
}
```

The timestamps above illustrate **a historical test case**, not necessarily valid future dates when reading this document. Replace them with future values when testing.

After creation, use the returned `task_id` for publishing. An `OPEN` status means publication succeeded, but does not guarantee inclusion in discovery: expiration, own-task exclusions and other visibility checks still apply.

Discovery supports `category_id`, `city`, `region`, `latitude`, `longitude`, `radius_meters`, title/description/search, wage bounds, ordering, pagination, and page size. The radius is in **meters** here, unlike worker-profile `service_area_radius_km`.

## Bidding

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET / POST | `/api/offers/bids/` | List own submitted bids / submit a bid |
| GET / PATCH | `/api/offers/bids/{bid_id}/` | Read/update an owned bid |
| GET | `/api/offers/employer/bids/` | Employer's received bids |
| GET | `/api/offers/employer/bids/{bid_id}/` | Employer's bid detail |
| GET | `/api/offers/employer/tasks/{task_id}/bids/` | Bids on a particular owned task |

A bid must be from an eligible executor. The backend enforces one bid per executor per task and at most one accepted bid per task via database constraints.

## Current user's profile and worker setup

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET / PATCH | `/api/profile/me/` | Current user's profile |
| GET / POST | `/api/profile/me/skills/` | List/add worker skills |
| PATCH / DELETE | `/api/profile/me/skills/{worker_skill_id}/` | Update/delete worker skill |
| GET / PATCH | `/api/profile/me/preferences/` | Worker preferences |
| GET / PATCH | `/api/profile/me/service-area/` | City, region, map center, radius, citywide toggle |
| GET / POST | `/api/profile/me/service-area/neighborhoods/` | List/add selected neighborhood names |
| DELETE | `/api/profile/me/service-area/neighborhoods/{neighborhood_id}/` | Remove a saved neighborhood |
| GET / POST / PATCH | `/api/profile/me/availability/` | Read/add slots or update timezone |
| PATCH / DELETE | `/api/profile/me/availability/{availability_id}/` | Update/remove slot |
| GET | `/api/profile/me/statistics/` | Worker dashboard metrics |
| GET | `/api/profile/me/verification/` | Worker verification status |
| POST | `/api/profile/me/verification/documents/` | Upload verification document |
| POST | `/api/profile/me/verification/submit/` | Submit verification application |

### Worker coverage request examples

```http
PATCH /api/profile/me/service-area/
Content-Type: application/json
```

```json
{"service_area_city": "Tehran", "covers_entire_city": true}
```

```http
POST /api/profile/me/service-area/neighborhoods/
Content-Type: application/json
```

```json
{"name": "Vanak"}
```

Neighborhood names are selected by the client and stored as text. No authoritative city/neighborhood catalog or polygon validation is implied. Changing the stored city clears the previously selected neighborhoods; toggling whole-city coverage preserves them.

### Worker statistics response shape

```json
{
  "average_rating": null,
  "completed_tasks_count": 0,
  "received_offers_count": null,
  "submitted_bids_count": 0,
  "profile_completion_percent": 13
}
```

These are **example values**, not fixed outputs. `average_rating` and `received_offers_count` currently have no implemented source of truth and may return `null`. Completed tasks are provisionally counted from accepted bids on completed tasks; profile completion is an initial eight-check formula, not a finalized business policy.

## Administration

Admin worker-verification review routes live under `/api/admin/worker-verifications/` and support listing, retrieving, approving, rejecting and controlled document downloads. They concern **worker** verification, not admin approval of employer-created task publication.

Category management is exposed under `/api/manage/task-categories/` with permissions documented in the live schema.

## Errors and client integration

- `200` successful read/action; `201` created; `204` deleted with no response body.
- `400` invalid input; `401` absent/invalid authentication; `403` forbidden; `404` missing/not accessible; `409` conflicting task publication state.
- Client should display API validation errors rather than assume creation or publication succeeded.
- Keep access tokens out of logs, Git commits, issue trackers and screenshots.
- Use the generated OpenAPI spec for exact request/response fields and security requirements.
