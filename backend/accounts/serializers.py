from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.validators import UniqueValidator

from django.db import transaction
from .models import User, Role, UserRole

from django.conf import settings

from .otp import normalize_phone
from .models import OTPChallenge


class IranianPhoneField(serializers.CharField):
    def to_internal_value(self, data):
        value = super().to_internal_value(data)

        try:
            return normalize_phone(value)
        except ValueError:
            raise serializers.ValidationError(
                "Enter a valid Iranian mobile number."
            )


class RegisterSerializer(serializers.Serializer):

    phone = IranianPhoneField(
        validators=[
        UniqueValidator(
            queryset=User.objects.all(),
            message="This phone number is already registered.",
        )
    ],
    )

    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        style={"input_type": "password"},
    )

    password_confirm = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        style={"input_type": "password"},
    )

    def to_internal_value(self, data):
        unknown_fields = set(data.keys()) - set(self.fields.keys())

        if unknown_fields:
            raise serializers.ValidationError({
                field: "This field is not supported yet."
                for field in unknown_fields
            })

        return super().to_internal_value(data)

    def validate(self, attrs):

        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({
                "password_confirm": "Passwords do not match."
            })

        candidate_user = User(phone=attrs["phone"])

        try:
            validate_password(
                attrs["password"],
                user=candidate_user,
            )

        except DjangoValidationError as exc:
            raise serializers.ValidationError({
                "password": exc.messages
            })

        return attrs

    @transaction.atomic
    def create(self, validated_data):

    # Create new user
        user = User.objects.create_user(
            phone=validated_data["phone"],
            password=validated_data["password"],
        )

        employer_role = Role.objects.get(code="EMPLOYER")

        UserRole.objects.get_or_create(
            user=user,
            role=employer_role,
        )

        return user

class PasswordLoginSerializer(serializers.Serializer):

    phone = IranianPhoneField()

    password = serializers.CharField(
        write_only=True,
        trim_whitespace=False,
        style={"input_type": "password"},
    )

    def validate(self, attrs):

        user = authenticate(
            request=self.context.get("request"),
            phone=attrs["phone"],
            password=attrs["password"],
        )

        if user is None:
            raise AuthenticationFailed(
                "Phone number or password is incorrect."
            )

        attrs["user"] = user

        return attrs


class UserReadSerializer(serializers.ModelSerializer):

    class Meta:
        model = User

        fields = [
            "user_id",
            "phone",
            "full_name",
        ]

        read_only_fields = fields


class AuthResponseSerializer(serializers.Serializer):

    user = UserReadSerializer(read_only=True)

    access = serializers.CharField()

    refresh = serializers.CharField()


class TokenRefreshRequestSerializer(serializers.Serializer):

    refresh = serializers.CharField()


class TokenRefreshResponseSerializer(serializers.Serializer):

    access = serializers.CharField()

    refresh = serializers.CharField(required=False)


class TokenVerifyRequestSerializer(serializers.Serializer):

    token = serializers.CharField()



class OTPPhoneSerializer(serializers.Serializer):
    phone = IranianPhoneField()


class OTPVerifySerializer(OTPPhoneSerializer):
    code = serializers.RegexField(
        regex=rf"^[0-9]{{{settings.OTP_CODE_LENGTH}}}$",
        trim_whitespace=True,
    )


class OTPResendSerializer(OTPPhoneSerializer):
    purpose = serializers.ChoiceField(
        choices=OTPChallenge.Purpose.choices,
    )


class OTPPendingResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    requires_verification = serializers.BooleanField()

class OTPPendingResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
    requires_verification = serializers.BooleanField()


class OTPMessageResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()
