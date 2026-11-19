"""Independent dispute policy. Exact dispute stages require product approval.

FS §7 requires separation of task, escrow and dispute state. FS defines
when task DISPUTED may resolve, but does not prescribe detailed case stages.
These internal stage names are provisional and are NOT public API values.
"""
from dataclasses import dataclass
from enum import Enum


class DisputeStatus(str, Enum):
    OPEN = "OPEN"
    UNDER_REVIEW = "UNDER_REVIEW"
    DECIDED = "DECIDED"
    CLOSED = "CLOSED"


DISPUTE_ALLOWED = {
    DisputeStatus.OPEN: frozenset((DisputeStatus.UNDER_REVIEW,)),
    DisputeStatus.UNDER_REVIEW: frozenset((DisputeStatus.DECIDED,)),
    DisputeStatus.DECIDED: frozenset((DisputeStatus.CLOSED,)),
    DisputeStatus.CLOSED: frozenset(),
}


class InvalidDisputeTransition(ValueError):
    pass


@dataclass(frozen=True)
class DisputeSnapshot:
    state: DisputeStatus

    def transition(self, target: DisputeStatus) -> "DisputeSnapshot":
        if target not in DISPUTE_ALLOWED[self.state]:
            raise InvalidDisputeTransition(f"{self.state.value} -> {target.value}")
        return DisputeSnapshot(target)
