from __future__ import annotations

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class ApplicationUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Application", {"fields": ("id",)}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("username", "email", "password1", "password2"),
            },
        ),
    )
    readonly_fields = ["id", "date_joined", "last_login"]
    list_display = ["username", "email", "is_staff", "is_superuser", "is_active", "date_joined"]
    list_filter = ["is_staff", "is_superuser", "is_active", "date_joined"]
    search_fields = ["username", "email"]
    ordering = ["email"]
