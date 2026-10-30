from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.validators import UniqueValidator

from .models import User


class RegisterSerializer(serializers.Serializer):

    phone = serializers.CharField(
        max_length=32,
        trim_whitespace=True,
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

    def create(self, validated_data):

        return User.objects.create_user(
            phone=validated_data["phone"],
            password=validated_data["password"],
        )


class PasswordLoginSerializer(serializers.Serializer):

    phone = serializers.CharField(
        max_length=32,
        trim_whitespace=True,
    )

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