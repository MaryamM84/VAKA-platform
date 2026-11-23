"""Platform commission policy used when an escrow reservation is created."""

import os

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


BASIS_POINTS = 10_000
DEFAULT_PLATFORM_FEE_RATE_BPS = 1_000  # 10%, charged to the worker.


def get_platform_fee_rate_bps():
    """Return the configured commission rate as basis points.

    The default is 10%. The rate is copied to each EscrowReservation so later
    policy changes do not alter an already accepted task.
    """
    configured_rate = getattr(settings, "VAKA_PLATFORM_FEE_RATE_BPS", None)
    if configured_rate is None:
        configured_rate = os.getenv(
            "VAKA_PLATFORM_FEE_RATE_BPS",
            str(DEFAULT_PLATFORM_FEE_RATE_BPS),
        )
    try:
        rate = int(configured_rate)
    except (TypeError, ValueError) as exc:
        raise ImproperlyConfigured(
            "VAKA_PLATFORM_FEE_RATE_BPS must be an integer."
        ) from exc
    if isinstance(rate, bool) or not isinstance(rate, int):
        raise ImproperlyConfigured("VAKA_PLATFORM_FEE_RATE_BPS must be an integer.")
    if not 0 <= rate <= BASIS_POINTS:
        raise ImproperlyConfigured(
            "VAKA_PLATFORM_FEE_RATE_BPS must be between 0 and 10000."
        )
    return rate


def calculate_platform_fee_amount(labor_amount, rate_bps=None):
    """Calculate a worker-paid commission, rounded half up to one Rial."""
    if isinstance(labor_amount, bool) or not isinstance(labor_amount, int):
        raise ValueError("labor_amount must be an integer number of minor currency units.")
    if labor_amount < 0:
        raise ValueError("labor_amount cannot be negative.")

    rate = get_platform_fee_rate_bps() if rate_bps is None else rate_bps
    if isinstance(rate, bool) or not isinstance(rate, int) or not 0 <= rate <= BASIS_POINTS:
        raise ValueError("rate_bps must be an integer between 0 and 10000.")

    # Integer-only half-up rounding; monetary values remain integer Rials.
    return (labor_amount * rate + BASIS_POINTS // 2) // BASIS_POINTS
