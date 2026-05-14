# Classification Service Design Note

## Purpose

The assessment requires every photo/profile submission to receive a classification result. Since the assessment does not define a fixed taxonomy, model, or provider, the classification service should be designed as a flexible microservice with two supported modes:

1. **Rule-based classification** — default, deterministic, works without external dependencies.
2. **Model-provider classification** — optional, uses an external AI provider when a provider key is configured.

The key design decision is that the system classifies the **submission review state**, not the person.

This keeps the implementation practical, testable, and safer from privacy or bias problems.

---

## Classification Meaning

In this platform, classification means assigning a structured review category to each uploaded photo/profile submission.

The classifier should not infer sensitive personal attributes such as gender, ethnicity, age, nationality, attractiveness, identity, or background from the photo. Those values are either user-provided metadata or should not be inferred at all.

The classifier should answer questions such as:

* Is this submission technically valid?
* Is the uploaded file a valid image?
* Is the image quality acceptable?
* Is the submission complete enough for admin review?
* Does the image appear suitable for a profile-style submission?
* Should the submission pass automated checks, fail automated checks, or be sent to manual review?

This means classification is not just file validation. Validation produces signals. The classification service turns those signals into a clear review category.

---

## Classification Taxonomy

The primary classification category should describe the submission state.

Recommended categories:

```text
valid_profile_candidate
invalid_file
unsupported_image_type
suspicious_file
low_quality_image
incomplete_metadata
non_profile_image
unsafe_content
```

Recommended review decisions:

```text
passes_automated_checks
fails_automated_checks
needs_manual_review
```

These terms make it clear that the system is evaluating the submission against platform checks. It is not approving, rejecting, or judging the person.

---

## Category Priority Order

The classifier must assign categories deterministically. If multiple issues exist, the highest-priority category wins.

Recommended priority order:

```text
1. invalid_file
2. unsupported_image_type
3. suspicious_file
4. unsafe_content
5. incomplete_metadata
6. low_quality_image
7. non_profile_image
8. valid_profile_candidate
```

Example:

If a file is valid, the image is too small, and metadata is missing, the category should be `incomplete_metadata` because it has higher priority than `low_quality_image`.

The `review_decision` should describe what happens next. The `category` should explain why.

Example:

```json
{
  "category": "low_quality_image",
  "review_decision": "needs_manual_review"
}
```

Avoid using a category such as `manual_review_required`, because that duplicates the decision field and does not explain the underlying reason.

---

## Demographic Metadata Guardrail

Demographic metadata should not influence quality, suitability, safety, or review priority.

Fields such as age, gender, country of origin, and place of living should be used only for:

* basic validation,
* display,
* storage,
* admin filtering,
* and user-submitted record context.

They should not be used to infer whether a person or profile is suitable.

Basic validation is still acceptable. For example, checking that age is an integer within a configured range is validation, not demographic scoring.

---

## Classification Result Schema

All providers should return the same normalized response structure.

```json
{
  "provider": "rule_based | model_provider",
  "classifier_version": "ruleset-v1",
  "schema_version": "classification-schema-v1",
  "classification_type": "submission_review",
  "category": "valid_profile_candidate",
  "photo_type": "person_photo | group_photo | document | object | landscape | unclear | other | unknown_image",
  "image_quality": "high | medium | low | unknown",
  "technical_status": "valid_image | invalid_file | suspicious_file | unsupported_type",
  "content_safety_status": "safe | unsafe | uncertain | not_evaluated",
  "profile_suitability": "suitable | unsuitable | uncertain | not_evaluated",
  "review_decision": "passes_automated_checks | fails_automated_checks | needs_manual_review",
  "score": 85,
  "confidence": null,
  "reasons": ["string"],
  "provider_metadata": {
    "model": null,
    "model_version": null,
    "ruleset_version": "v1",
    "request_id": null,
    "fallback_used": false,
    "fallback_reason": null
  },
  "classified_at": "timestamp",
  "classification_duration_ms": 120,
  "error_code": null
}
```

### Notes

* `category` is the main classification result.
* `review_decision` is the operational decision used by the platform.
* `score` is used for rule-based classification.
* `confidence` should be stored only if the provider returns a calibrated confidence score.
* LLM self-reported confidence should not be treated as calibrated confidence.
* `technical_status`, `content_safety_status`, and `profile_suitability` are separate concerns.
* A technically valid image can still be unsuitable as a profile-style submission.
* An unsuitable image is not automatically unsafe.
* Raw provider responses should not be stored by default in production.

---

## Provider Strategy

The classification service should expose one stable internal API:

```http
POST /classify
```

Input:

