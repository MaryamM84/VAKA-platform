"""GoF State: each concrete task state owns its legal outgoing edges.

Authoritative transitions: FS Software, §7.2 (not the provisional ERD).
The transition engine adds event and finance guards to these structural rules.
"""
from abc import ABC, abstractmethod
from .errors import TaskTransitionConflict
from tasks.choices import TaskStatus


class TaskState(ABC):
    code: str

    @abstractmethod
    def allowed_targets(self) -> frozenset[str]:
        """Valid next task states in the Functional Specification."""

    def validate(self, target: str) -> None:
        if target not in self.allowed_targets():
            raise TaskTransitionConflict(
                source=self.code,
                target=target,
                reason="The requested state change is not allowed by FS §7.2.",
            )


class DraftState(TaskState):
    code = TaskStatus.DRAFT
    def allowed_targets(self):
        return frozenset((TaskStatus.OPEN, TaskStatus.CANCELLED))


class OpenState(TaskState):
    code = TaskStatus.OPEN
    def allowed_targets(self):
        return frozenset((TaskStatus.FUNDING_PENDING, TaskStatus.CANCELLED, TaskStatus.EXPIRED))


class FundingPendingState(TaskState):
    code = TaskStatus.FUNDING_PENDING
    def allowed_targets(self):
        return frozenset((TaskStatus.ASSIGNED, TaskStatus.OPEN))


class AssignedState(TaskState):
    code = TaskStatus.ASSIGNED
    def allowed_targets(self):
        return frozenset((TaskStatus.IN_PROGRESS, TaskStatus.CANCELLATION_REVIEW))


class InProgressState(TaskState):
    code = TaskStatus.IN_PROGRESS
    def allowed_targets(self):
        return frozenset((TaskStatus.SUBMITTED, TaskStatus.CANCELLATION_REVIEW))


class SubmittedState(TaskState):
    code = TaskStatus.SUBMITTED
    def allowed_targets(self):
        return frozenset((TaskStatus.APPROVED, TaskStatus.DISPUTED))


class ApprovedState(TaskState):
    code = TaskStatus.APPROVED
    def allowed_targets(self):
        return frozenset((TaskStatus.COMPLETED,))


class DisputedState(TaskState):
    code = TaskStatus.DISPUTED
    def allowed_targets(self):
        return frozenset((TaskStatus.COMPLETED, TaskStatus.CANCELLED))


class CancellationReviewState(TaskState):
    code = TaskStatus.CANCELLATION_REVIEW
    def allowed_targets(self):
        return frozenset((TaskStatus.CANCELLED, TaskStatus.DISPUTED))


class CompletedState(TaskState):
    code = TaskStatus.COMPLETED
    def allowed_targets(self):
        return frozenset()


class CancelledState(TaskState):
    code = TaskStatus.CANCELLED
    def allowed_targets(self):
        return frozenset()


class ExpiredState(TaskState):
    code = TaskStatus.EXPIRED
    def allowed_targets(self):
        return frozenset()


TASK_STATES: dict[str, TaskState] = {
    state.code: state
    for state in (
        DraftState(), OpenState(), FundingPendingState(), AssignedState(),
        InProgressState(), SubmittedState(), ApprovedState(), DisputedState(),
        CancellationReviewState(), CompletedState(), CancelledState(), ExpiredState(),
    )
}


def state_for(code: str) -> TaskState:
    try:
        return TASK_STATES[code]
    except KeyError:
        raise TaskTransitionConflict(
            source=code, target="UNKNOWN", reason="Unknown task state.",
        ) from None
