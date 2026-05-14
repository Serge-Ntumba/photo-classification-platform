# ADR-005: Classification Scope

## 1. Status

Accepted.

## 2. Context

The Photo Classification Platform must return a classification result for every photo/profile submission. The assessment does not define a required taxonomy, machine learning model, external provider, accuracy target, or whether machine learning is mandatory.

Each submission contains a photo and user-provided personal metadata, including name, age, place of living, gender, country of origin, and an optional description. Because the system processes personal data and images, the classification scope must be narrow, explainable, and safe from unnecessary sensitive or biased inferences.

The platform also needs to work reliably in local development, CI, Docker Compose, and Kubernetes environments. Therefore, classification must not depend on an external AI provider being available.

## 3. Decision

The platform classifies the **submission review state**, not the person.

The default implementation will be a deterministic, rule-based classifier. It will evaluate whether a submission is technically valid, complete enough for review, and suitable for automated acceptance or manual review based on non-sensitive submission-level signals.

Optional model-provider classification may be supported later, but any provider must return the same normalized classification schema and follow the same safety boundaries.

## 4. Classification meaning

In this platform, classification means assigning a structured review category and operational decision to a submitted photo/profile record.

Classification answers questions such as:

- Can the uploaded file be processed as an image?
- Is the image type supported?
- Does the file appear suspicious or corrupted?
- Are required metadata fields present and valid?
- Is the image quality sufficient for review?
- Should the submission pass automated checks, fail automated checks, or be sent to manual review?

Classification does **not** mean judging the person in the image or inferring personal traits from the photo.

Example classification categories may include:

- `valid_profile_candidate`
- `invalid_file`
- `unsupported_image_type`
- `suspicious_file`
- `low_quality_image`
- `incomplete_metadata`
- `non_profile_image`
- `unsafe_content`

Example review decisions may include:

- `passes_automated_checks`
- `fails_automated_checks`
- `needs_manual_review`

The category explains the reason. The review decision explains the operational next step.

## 5. What the classifier may evaluate

The classifier may evaluate submission-level and file-level signals, including:

- File existence in the storage layer.
- File size.
- File extension and MIME type.
- File signature matching the declared MIME type.
- Whether the file can be opened and verified as an image.
- Image dimensions.
- Basic deterministic image-quality checks, such as very small dimensions.
- Whether required metadata fields are present.
- Whether metadata values pass basic validation, such as age being an integer within the configured accepted range.
- Whether optional metadata exceeds configured limits, such as description length.
- Whether the submission should be routed to automated pass, automated fail, or manual review.

If a model provider is added later, it may evaluate visual submission suitability, such as whether the image appears to be a profile-style photo, a document, an object, a landscape, a group photo, unclear, or unsafe. Provider output must be normalized, validated, and mapped to internal enums before storage.

## 6. What the classifier must not evaluate

The classifier must not infer, predict, score, or rank people based on protected, sensitive, subjective, or identity-related traits.

The classifier must not infer from the photo:

- Ethnicity.
- Race.
- Attractiveness.
- Identity.
- Gender.
- Age.
- Nationality.
- Social background.
- Economic background.
- Personality.
- Trustworthiness.
- Fitness, competence, or desirability.

The classifier must not use demographic metadata to influence quality, suitability, safety, priority, or classification score.

User-provided demographic metadata may be stored and used for:

- Display in the user profile/submission record.
- Basic validation.
- Admin filtering required by the assessment.
- Search and retrieval in the admin panel.

It must not be used to decide whether a person is acceptable, suitable, higher priority, lower priority, safe, unsafe, or more likely to pass review.

## 7. Alternatives considered

### Alternative 1: Person/demographic classification

This approach would classify or infer traits about the person in the image, such as age, gender, ethnicity, nationality, attractiveness, or identity.

This was rejected.

It is not required by the assessment, introduces avoidable privacy and bias risks, and would be difficult to justify without a clear business need, consent model, fairness evaluation, and legal basis. It also conflicts with the intended scope of the platform, which is to review submissions, not people.

### Alternative 2: Real ML-only classifier

This approach would require all submissions to be classified by a real machine learning model or external AI provider.

This was rejected as the default implementation.

The assessment requires a classification result but does not require machine learning. A real ML-only classifier would introduce external dependencies, API keys, cost, latency, nondeterministic behavior, and more complex failure modes. It would also make local development, CI, and demos less reliable.

A model provider may still be added later as an optional implementation behind the same normalized interface.

### Alternative 3: Rule-based submission review classifier

This approach uses deterministic rules to classify the submission review state based on file validity, image properties, metadata completeness, and safety-related technical checks.

This was accepted as the default implementation.

It is reliable, testable, explainable, and works without external services. It also supports deterministic unit tests and makes it clear why a submission passed, failed, or needs manual review.

### Alternative 4: Provider-pluggable classifier

This approach defines a stable internal classification interface and allows multiple implementations, such as a rule-based provider and a future model-provider implementation.

This was accepted as the extensibility strategy.

The platform should depend on a normalized classification result, not directly on one vendor or one model. This keeps the default implementation simple while preserving a clear path for future ML-based classification.

## 8. Rationale

This decision keeps the classification requirement practical and defensible.

The assessment asks for a classification result, but it leaves the classification meaning open. Classifying the submission review state satisfies the requirement while avoiding unnecessary sensitive inference from personal photos.

A rule-based default is appropriate because it:

- Works in local development, CI, Docker Compose, and Kubernetes without external secrets.
- Produces deterministic and testable results.
- Is easier to explain in a technical interview.
- Avoids pretending that an untrained or weak model provides meaningful accuracy.
- Provides useful operational outcomes for admins.
- Reduces privacy, fairness, and compliance risk.

The provider-pluggable design keeps the system extensible. If a real image model is introduced later, it must operate inside the same boundaries: classify the submission, not the person; minimize metadata sent externally; validate provider responses; and store normalized results.

## 9. Consequences

Positive consequences:

- The system can always produce a classification result without external AI dependencies.
- Classification behavior is deterministic and testable.
- The result is explainable through categories, decisions, scores, and reasons.
- The design reduces privacy and bias risk.
- Admins receive useful review states instead of opaque labels.
- The architecture remains compatible with future model providers.

Tradeoffs:

- The default classifier does not perform deep visual understanding.
- Rule-based checks may identify technical validity and basic quality, but they cannot reliably distinguish all image content types.
- Some cases will require manual review.
- A model provider may be needed later for stronger visual suitability checks, content safety checks, or richer photo type detection.

Operational consequences:

- Classification results should store provider, classifier version, schema version, reasons, fallback information, and timestamps.
- Reclassification should be supported by storing classification results separately from submission metadata.
- The admin panel should show the latest classification result by default.
- Any future model-provider implementation must use the same output schema and must not bypass the safety rules in this ADR.

## 10. Future evolution

The classification system may evolve in the following ways:

- Add a model-provider classifier for optional visual suitability checks.
- Add a moderation provider for stronger unsafe-content detection.
- Add asynchronous classification with RabbitMQ and Celery for better upload responsiveness and retry handling.
- Add dead-letter handling for failed classification jobs.
- Add idempotency keys to avoid duplicate classification results during retries.
- Add classification result versioning to support rule changes and reclassification.
- Add admin filters for review decision, category, provider, fallback status, and classification timestamp.
- Add observability metrics for classification latency, failure rate, fallback rate, and manual-review rate.

Future model-provider support must remain opt-in. The platform must not send user photos or unnecessary personal metadata to external providers unless this is explicitly configured, documented, and justified.
