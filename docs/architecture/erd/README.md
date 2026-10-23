# VAKA — Database ERD

## Overview

This directory contains the Entity-Relationship Diagram (ERD) documentation for the VAKA platform.

The database design covers user management, identity verification, task management, bidding, executor assignment, cancellation, financial transactions, recommendations, reviews, and operational events.

To improve readability, the ERD is provided as a complete diagram and five smaller domain-specific diagrams.

## ERD Diagrams

| Diagram | Description |
|---|---|
| [00 — Full ERD](00%20-%20Full%20ERD.svg) | Complete database schema and relationships |
| [01 — Identity & Verification](01%20-%20Identity%20%26%20Verification.svg) | Users, roles, executor profiles, identity verification, and audit logs |
| [02 — Matching & Recommendations](02%20-%20Matching%20%26%20Recommendations.svg) | Categories, skills, executor preferences, service areas, availability, recommendations, and price estimation |
| [03 — Tasks, Bids & Cancellation](03%20-%20Tasks%2C%20Bids%20%26%20Cancellation.svg) | Tasks, locations, bids, assignments, submissions, and cancellation management |
| [04 — Finance & Ledger](04%20-%20Finance%20%26%20Ledger.svg) | Escrow management, financial transactions, ledger accounts, and ledger entries |
| [05 — Reviews & Operations](05%20-%20Reviews%20%26%20Operations.svg) | Reviews, notifications, delivery records, and asynchronous event processing |

The domain-specific diagrams are recommended for detailed inspection. The Full ERD provides an overview of the relationships across the entire database.

## Key Design Decisions

### 1. Task Locations

A task can have multiple ordered locations, such as pickup and drop-off points.

- `task_locations.task_id` is no longer unique.
- `location_type` identifies the purpose of each location.
- `stop_order` determines the sequence of locations.
- Exact location information is intended to be accessible only to authorized users.

### 2. Task Reposting

Cancelled or expired tasks cannot be reopened directly.

- `CANCELLED` and `EXPIRED` are terminal states.
- Reposting creates a new task.
- `tasks.reposted_from_task_id` is a nullable self-referencing foreign key to `tasks.task_id`.
- This relationship preserves the connection between the original task and its replacement.

### 3. Executor Assignment

Each task can have at most one assignment under the current design.

- `assignments.task_id` is unique.
- `assignments.bid_id` is unique.
- `travel_started_at` records when the executor begins traveling.
- `work_started_at` records when the actual work begins.
- Travel and work start times are maintained separately to support cancellation rules.

The relationship between tasks and assignments is **1 : 0..1**.

### 4. Cancellation Management

The `cancellation_requests` table records cancellation-related information, including:

- The user requesting cancellation
- The execution stage when cancellation was requested
- The cancellation reason and decision status
- An escrow amount snapshot
- Executor compensation, employer refund, and platform fee amounts
- The applicable cancellation policy
- Request, resolution, and settlement timestamps

Cancellation records are connected to assignments to preserve the history of cancellation decisions.

### 5. Financial Transactions

Cancellation-related financial movements can be traced through the financial transaction records.

- `financial_transactions.cancellation_request_id` is a nullable foreign key.
- A cancellation request may be associated with multiple financial transactions.
- Financial transactions unrelated to cancellation do not require a cancellation reference.
- Financial history is preserved through transaction and ledger records.

### 6. Escrow Relationships

The escrow structure supports the financial handling of task assignments.

- `escrows.assignment_id` remains unique.
- An escrow may exist before its assignment is created.
- The relationship between assignments and escrows is **1 : 0..1**.
- Escrow status and ledger transactions are used to represent financial movements.

### 7. Reviews and Dispute Scope

The current ERD includes the `reviews` table for user ratings and feedback.

Dedicated dispute and arbitration tables are not included in this version.

### 8. Preserved Schema

All remaining tables, fields, key annotations, relationships, and documented constraints are preserved from the source inventory unless affected by the design decisions described above.

## Cancellation Enum Values

### `cancellation_requests.work_stage_at_request`

| Value | Description |
|---|---|
| `NOT_STARTED` | Cancellation requested before travel or work begins |
| `TRAVEL_STARTED` | Cancellation requested after the executor begins traveling |
| `WORK_STARTED` | Cancellation requested after the executor begins performing the task |

### `cancellation_requests.status`

| Value | Description |
|---|---|
| `REQUESTED` | Cancellation request submitted |
| `APPROVED` | Cancellation request approved |
| `REJECTED` | Cancellation request rejected |
| `SETTLED` | Cancellation-related settlement completed |

## Implementation Notes

- **Assignment uniqueness:** The `UNIQUE(task_id)` constraint in `assignments` enforces the current one-assignment-per-task policy. This decision must be reviewed before implementing database migrations if multiple historical or retry assignments need to be supported for the same task.
- **Task lifecycle:** Terminal task states must be respected when implementing status transitions.
- **Financial consistency:** Cancellation settlements and ledger operations must be handled with appropriate transactional consistency.
- **Data access:** Foreign key relationships, uniqueness rules, and access restrictions must be validated during implementation.
- **Schema evolution:** Database changes should be reflected in the ERD and managed through Django migrations.

## Source and Maintenance

The diagrams were created using [diagrams.net (Draw.io)](https://app.diagrams.net/).

The editable Draw.io source should be maintained alongside the exported SVG diagrams to support future updates.

Whenever the database schema changes, the relevant domain diagrams and the Full ERD should be updated to keep the documentation consistent with the implementation.