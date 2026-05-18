"""Root URL configuration for the main service."""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

from apps.core.views import health, worker_health

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health", health, name="health"),
    path("health/worker", worker_health, name="worker-health"),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/submissions/", include("apps.submissions.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
]
