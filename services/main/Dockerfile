FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app/services/main

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl libpq-dev \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system app \
    && useradd --system --gid app --home-dir /app app

ARG INSTALL_EXTRAS=main

COPY pyproject.toml ./
RUN pip install --upgrade pip \
    && pip install -e ".[${INSTALL_EXTRAS}]"

COPY services/main ./services/main

RUN ln -s services/main/manage.py manage.py

WORKDIR /app

USER app

EXPOSE 8000

CMD ["gunicorn", "config.wsgi:application", "--bind", "0.0.0.0:8000"]

FROM base AS test

USER root

COPY conftest.py ./conftest.py
COPY tests ./tests
COPY services/classifier ./services/classifier

RUN mkdir -p /app/.pytest_cache /app/.ruff_cache \
    && chown -R app:app /app/.pytest_cache /app/.ruff_cache

USER app

FROM base AS runtime
