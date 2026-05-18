import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { useApiClient, useSession } from "@/app/providers";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/features/auth/api";
import {
  errorsFromZod,
  getFirstAuthErrorField,
  mapAuthApiError,
  resolveSafeReturnTo,
  validateLogin,
  type AuthField,
  type AuthFormErrors,
  type LoginFormValues,
} from "@/features/auth/validation";

const initialValues: LoginFormValues = {
  email: "",
  password: "",
};

const emptyErrors: AuthFormErrors = {
  fields: {},
  form: null,
};

export function LoginPage() {
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, setAuthenticatedSession } = useSession();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<AuthFormErrors>(emptyErrors);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fieldRefs = useRef<Record<AuthField, HTMLInputElement | null>>({
    email: null,
    username: null,
    password: null,
  });

  const firstErrorField = useMemo(
    () => getFirstAuthErrorField(errors.fields),
    [errors.fields],
  );
  const safeReturnTo = resolveSafeReturnTo(searchParams.get("returnTo"));

  if (session.status === "authenticated") {
    return <Navigate to={safeReturnTo.path} replace />;
  }

  function focusFirstError(nextErrors: AuthFormErrors) {
    const field = getFirstAuthErrorField(nextErrors.fields);
    if (field) {
      window.setTimeout(() => fieldRefs.current[field]?.focus(), 0);
    }
  }

  function updateValue(field: "email" | "password", value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      form: current.form,
      fields: { ...current.fields, [field]: undefined },
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = validateLogin(values);
    if (!parsed.success) {
      const nextErrors = errorsFromZod(parsed.error);
      setErrors(nextErrors);
      focusFirstError(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors(emptyErrors);
    try {
      const result = await login(apiClient, parsed.data);
      setAuthenticatedSession(result.accessToken, result.user);
      const target =
        safeReturnTo.usedFallback && searchParams.has("returnTo")
          ? "/app?notice=return-unavailable"
          : safeReturnTo.path;
      navigate(target, { replace: true });
    } catch (error) {
      const nextErrors = mapAuthApiError(error, "login");
      setErrors(nextErrors);
      focusFirstError(nextErrors);
    } finally {
      setIsSubmitting(false);
    }
  }

  const sessionMessage =
    searchParams.get("session") === "expired"
      ? "Your session expired. Log in again."
      : null;
  const registrationMessage =
    searchParams.get("registered") === "1"
      ? "Registration complete. Log in to continue."
      : null;

  return (
    <PublicLayout>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-normal">
        Sign in to continue
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
        Your session is required before this protected workflow can show submission
        data.
      </p>

      <form className="mt-8 max-w-md space-y-5" onSubmit={onSubmit} noValidate>
        {registrationMessage ? (
          <div
            role="status"
            className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          >
            {registrationMessage}
          </div>
        ) : null}
        {sessionMessage ? (
          <div
            role="status"
            className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          >
            {sessionMessage}
          </div>
        ) : null}
        {errors.form ? (
          <Alert variant="destructive">
            <AlertTitle>Login failed</AlertTitle>
            <AlertDescription>{errors.form}</AlertDescription>
          </Alert>
        ) : null}
        {firstErrorField ? (
          <div role="alert" className="text-sm font-medium text-destructive">
            {errors.fields[firstErrorField]}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            ref={(element) => {
              fieldRefs.current.email = element;
            }}
            type="email"
            autoComplete="email"
            value={values.email}
            aria-invalid={Boolean(errors.fields.email)}
            aria-describedby={errors.fields.email ? "login-email-error" : undefined}
            onChange={(event) => updateValue("email", event.target.value)}
          />
          {errors.fields.email ? (
            <p id="login-email-error" className="text-sm text-destructive">
              {errors.fields.email}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            ref={(element) => {
              fieldRefs.current.password = element;
            }}
            type="password"
            autoComplete="current-password"
            value={values.password}
            aria-invalid={Boolean(errors.fields.password)}
            aria-describedby={
              errors.fields.password ? "login-password-error" : undefined
            }
            onChange={(event) => updateValue("password", event.target.value)}
          />
          {errors.fields.password ? (
            <p id="login-password-error" className="text-sm text-destructive">
              {errors.fields.password}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Logging in" : "Log in"}
          </Button>
          <Button asChild variant="link">
            <Link to="/register">Create account</Link>
          </Button>
        </div>
      </form>
    </PublicLayout>
  );
}
