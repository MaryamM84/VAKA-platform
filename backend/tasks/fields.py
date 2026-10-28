from django.db import models


class CurrencyCodeField(models.CharField):
    """Store a three-character currency code as PostgreSQL CHAR(3)."""

    def __init__(self, *args, **kwargs):
        kwargs["max_length"] = 3
        super().__init__(*args, **kwargs)

    def db_type(self, connection):
        if connection.vendor == "postgresql":
            return "char(3)"
        return super().db_type(connection)
