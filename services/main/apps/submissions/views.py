from __future__ import annotations

from uuid import uuid4

from django.db import transaction
from drf_spectacular.utils import OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.classification.constants import SUBMISSION_STATUS_PENDING_CLASSIFICATION
from apps.classification.publisher import create_classification_job, publish_classification_job

from .models import Submission
from .serializers import SubmissionCreateSerializer, SubmissionReadSerializer
from .storage_service import StoredSubmissionPhoto, SubmissionStorageService


@extend_schema_view(
    create=extend_schema(
        request=SubmissionCreateSerializer,
        responses={
            201: SubmissionReadSerializer,
            400: OpenApiResponse(description="Validation error"),
            401: OpenApiResponse(description="Authentication credentials were not provided."),
        },
        tags=["submissions"],
    ),
    list=extend_schema(responses={200: SubmissionReadSerializer(many=True)}, tags=["submissions"]),
    retrieve=extend_schema(responses={200: SubmissionReadSerializer}, tags=["submissions"]),
)
class SubmissionViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    queryset = Submission.objects.none()
    serializer_class = SubmissionReadSerializer
    filterset_fields = ["status"]
    ordering_fields = ["created_at", "updated_at", "status"]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Submission.objects.none()
        return Submission.objects.filter(user=self.request.user).order_by("-created_at")

    def get_serializer_class(self):
        if self.action == "create":
            return SubmissionCreateSerializer
        return SubmissionReadSerializer

    def create(self, request, *args, **kwargs) -> Response:
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = self._create_submission(serializer)
        output = SubmissionReadSerializer(submission, context=self.get_serializer_context())
        return Response(output.data, status=status.HTTP_201_CREATED)

    def _create_submission(self, serializer: SubmissionCreateSerializer) -> Submission:
        submission_id = uuid4()
        storage_service = SubmissionStorageService()
        stored_photo = storage_service.store_photo(
            submission_id=submission_id,
            original_filename=serializer.original_filename,
            normalized_image=serializer.normalized_image,
        )

        try:
            with transaction.atomic():
                submission = self._persist_submission(serializer, submission_id, stored_photo)
                job = create_classification_job(submission)
        except Exception:
            storage_service.delete_photo(stored_photo.object_key)
            raise

        publish_classification_job(job)
        return Submission.objects.get(pk=submission.pk)

    def _persist_submission(
        self,
        serializer: SubmissionCreateSerializer,
        submission_id,
        stored_photo: StoredSubmissionPhoto,
    ) -> Submission:
        data = serializer.validated_data
        return Submission.objects.create(
            id=submission_id,
            user=self.request.user,
            name=data["name"],
            age=data["age"],
            place_of_living=data["place_of_living"],
            gender=data["gender"],
            country_of_origin=data["country_of_origin"],
            description=data.get("description", ""),
            photo_object_key=stored_photo.object_key,
            photo_original_filename=stored_photo.original_filename,
            photo_content_type=stored_photo.content_type,
            photo_size_bytes=stored_photo.size_bytes,
            photo_width=stored_photo.width,
            photo_height=stored_photo.height,
            status=SUBMISSION_STATUS_PENDING_CLASSIFICATION,
        )
