"""Read-only boundary for authoritative Escrow holds.

T3-03 integration point. The finance implementation must query a persisted,
trusted ledger/reservation record, not a client-provided status or a past Task
history event. Until that implementation ships, the gateway is fail-closed.
"""
from dataclasses import dataclass

from .lifecycle import EscrowStatus


@dataclass(frozen=True)
class VerifiedHeldReservation:
    """Snapshot returned ONLY by the trusted finance adapter.

    The dataclass itself is not cryptographic evidence; construction must
    follow an authoritative ledger check. Never deserialize from HTTP input.
    """

    task_reference: str
    bid_reference: str
    escrow_reference: str
    operation_reference: str
    state: EscrowStatus


def read_verified_held_reservation(*, task_id, bid_id):
    """Return a current verified reservation or None.

    FINANCE TODO: read the current escrow row for task_id and bid_id from the
    trusted ledger, verify it is HELD, and return VerifiedHeldReservation.
    It must reject stale/released/refunded/mismatched reservations. Do not
    call external payment HTTP APIs while holding the Task database row lock;
    use persisted local ledger state populated by a verified callback.

    Intentionally returns None until finance is integrated. This keeps
    production execution disabled rather than bypassing BR-05.
    """
    return None