```json
{
  "submission_id": "uuid",
  "photo_object_key": "uploads/submissions/...",
  "metadata": {
    "name": "string",
    "age": 30,
    "place_of_living": "string",
    "gender": "string",
    "country_of_origin": "string",
    "description": "string"
  }
}
```

The service should prefer object keys over public URLs. The classification service should fetch the image using internal storage credentials or a short-lived pre-signed URL. Permanent public URLs should not be passed around between services.

For model-provider classification, metadata should be minimized. Demographic and identifying fields such as name, age, gender, country, and place of living should not be sent to a model provider unless there is a specific documented reason. In most cases, the model only needs the image and a generic instruction that the expected submission is a profile-style image.

Output:

```json
{
  "submission_id": "uuid",
  "classification": {
    "provider": "rule_based",
    "classifier_version": "ruleset-v1",
    "classification_type": "submission_review",
    "category": "valid_profile_candidate",
    "photo_type": "unknown_image",
    "image_quality": "medium",
    "technical_status": "valid_image",
    "content_safety_status": "not_evaluated",
    "profile_suitability": "not_evaluated",
    "review_decision": "passes_automated_checks",
    "score": 95,
    "confidence": null,
    "reasons": [
      "valid JPEG image",
      "dimensions above minimum threshold",
      "required metadata present",
      "semantic image model not configured"
    ],
    "provider_metadata": {
      "model": null,
      "ruleset_version": "v1",
      "fallback_used": false,
      "fallback_reason": null
    }
  }
}
```

Environment configuration:

```env
CLASSIFIER_PROVIDER=rule_based
MODEL_PROVIDER=openai
MODEL_API_KEY=...
MODEL_NAME=...
```

If no model provider or key is configured, the service must use `rule_based` automatically.

---

## 1. Rule-Based Classification

The rule-based classifier is the default implementation. It performs deterministic checks and converts the result into a submission review category.

This is more than basic validation. Validation checks individual facts. Classification assigns the submission to a defined category using those facts.

### Suggested Configurable Defaults

```text
Allowed MIME types: image/jpeg, image/png, image/webp
Max file size: 5 MB
Minimum dimensions: 300x300
Maximum dimensions: 5000x5000
Description max length: 1000 characters
Age range: 0-120, unless the business explicitly requires another range
```

These values should be configurable through environment variables.

### Immediate Fail Rules

These rules should produce `fails_automated_checks` regardless of score:

```text
invalid image file
unsupported MIME type
file signature mismatch
file exceeds max size
suspicious or corrupted file
```

### Scored Review Rules

These rules affect score but do not necessarily fail the submission automatically:

```text
image dimensions below recommended threshold
image dimensions above recommended threshold but still processable
missing optional metadata
description too long
weak image quality based on deterministic checks
```

### Signals Used

The rule-based classifier should check:

* File exists in storage.
* File extension and MIME type are allowed.
* File signature matches declared MIME type.
* Image can be opened and verified.
* File size is within limits.
* Image dimensions are within allowed bounds.
* Required metadata is present.
* Age value is within accepted validation range.
* Description length is within limit.
* Upload does not look suspicious or corrupted.

### Example Rule Mapping

| Signal                                               | Category                | Review Decision         |
| ---------------------------------------------------- | ----------------------- | ----------------------- |
| File cannot be opened as an image                    | invalid_file            | fails_automated_checks  |
| MIME type is unsupported                             | unsupported_image_type  | fails_automated_checks  |
| File signature mismatch                              | suspicious_file         | fails_automated_checks  |
| File is valid but dimensions are too small           | low_quality_image       | needs_manual_review     |
| Required metadata is missing                         | incomplete_metadata     | needs_manual_review     |
| File and required metadata pass deterministic checks | valid_profile_candidate | passes_automated_checks |

### Rule-Based Score

The rule-based classifier should use a deterministic score instead of model confidence.

Example scoring:

```text
Start score: 100
Immediate fail rule triggered: fails_automated_checks
Image below recommended dimensions: -30
Missing required metadata: category incomplete_metadata, needs_manual_review
Missing optional metadata: -10
Description too long: -10
Image near lower quality threshold: -15
```

Recommended score interpretation:

```text
score >= 90: passes_automated_checks
60 <= score < 90: needs_manual_review
score < 60: needs_manual_review unless an immediate fail rule triggered
```

Low score alone should not automatically mean `fails_automated_checks`. A submission should fail automated checks only when a concrete fail rule is triggered.

### Example Response

```json
{
  "provider": "rule_based",
  "classifier_version": "ruleset-v1",
  "classification_type": "submission_review",
  "category": "valid_profile_candidate",
  "photo_type": "unknown_image",
  "image_quality": "medium",
  "technical_status": "valid_image",
  "content_safety_status": "not_evaluated",
  "profile_suitability": "not_evaluated",
  "review_decision": "passes_automated_checks",
  "score": 95,
  "confidence": null,
  "reasons": [
    "valid JPEG image",
    "supported MIME type",
    "image dimensions acceptable",
    "required metadata present",
    "semantic image model not configured"
  ],
  "provider_metadata": {
    "ruleset_version": "v1",
    "fallback_used": false,
    "fallback_reason": null
  }
}
```

