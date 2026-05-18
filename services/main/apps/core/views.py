from django.http import JsonResponse

from apps.classification.health import worker_health_snapshot


def health(_request):
    return JsonResponse(
        {
            "service": "main-api",
            "status": "ok",
            "version": "1.0.0",
        },
    )


def worker_health(_request):
    return JsonResponse(worker_health_snapshot())
