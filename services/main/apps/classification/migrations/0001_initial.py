import uuid

import django.db.models.deletion
import django.utils.timezone
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("submissions", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ClassificationJob",
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
                ("job_id", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("payload", models.JSONField()),
                (
                    "publish_status",
                    models.CharField(
                        choices=[
                            ("pending", "pending"),
                            ("publishing", "publishing"),
                            ("published", "published"),
                            ("publish_retry_scheduled", "publish_retry_scheduled"),
                            ("publish_failed", "publish_failed"),
                        ],
                        default="pending",
                        max_length=40,
                    ),
                ),
                ("attempt_count", models.PositiveSmallIntegerField(default=0)),
                ("last_error", models.TextField(blank=True)),
                ("published_at", models.DateTimeField(blank=True, null=True)),
                ("locked_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now, editable=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "submission",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="classification_jobs",
                        to="submissions.submission",
                    ),
                ),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddIndex(
            model_name="classificationjob",
            index=models.Index(fields=["submission"], name="class_job_submission_idx"),
        ),
        migrations.AddIndex(
            model_name="classificationjob",
            index=models.Index(fields=["job_id"], name="class_job_job_id_idx"),
        ),
        migrations.AddIndex(
            model_name="classificationjob",
            index=models.Index(fields=["publish_status"], name="class_job_publish_idx"),
        ),
        migrations.AddIndex(
            model_name="classificationjob",
            index=models.Index(fields=["created_at"], name="class_job_created_idx"),
        ),
        migrations.AddIndex(
            model_name="classificationjob",
            index=models.Index(fields=["locked_at"], name="class_job_locked_idx"),
        ),
        migrations.AddConstraint(
            model_name="classificationjob",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    (
                        "publish_status__in",
                        [
                            "pending",
                            "publishing",
                            "published",
                            "publish_retry_scheduled",
                            "publish_failed",
                        ],
                    ),
                ),
                name="class_job_publish_status_allowed",
            ),
        ),
        migrations.AddConstraint(
            model_name="classificationjob",
            constraint=models.CheckConstraint(
                condition=models.Q(("attempt_count__gte", 0)),
                name="class_job_attempt_count_nonnegative",
            ),
        ),
        migrations.AddConstraint(
            model_name="classificationjob",
            constraint=models.UniqueConstraint(
                fields=("submission", "job_id"),
                name="class_job_submission_job_unique",
            ),
        ),
    ]
