# Architecture Diagram

This diagram reflects the current Photo Classification Platform implementation.
The public path terminates at Nginx. Nginx serves the React frontend and proxies
backend traffic to Django. Classification remains internal and asynchronous.

```mermaid
flowchart LR
    User["User or staff browser<br/>React frontend and Django Admin session"]

    subgraph Public["Public application entry point"]
        Nginx["Nginx<br/>Serves React SPA<br/>Proxies /api, /admin, /health, /static"]
    end

    subgraph Main["Django application boundary"]
        Web["Django + DRF web service<br/>Auth, submissions, validation<br/>Django Admin, OpenAPI"]
        Worker["Celery worker<br/>Loads submission<br/>Stores classification result"]
    end

    subgraph Async["Internal async classification boundary"]
        Broker[("RabbitMQ<br/>Classification jobs")]
        Classifier["FastAPI classifier<br/>Rule-based review checks<br/>/classify and /health"]
    end

    subgraph Data["Private data services"]
        Database[("PostgreSQL<br/>Users, submissions<br/>classification results")]
        Storage[("MinIO locally<br/>S3-compatible storage in production<br/>Private photo objects")]
    end

    User -->|"HTTPS requests"| Nginx
    Nginx -->|"React SPA and HTTP responses"| User
    Nginx -->|"API, admin, health, static"| Web

    Web -->|"Relational reads and writes"| Database
    Web -->|"Store uploaded photo"| Storage
    Web -->|"Publish submission job"| Broker

    Broker -->|"Consume job"| Worker
    Worker -->|"Django ORM result writes"| Database
    Worker -->|"Fetch private photo bytes"| Storage
    Worker -->|"Minimal classify request"| Classifier
    Classifier -->|"Normalized review result"| Worker
```

## Boundary Notes

- Browser clients call only the public Nginx entry point.
- Django owns users, permissions, submissions, admin review, database writes,
  upload orchestration, and job publishing.
- The Celery worker runs the asynchronous classification workflow using Django
  models, private object storage, RabbitMQ, and the internal classifier.
- The FastAPI classifier is stateless and rule-based in the current take-home
  implementation. It does not own auth, persistence, or object storage access.
- PostgreSQL stores structured records. MinIO/S3-compatible object storage stores
  uploaded photo bytes privately.
