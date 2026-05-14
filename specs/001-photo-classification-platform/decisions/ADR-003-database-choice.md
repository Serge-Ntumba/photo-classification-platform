# ADR-003: Database Choice

## 1. Status

Accepted.

## 2. Context

The Photo Classification Platform needs to store structured application data for users, authentication, photo submissions, metadata, classification results, timestamps, and operational status fields.

The platform also needs admin filtering and search across submitted records. Required admin filters include age, gender, place of living, and country of origin. The system should also support filtering or ordering by submission status, classification result, and timestamps.

The assessment expects clear database justification, schema design, migrations, indexing, security awareness, Docker support, and a cloud-deployable architecture.

Assumptions for this decision:

- Uploaded photo files are stored in object storage, not in the relational database.
- The database stores photo object references, metadata, users, submissions, and classification results.
- The Django/DRF main service owns the application data model and database migrations.
- The FastAPI classification service does not write directly to the database.
- The Celery worker saves classification results through the Django application layer/ORM.

## 3. Decision

Use **PostgreSQL** as the primary relational database for metadata and application records.

PostgreSQL will store:

- user and authentication-related records;
- submission metadata;
- private photo object keys or references;
- submission status fields;
- normalized classification results;
- timestamps such as created, updated, and classified times;
- audit-friendly operational data.

Photo binaries remain in MinIO locally or S3-compatible object storage in production. PostgreSQL stores references to those objects, not the image bytes themselves.

## 4. Alternatives considered

### PostgreSQL

PostgreSQL is a mature relational database with strong support for constraints, transactions, indexes, JSON fields where useful, migrations, and reliable querying.

It fits the platform well because the data is structured and the admin panel needs predictable filtering, searching, ordering, and relational access patterns.

This option was accepted.

### MySQL

MySQL could also support structured records, indexes, and relational constraints. It would be a reasonable alternative for this project.

It was not selected because PostgreSQL is a strong default for Django applications that need reliable relational modeling, richer indexing options, and good support for both structured fields and occasional JSON metadata.

### SQLite

SQLite is useful for local prototypes and simple development setups.

It was rejected as the main database because the platform is intended to be cloud-deployable, containerized, and closer to production behavior. SQLite is not a good fit for the expected multi-container environment, concurrent writes, Kubernetes deployment strategy, or production-style persistence.

### NoSQL/document database

A document database could store flexible submission documents and classification payloads.

It was rejected because the core data is relational and structured. The platform benefits from foreign keys, transactions, migrations, constraints, and indexed filtering across known fields. A document database would make ownership, validation, relational integrity, and admin filtering less straightforward for this assessment.

## 5. Rationale

PostgreSQL is the best fit because the platform stores structured domain records with clear relationships:

- a user owns many submissions;
- a submission has one uploaded photo reference;
- a submission can have one or more classification result records;
- admins need to filter and inspect submissions across known metadata fields.

The platform needs reliable constraints so invalid or orphaned data is harder to create. It also needs indexes for admin filtering and migrations for schema evolution as the project grows.

PostgreSQL works well with Django's ORM and migration system. This keeps schema changes explicit, reviewable, and easy to reproduce in Docker Compose, CI, and Kubernetes environments.

## 6. Consequences

Positive consequences:

- Strong relational integrity through foreign keys and constraints.
- Reliable transactional writes for submissions and classification status updates.
- Good support for Django ORM, migrations, and admin queries.
- Straightforward indexing for required admin filters.
- Suitable for local Docker Compose and cloud deployment.
- Clear separation between structured metadata in PostgreSQL and binary photos in object storage.

Trade-offs:

- PostgreSQL requires a running database service in local development and deployment.
- Backups, migrations, credentials, and connection limits must be managed.
- For production, a managed PostgreSQL service is preferable to running the database manually in Kubernetes.
- Storing large binary images in PostgreSQL would be inefficient, so object storage is still required for photos.

These trade-offs are acceptable because the assessment expects a realistic cloud-deployable design, not a single-process prototype.

## 7. Indexing and migration implications

Django migrations will be used to create and evolve the database schema.

Expected core tables include:

- users and authentication tables;
- submissions;
- classification results.

The `submissions` table should include fields such as:

- user reference;
- name;
- age;
- place of living;
- gender;
- country of origin;
- optional description;
- photo object key;
- submission status;
- created timestamp;
- updated timestamp.

The `classification_results` table should include fields such as:

- submission reference;
- provider;
- classifier version;
- schema version;
- classification type;
- category;
- review decision;
- score or confidence where applicable;
- reasons or normalized metadata;
- classified timestamp;
- created timestamp.

Recommended indexes:

- `submissions(age)`;
- `submissions(gender)`;
- `submissions(place_of_living)`;
- `submissions(country_of_origin)`;
- `submissions(status)`;
- `submissions(created_at)`;
- `classification_results(category)`;
- `classification_results(review_decision)`;
- `classification_results(classified_at)`;
- an index on the relationship between submissions and their latest classification result, if classification history is stored.

These indexes support the required admin filters and common review queries without over-optimizing early.

## 8. How this supports the assessment

Using PostgreSQL directly supports the assessment requirements:

- stores user accounts and authentication-related records;
- stores submission metadata separately from uploaded photo objects;
- stores classification results and status fields;
- supports admin filtering by age, gender, place of living, and country of origin;
- supports timestamps for submitted and classified records;
- provides schema migrations and a defensible database design;
- works cleanly with Django/DRF, Docker Compose, CI, and Kubernetes-oriented deployment.

This choice is practical, production-aware, and easy to defend in a technical interview.
