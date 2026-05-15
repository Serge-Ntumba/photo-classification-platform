from django.http import JsonResponse


def health(_request):
    return JsonResponse(
        {
            "service": "main-api",
            "status": "ok",
            "version": "1.0.0",
        },
    )
