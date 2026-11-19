"""Independent escrow-state policy (FS §7.3).

This is an internal transition contract, NOT an implemented wallet or ledger.
Only a trusted finance/ledger service may issue confirmations consumed by Tasks.
"""
from dataclasses import dataclass
from enum import Enum


class EscrowStatus(str, Enum):
    INITIATED = "INITIATED"
    HELD = "HELD"
    RELEASED = "RELEASED"
    REFUNDED = "REFUNDED"
    PARTIALLY_SETTLED = "PARTIALLY_SETTLED"
    FAILED = "FAILED"


ESCROW_ALLOWED = {
    EscrowStatus.INITIATED: frozenset((EscrowStatus.HELD, EscrowStatus.FAILED)),
    EscrowStatus.HELD: frozenset((
        EscrowStatus.RELEASED, EscrowStatus.REFUNDED,
        EscrowStatus.PARTIALLY_SETTLED,
    )),
    EscrowStatus.RELEASED: frozenset(),
    EscrowStatus.REFUNDED: frozenset(),
    EscrowStatus.PARTIALLY_SETTLED: frozenset(),
    EscrowStatus.FAILED: frozenset(),
}


class InvalidEscrowTransition(ValueError):
    pass


@dataclass(frozen=True)
class EscrowSnapshot:
    state: EscrowStatus

    def transition(self, target: EscrowStatus) -> "EscrowSnapshot":
        if target not in ESCROW_ALLOWED[self.state]:
            raise InvalidEscrowTransition(f"{self.state.value} -> {target.value}")
        return EscrowSnapshot(target)


@dataclass(frozen=True)
class VerifiedFinancialEvent:
    """Trusted in-process adapter input. Never deserialize it from public JSON.

    The real wallet/ledger must verify references and idempotency before minting
    this event; fields alone are not cryptographic proof or a payment system.
    """
    state: EscrowStatus
    escrow_reference: str
    operation_reference: str
    idempotency_key: str
    task_reference: str
    bid_reference: str = ""

    def __post_init__(self):
        if not all((self.escrow_reference, self.operation_reference, self.idempotency_key, self.task_reference)):
            raise ValueError("Verified financial events require ledger identifiers.")
