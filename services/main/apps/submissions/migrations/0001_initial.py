import uuid

import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Submission",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("name", models.CharField(max_length=255)),
                ("age", models.PositiveSmallIntegerField()),
                ("place_of_living", models.CharField(max_length=255)),
                ("gender", models.CharField(max_length=100)),
                ("country_of_origin", models.CharField(max_length=255)),
                ("description", models.TextField(blank=True)),
                ("photo_object_key", models.CharField(max_length=1024, unique=True)),
                ("photo_original_filename", models.CharField(blank=True, max_length=255)),
                ("photo_content_type", models.CharField(max_length=50)),
                ("photo_size_bytes", models.PositiveIntegerField()),
                ("photo_width", models.PositiveIntegerField()),
                ("photo_height", models.PositiveIntegerField()),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending_classification", "pending_classification"),
                            ("classifying", "classifying"),
                            ("classified", "classified"),
                            ("needs_manual_review", "needs_manual_review"),
                            ("rejected", "rejected"),
                            ("classification_failed", "classification_failed"),
                        ],
                        default="pending_classification",
                        max_length=40,
                    ),
                ),
                ("classified_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now, editable=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="submissions",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="submission",
            index=models.Index(fields=["user"], name="submission_user_idx"),
        ),
        migrations.AddIndex(
            model_name="submission",
            index=models.Index(fields=["age"], name="submission_age_idx"),
        ),
        migrations.AddIndex(
            model_name="submission",
            index=models.Index(fields=["gender"], name="submission_gender_idx"),
        ),
        migrations.AddIndex(
            model_name="submission",
            index=models.Index(fields=["place_of_living"], name="submission_place_idx"),
        ),
        migrations.AddIndex(
            model_name="submission",
            index=models.Index(fields=["country_of_origin"], name="submission_country_idx"),
        ),
        migrations.AddIndex(
            model_name="submission",
            index=models.Index(fields=["status"], name="submission_status_idx"),
        ),
        migrations.AddIndex(
            model_name="submission",
            index=models.Index(fields=["created_at"], name="submission_created_idx"),
        ),
        migrations.AddIndex(
            model_name="submission",
            index=models.Index(fields=["updated_at"], name="submission_updated_idx"),
        ),
        migrations.AddIndex(
            model_name="submission",
            index=models.Index(fields=["created_at", "status"], name="submission_created_status_idx"),
        ),
        migrations.AddConstraint(
            model_name="submission",
            constraint=models.CheckConstraint(
                condition=models.Q(("age__gte", 0), ("age__lte", 120)),
                name="submission_age_0_120",
            ),
        ),
        migrations.AddConstraint(
            model_name="submission",
            constraint=models.CheckConstraint(
                condition=models.Q(("photo_size_bytes__gt", 0), ("photo_size_bytes__lte", 5242880)),
                name="submission_photo_size_allowed",
            ),
        ),
        migrations.AddConstraint(
            model_name="submission",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    (
                        "status__in",
                        [
                            "pending_classification",
                            "classifying",
                            "classified",
                            "needs_manual_review",
                            "rejected",
                            "classification_failed",
                        ],
                    ),
                ),
                name="submission_status_allowed",
            ),
        ),
    ]