### Why This Is Needed

The rule-based provider makes the system reliable in all environments:

* Local development.
* Docker Compose.
* CI pipeline.
* Kubernetes deployments without secrets.
* Demo environments where no external provider key is available.

It also guarantees that every submission receives a classification result, even when no AI provider is configured.

---

## 2. Model-Provider Classification

The model-provider classifier is used when a supported provider and API key are configured.

The provider could be OpenAI, Anthropic, or another vendor, as long as it can accept image input and return a structured response that can be mapped to the platform schema.

The application should not depend directly on a specific vendor. It should depend on an internal provider interface.

### Responsibilities

The model-provider classifier should analyze the actual image content and return normalized classification fields.

It can provide stronger visual classification than the rule-based classifier, such as:

* `person_photo`
* `group_photo`
* `document`
* `object`
* `landscape`
* `unclear`
* `non_profile_image`

It should also help decide whether the submission is suitable for profile-style review.

### Model Prompt Rules

The model should be instructed to:

* Return only structured JSON matching the internal schema.
* Classify the image and submission suitability, not the person.
* Avoid guessing sensitive attributes.
* Avoid identifying the person.
* Avoid using unnecessary metadata in the prompt.
* Return `uncertain` or `needs_manual_review` when unsure.

After the provider returns a response, the service must:

* Validate the JSON schema.
* Map provider-specific labels to internal enums.
* Reject or fallback if the response is invalid.
* Never write raw provider output directly to the database without validation.
* Cap or resize the image before sending to the provider.
* Avoid logging image bytes, signed URLs, raw prompts, or sensitive metadata.

### Unsafe vs Unsuitable

The model-provider path should distinguish between unsafe and unsuitable content.

Examples:

```text
Unsafe: explicit sexual content, graphic violence, hateful symbols.
Unsuitable: document image, landscape, object photo, unclear image, group photo when a single profile photo is expected.
```

A document photo may be unsuitable for a profile submission, but it is not automatically unsafe.

### Example Response

```json
{
  "provider": "model_provider",
  "classifier_version": "model-provider-v1",
  "schema_version": "classification-schema-v1",
  "classification_type": "submission_review",
  "category": "valid_profile_candidate",
  "photo_type": "person_photo",
  "image_quality": "high",
  "technical_status": "valid_image",
  "content_safety_status": "safe",
  "profile_suitability": "suitable",
  "review_decision": "passes_automated_checks",
  "score": null,
  "confidence": null,
  "reasons": [
    "single person-style image detected",
    "image is clear",
    "photo appears suitable for profile review",
    "no obvious unsafe visual content"
  ],
  "provider_metadata": {
    "model": "configured-model-name",
    "model_version": "configured-model-version",
    "request_id": "provider-request-id"
  }
}
```

### Unsafe Content Category

`unsafe_content` should only be assigned when a model/moderation provider or deterministic rule has enough evidence.

If the provider is uncertain, the category should become the most appropriate non-final category and the review decision should be `needs_manual_review`.

---

## Provider Interface

All providers should implement the same interface.

```python
class ClassificationProvider:
    def classify(self, image, metadata) -> ClassificationResult:
        raise NotImplementedError
```

Example implementations:

```python
class RuleBasedClassifier(ClassificationProvider):
    ...

class ModelProviderClassifier(ClassificationProvider):
    ...
```

The main application should not know whether the result came from rules or a model provider. It should only consume the normalized classification result.

---

## Fallback Behavior

The service must never fail only because a model provider is not configured.

Recommended fallback logic:

```text
If CLASSIFIER_PROVIDER=rule_based:
    use rule-based classifier

If CLASSIFIER_PROVIDER=model and MODEL_API_KEY exists:
    use configured model provider

If CLASSIFIER_PROVIDER=model but MODEL_API_KEY is missing:
    use rule-based classifier
    set fallback_used=true
    set fallback_reason="model_api_key_missing"

If model provider call fails:
    log error without sensitive data
    use rule-based classifier
    set fallback_used=true
    set fallback_reason="model_provider_unavailable"
```

Fallback must be visible in the returned result and stored metadata. Admins and developers should be able to tell whether a result came from the configured model provider or from fallback rules.

---

## Privacy and External Providers

External model-provider classification must be explicitly enabled. The default system should not send user photos to external providers.

Production considerations:

