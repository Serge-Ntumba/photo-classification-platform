import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useApiClient, useSession } from "@/app/providers";
import { AppShell } from "@/components/layout/AppShell";
import { StatusMessage } from "@/components/layout/feedback";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PhotoSelector } from "@/features/submissions/components/PhotoSelector";
import { SubmissionMetadataFields } from "@/features/submissions/components/SubmissionMetadataFields";
import { createSubmission } from "@/features/submissions/api";
import {
  getFirstSubmissionErrorField,
  mapCreateSubmissionApiError,
  validateSubmissionDraft,
  type PhotoSelectionValue,
  type SubmissionFormErrors,
  type SubmissionFormField,
  type SubmissionFormValues,
} from "@/features/submissions/validation";
import type { SubmissionDetail } from "@/lib/models";
import { getStatusDisplay, safeDocumentTitle } from "@/lib/safe-display";

const initialValues: SubmissionFormValues = {
  name: "",
  age: "",
  placeOfLiving: "",
  gender: "",
  countryOfOrigin: "",
  description: "",
};

const emptyErrors: SubmissionFormErrors = {
  fields: {},
  photo: null,
  form: null,
  uncertainOutcome: false,
};

export function CreateSubmissionPage() {
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const { session, signOut } = useSession();
  const [values, setValues] = useState(initialValues);
  const [photoSelection, setPhotoSelection] = useState<PhotoSelectionValue | null>(
    null,
  );
  const [errors, setErrors] = useState<SubmissionFormErrors>(emptyErrors);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSubmission, setCreatedSubmission] = useState<SubmissionDetail | null>(
    null,
  );
  const [clearPhotoSignal, setClearPhotoSignal] = useState(0);
  const fieldRefs = {
    name: useRef<HTMLInputElement>(null),
    age: useRef<HTMLInputElement>(null),
    placeOfLiving: useRef<HTMLInputElement>(null),
    gender: useRef<HTMLInputElement>(null),
    countryOfOrigin: useRef<HTMLInputElement>(null),
    description: useRef<HTMLTextAreaElement>(null),
  };
  const photoContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = safeDocumentTitle("Create submission");
  }, []);

  const firstErrorField = useMemo(() => getFirstSubmissionErrorField(errors), [errors]);

  useEffect(() => {
    if (!isSubmitting) {
      return undefined;
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isSubmitting]);

  function focusFirstError(nextErrors: SubmissionFormErrors) {
    const field = getFirstSubmissionErrorField(nextErrors);
    if (!field) {
      return;
    }

    window.setTimeout(() => {
      if (field === "photo") {
        photoContainerRef.current?.querySelector("input")?.focus();
        return;
      }
      fieldRefs[field]?.current?.focus();
    }, 0);
  }

  function updateValue(field: SubmissionFormField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      ...current,
      fields: { ...current.fields, [field]: undefined },
      form: null,
      uncertainOutcome: false,
    }));
  }

  function handlePhotoChange(selection: PhotoSelectionValue | null) {
    setPhotoSelection(selection);
    setErrors((current) => ({
      ...current,
      photo: null,
      form: null,
      uncertainOutcome: false,
    }));
  }

  function clearSelectedPhoto() {
    setPhotoSelection(null);
    setClearPhotoSignal((signal) => signal + 1);
  }

  function handleSignOut() {
    signOut();
    navigate("/login?signedOut=1", { replace: true });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setCreatedSubmission(null);
    const validation = await validateSubmissionDraft(
      values,
      photoSelection?.file ?? null,
    );
    if (!validation.success) {
      setErrors(validation.errors);
      focusFirstError(validation.errors);
      return;
    }

    setIsSubmitting(true);
    setErrors(emptyErrors);
    try {
      const created = await createSubmission(apiClient, {
        ...validation.data,
        photo: photoSelection?.file as File,
      });
      setCreatedSubmission(created);
      setValues(initialValues);
      clearSelectedPhoto();
    } catch (error) {
      const nextErrors = mapCreateSubmissionApiError(error);
      setErrors(nextErrors);
      focusFirstError(nextErrors);
    } finally {
      setIsSubmitting(false);
    }
  }

  const createdStatus = createdSubmission
    ? getStatusDisplay(createdSubmission.status)
    : null;

  return (
    <AppShell user={session.user} onSignOut={handleSignOut}>
      <section className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Create submission</h1>
          <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">
            Add one photo and the required user-submitted metadata. Classification
            starts asynchronously after the platform accepts the submission.
          </p>
        </div>

        {createdSubmission ? (
          <Alert>
            <AlertTitle>Submission created</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>The submission was accepted for asynchronous review.</p>
              {createdStatus ? (
                <StatusMessage tone="info" label={createdStatus.label} />
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Button asChild size="sm">
                  <Link to={`/app/submissions/${createdSubmission.id}`}>
                    Open created submission
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/app/submissions">View submissions</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {errors.form ? (
          <Alert variant="destructive">
            <AlertTitle>Submission could not be confirmed</AlertTitle>
            <AlertDescription>
              <p>{errors.form}</p>
              {errors.uncertainOutcome ? (
                <Button asChild className="mt-3" size="sm" variant="outline">
                  <Link to="/app/submissions">Check submissions</Link>
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        {firstErrorField ? (
          <div role="alert" className="text-sm font-medium text-destructive">
            {firstErrorField === "photo"
              ? errors.photo
              : errors.fields[firstErrorField]}
          </div>
        ) : null}

        <form className="space-y-6" onSubmit={onSubmit} noValidate>
          <div ref={photoContainerRef}>
            <PhotoSelector
              key={clearPhotoSignal}
              value={photoSelection}
              onPhotoChange={handlePhotoChange}
              error={errors.photo}
              disabled={isSubmitting}
            />
          </div>

          <SubmissionMetadataFields
            values={values}
            errors={errors.fields}
            disabled={isSubmitting}
            fieldRefs={fieldRefs}
            onChange={updateValue}
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting" : "Create submission"}
            </Button>
            <Button asChild variant="outline">
              <Link to="/app">Return to workspace</Link>
            </Button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
