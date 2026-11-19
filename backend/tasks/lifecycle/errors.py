"""Domain errors with stable API status and machine-readable codes."""
from rest_framework.exceptions import APIException


class TaskTransitionConflict(APIException):
    status_code = 409
    default_code = "invalid_task_transition"
    default_detail = "Invalid task lifecycle transition."

    def __init__(self, *, source, target, reason):
        super().__init__({
            "code": "invalid_task_transition",
            "from_status": str(source),
            "to_status": str(target),
            "reason": reason,
        })