* User photos should not be sent externally without a clear data processing basis or user consent where required.
* The classifier should use temporary signed URLs or internal object access, not public URLs.
* Image bytes should not be retained longer than necessary by the classification service.
* Logs should not contain image data, signed URLs, raw prompts, or sensitive metadata.
* Raw provider responses should not be stored by default.
* If raw responses are stored for debugging, they should be encrypted, access-controlled, hidden from normal admin views, and covered by a retention policy.

In production, prefer storing normalized fields plus safe provider metadata:

```text
provider
model_name
model_version
request_id
classifier_version
schema_version
classified_at
classification_duration_ms
error_code
fallback_used
fallback_reason
```

---

## Safety Policy

The system should separate technical safety, content safety, and profile suitability.

### Technical Safety

Technical safety checks whether the uploaded file is safe and processable.

Examples:

```text
valid_image
invalid_file
suspicious_file
unsupported_type
```

### Content Safety

Content safety checks whether the visual content is unsafe.

Examples of unsafe content:

* Explicit sexual content.
* Graphic violence.
* Hateful symbols.

In rule-based mode, content safety is usually `not_evaluated` unless the issue is detectable through deterministic checks. In model-provider mode, content safety can be evaluated by the provider and then mapped to internal enums.

### Profile Suitability

Profile suitability checks whether the image is appropriate for a profile-style submission.

Examples of unsuitable content:

* Document or ID image.
* Landscape image.
* Object image.
* Group photo when a single-person profile image is expected.
* Unclear or heavily blurred image.

Unsuitable does not mean unsafe.

---

## Synchronous vs Asynchronous Classification

For the first implementation, classification can be synchronous:

```text
User uploads submission -> API stores data -> API calls classifier -> result is saved -> response is returned
```

This is simpler and better for a take-home assessment.

For production, classification should likely move to an asynchronous flow:

```text
User uploads submission -> status: pending_classification -> queue message -> worker classifies -> result saved -> admin sees updated status
```

A production asynchronous flow should include retries, timeout handling, dead-letter queues, and idempotency.

---

## Storage and Database

Classification results should be stored separately from submission metadata.

Recommended relationship:

```text
submissions 1 -> many classification_results
```

The admin panel should show the latest classification result by default, while older results remain available for audit and debugging.

Suggested table:

```text
classification_results
- id
- submission_id
- classification_run_id
- idempotency_key
- provider
- classifier_version
- schema_version
- classification_type
- category
- photo_type
- image_quality
- technical_status
- content_safety_status
- profile_suitability
- review_decision
- score
- confidence
- reasons_json
- provider_metadata_json
- classified_at
- classification_duration_ms
- error_code
- fallback_used
- fallback_reason
- is_latest
- superseded_at
- created_at
```

Recommended constraints:

```text
unique(idempotency_key)
index(submission_id, is_latest)
index(review_decision)
index(category)
index(classified_at)
```

This allows the platform to:

* Show the latest classification result in the admin panel.
* Filter by classification result.
* Re-run classification later with another provider.
* Explain old results after rules or models change.
* Audit provider, version, and fallback information.

---

## Idempotency

Classification should be idempotent.

The caller should send or derive an `idempotency_key`, for example:

```text
submission_id + provider + classifier_version + image_checksum
```

If the same classification request is retried, the service should return the existing result rather than creating duplicate current results.

If reclassification is intentionally requested, the system should create a new `classification_run_id`, mark the previous result as `is_latest=false`, and store the new result as `is_latest=true`.

---

## Admin Panel Use Cases

The admin panel must already support filtering by age, gender, location, and country. Classification should add useful review filters.

Recommended admin filters:

```text
review_decision
category
photo_type
image_quality
technical_status
content_safety_status
profile_suitability
provider
fallback_used
classified_at
```

This makes the classification result visible and useful, not just a backend checkbox.

---

## Recommended Implementation Order

For the take-home, the priority should be a polished and reliable core implementation.

Recommended order:

1. Rule-based classifier.
2. Normalized classification schema.
3. Database persistence.
4. Admin filtering and display.
5. Tests for classification rules and priority order.
6. Docker Compose setup.
7. Kubernetes and CI/CD documentation.
8. Model-provider interface/stub.
9. One concrete model provider only if time allows.

A polished rule-based implementation with tests is better than a half-working AI integration.

---

## Final Position

The platform treats classification as a separate review capability.

The first implementation classifies submissions into deterministic review categories using file, image-quality, metadata-completeness, and safety rules. This satisfies the requirement that every submission receives a classification result while keeping local development, CI, and demos reliable.

The design also supports optional model-provider classification when a provider key is configured. That model-provider mode can add real visual image classification, but it must still return the same normalized schema and must not infer sensitive personal attributes from the photo.

This design is practical, extensible, safer from a privacy standpoint, and clear enough to defend in a technical review.
