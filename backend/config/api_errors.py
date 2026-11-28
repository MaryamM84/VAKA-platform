
import re


PUBLIC_ERRORS = {
    400: ("validation_error", "The submitted request is invalid."),
    401: ("not_authenticated", "Authentication is required."),
    403: ("permission_denied", "You do not have permission to perform this action."),
    404: ("not_found", "The requested resource was not found."),
    405: ("method_not_allowed", "This method is not allowed."),
    406: ("not_acceptable", "The requested representation is not available."),
    409: ("conflict", "The requested operation conflicts with the current state."),
    415: ("unsupported_media_type", "This media type is not supported."),
    429: ("throttled", "Too many requests. Please try again later."),
    500: ("internal_server_error", "An unexpected server error occurred."),
    502: ("bad_gateway", "The service is temporarily unavailable."),
    503: ("service_unavailable", "The service is temporarily unavailable."),
    504: ("gateway_timeout", "The service is temporarily unavailable."),
}

_CODE_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")

_UNSAFE_TEXT_RE = re.compile(
    r"traceback|stack\s*trace|\b(?:SELECT\b.+\bFROM|INSERT\s+INTO|UPDATE\b.+\bSET|DELETE\s+FROM)\b"
    r"|\b(?:psycopg|ProgrammingError|OperationalError|IntegrityError)\b"
    r"|(?:[A-Za-z]:\\|/(?:home|Users|var|mnt|srv|app|etc)/)"
    r"|(?:authorization\s*:\s*bearer|(?:password|secret|api[_-]?key)\s*[:=])",
    re.IGNORECASE | re.DOTALL,
)

_PRIVATE_FIELD_RE = re.compile(
    r"(?:password|secret|token|authorization|national_code|identity|private_key|api_key|otp)",
    re.IGNORECASE,
)


def _safe_message(value, fallback="Invalid value."):
    if isinstance(value, (list, dict)) or value is None:
        return fallback

    message = str(value).strip()

    if not message or len(message) > 400 or _UNSAFE_TEXT_RE.search(message):
        return fallback

    return message


def _safe_code(value, fallback):
    if isinstance(value, str) and _CODE_RE.fullmatch(value):
        return value

    return fallback


def _flatten_validation(value, field="", limit=30):
    """Extract only public, bounded field validation messages."""
    output = []

    def visit(item, current):
        if len(output) >= limit:
            return

        if isinstance(item, dict):
            for key, child in item.items():
                if len(output) >= limit:
                    break

                name = str(key)

                if len(name) > 80 or not re.fullmatch(r"[a-zA-Z0-9_\-]+", name):
                    continue

                visit(child, f"{current}.{name}" if current else name)

        elif isinstance(item, (list, tuple)):
            for child in item[:limit]:
                visit(child, current)

        else:
            if not current:
                current = "non_field_errors"

            private = _PRIVATE_FIELD_RE.search(current)

            output.append({
                "field": current,
                "message": "Invalid value." if private else _safe_message(item),
            })

    visit(value, field)
    return output


def error_payload(status_code, source=None, exception=None):
    """Produce {'error': {'code', 'message', 'details'}} for any HTTP error."""

    base_code, base_message = PUBLIC_ERRORS.get(
        status_code,
        ("http_error", "The request could not be completed."),
    )

    if status_code >= 500:
        return {
            "error": {
                "code": base_code,
                "message": base_message,
                "details": [],
            }
        }

    if status_code in (401, 403, 404, 405, 406, 415, 429):
        code = base_code

        if isinstance(source, dict):
            code = _safe_code(source.get("code"), code)

        if exception is not None:
            code = _safe_code(
                getattr(exception, "default_code", None),
                code,
            )

        return {
            "error": {
                "code": code,
                "message": base_message,
                "details": [],
            }
        }

    details = []
    code = base_code
    message = base_message

    if isinstance(source, dict) and isinstance(source.get("error"), dict):
        source = source["error"]

        code = _safe_code(source.get("code"), base_code)
        message = _safe_message(source.get("message"), base_message)

        details = (
            _flatten_validation(source.get("details", []))
            if isinstance(source.get("details"), dict)
            else []
        )

        if isinstance(source.get("details"), list):
            for item in source["details"][:30]:
                if isinstance(item, dict):
                    field = str(item.get("field", "non_field_errors"))

                    if re.fullmatch(r"[a-zA-Z0-9_.\-]{1,100}", field):
                        details.append({
                            "field": field,
                            "message": (
                                "Invalid value."
                                if _PRIVATE_FIELD_RE.search(field)
                                else _safe_message(item.get("message"))
                            ),
                        })

        return {
            "error": {
                "code": code,
                "message": message,
                "details": details[:30],
            }
        }

    if isinstance(source, dict):
        code = _safe_code(source.get("code"), base_code)

        if "detail" in source:
            message = _safe_message(source["detail"], base_message)
        elif "reason" in source:
            message = _safe_message(source["reason"], base_message)
        elif "message" in source:
            message = _safe_message(source["message"], base_message)

        reserved = {"code", "detail", "reason", "message", "error"}

        details = _flatten_validation({
            k: v
            for k, v in source.items()
            if k not in reserved
        })

    elif isinstance(source, (list, tuple)):
        details = _flatten_validation(source)

    elif source is not None:
        message = _safe_message(source, base_message)

    if exception is not None and code == base_code:
        specific = getattr(exception, "default_code", None)

        if specific and specific not in ("error", "invalid"):
            code = _safe_code(specific, base_code)

    return {
        "error": {
            "code": code,
            "message": message,
            "details": details,
        }
    }
