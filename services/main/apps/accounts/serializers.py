from __future__ import annotations

from django.contrib.auth import authenticate, get_user_model, password_validation
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()


class UserSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "username", "is_staff"]
        read_only_fields = fields


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "email", "username", "is_staff", "date_joined"]
        read_only_fields = fields


class RegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    created_at = serializers.DateTimeField(source="date_joined", read_only=True)

    class Meta:
        model = User
        fields = ["id", "email", "username", "password", "is_staff", "created_at"]
        read_only_fields = ["id", "is_staff", "created_at"]

    def validate_email(self, value: str) -> str:
        return User.objects.normalize_email(value).lower()

    def validate_password(self, value: str) -> str:
        password_validation.validate_password(value)
        return value

    def create(self, validated_data: dict[str, object]) -> User:
        password = str(validated_data.pop("password"))
        user = User.objects.create_user(
            username=str(validated_data["username"]),
            email=str(validated_data["email"]),
            password=password,
            is_staff=False,
            is_superuser=False,
        )
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, trim_whitespace=False)
    access = serializers.CharField(read_only=True)
    refresh = serializers.CharField(read_only=True)
    user = UserSummarySerializer(read_only=True)

    default_error_messages = {
        "invalid_credentials": _("Unable to log in with the provided credentials."),
    }

    def validate(self, attrs: dict[str, object]) -> dict[str, object]:
        email = User.objects.normalize_email(str(attrs["email"])).lower()
        password = str(attrs["password"])

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            self._raise_invalid_credentials()

        authenticated = authenticate(
            request=self.context.get("request"),
            username=user.get_username(),
            password=password,
        )
        if authenticated is None:
            self._raise_invalid_credentials()

        refresh = RefreshToken.for_user(authenticated)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": authenticated,
        }

    def _raise_invalid_credentials(self) -> None:
        raise serializers.ValidationError(
            self.error_messages["invalid_credentials"],
            code="invalid_credentials",
        )
