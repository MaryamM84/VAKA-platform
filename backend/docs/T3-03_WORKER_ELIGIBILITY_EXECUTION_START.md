# T3-03 — Worker eligibility and guarded execution commencement

**Depends on:** T3-02 Task Lifecycle Engine and T3-03 Finance/Escrow integration.

## Already present in the project

Worker verification review, admin approve/reject, private verification documents,
worker bid eligibility and no self-bidding remain in their existing apps. This
change does not re-implement or loosen those rules.

## Changes in this patch

- Recheck executor account status, phone verification (through `User.is_active`),
  profile status, approval and EXECUTOR role **at final funding confirmation**.
- Expose `POST /api/tasks/{task_id}/start/` for the assigned worker.
- Authorize the actual accepted bid (not just any bid on the task).
- Use the T3-02 engine for `ASSIGNED -> IN_PROGRESS` and its transaction,
  row lock, version increment and `TaskStatusHistory` audit entry.
- Require a **current** verified `HELD` reservation for the exact task/bid;
  reject missing, mismatched or stale reservations with 409.
- Reject non-empty request bodies (including caller-supplied `escrow_status`).

### API contract

```
POST /api/tasks/{task_id}/start/
Authorization: Bearer <executor JWT>
Content-Type: application/json

{}
```

Success after finance integration:

```json
{"task_id": "<uuid>", "status": "IN_PROGRESS", "version": 2}
```

HTTP status: 200 on successful transition, 400 for unexpected body, 401
unauthenticated, 403 for unauthorized/ineligible workers, 404 unknown task,
409 for invalid task lifecycle or unavailable/not-held Escrow.

## IMPORTANT: Finance integration pending — production stays closed

`payments/hold_gateway.py` is deliberately an unimplemented **read-only
adapter** that returns `None`. Without an authoritative escrow service,
**even an ASSIGNED task cannot be started via the new HTTP endpoint**. This
is intentional: returning fake HELD would violate FS BR-05.

Finance team integration contract:

1. Persist Escrow reservation records, tied unambiguously to task and accepted
   bid; process provider callbacks securely and idempotently.
2. Implement `read_verified_held_reservation(task_id, bid_id)` to query the
   authoritative current persisted state. Return `None` if missing or not
   currently `HELD`; reject stale, released, refunded or mismatched entries.
3. Return a `VerifiedHeldReservation` instance with exact string IDs,
   `EscrowStatus.HELD`, and real nonempty escrow/operation references.
4. NEVER deserialize `VerifiedHeldReservation` from public JSON. Its dataclass
   type alone does not prove financial authenticity.
5. Avoid slow external network I/O while holding the Task database row lock;
   verify an already-persisted local ledger state in the same database.
6. Add end-to-end tests with the real persisted escrow implementation and
   provider callbacks. Current positive endpoint tests mock only the trusted
   read boundary.
7. Consider reservation release/reversal races and enforce a consistent
   lock/order or finance settlement invariant across the two domains.

## Source locations

| Area | File |
| --- | --- |
| Start route | `tasks/urls.py` |
| Start HTTP endpoint | `execution/views.py` |
| Transaction, guards and history | `execution/services.py` |
| Response schema | `execution/serializers.py` |
| Finance adapter / DTO | `payments/hold_gateway.py` |
| Recheck eligibility on assignment | `offers/employer_bid_decisions.py` |
| API and service tests | `tests/test_execution_start_api.py` |

## Tests

From `backend/`:

```powershell
python manage.py check
python manage.py makemigrations --check --dry-run
python manage.py test tests.test_execution_start_api tests.test_task_lifecycle_fs tests.test_offers tests.test_frontend_api_gaps --keepdb
python manage.py test tests --keepdb
```

No migration is introduced by this patch. Tests require the configured
PostgreSQL test database. Do not mark the real HELD integration checkbox
complete until the ledger adapter and real integration tests pass.
