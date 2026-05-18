import { useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useApiClient } from "@/app/providers";
import { SafeErrorState } from "@/components/layout/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { registerAccount } from "@/features/auth/api";
import {
  errorsFromZod,
  getFirstAuthErrorField,
  mapAuthApiError,
  validateRegistration,
  type AuthField,
  type AuthFormErrors,
  type RegistrationFormValues,
} from "@/features/auth/validation";

const initialValues: RegistrationFormValues = {
  email: "",
  username: "",
  password: "",
};

const emptyErrors: AuthFormErrors = {
  fields: {},
  form: null,
};

export function RegisterPage() {
  const apiClient = useApiClient();
  const navigate = useNavigate();
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

  function focusFirstError(nextErrors: AuthFormErrors) {
    const field = getFirstAuthErrorField(nextErrors.fields);
    if (field) {
      window.setTimeout(() => fieldRefs.current[field]?.focus(), 0);
    }
  }

  function updateValue(field: AuthField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({
      form: current.form,
      fields: { ...current.fields, [field]: undefined },
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = validateRegistration(values);
    if (!parsed.success) {
      const nextErrors = errorsFromZod(parsed.error);
      setErrors(nextErrors);
      focusFirstError(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setErrors(emptyErrors);
    try {
      await registerAccount(apiClient, parsed.data);
      navigate("/login?registered=1", { replace: true });
    } catch (error) {
      const nextErrors = mapAuthApiError(error, "register");
      setErrors(nextErrors);
      focusFirstError(nextErrors);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PublicLayout>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-normal">
        Create an account
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
        Create a normal account to start submitting photos for review.
      </p>

      <form className="mt-8 max-w-md space-y-5" onSubmit={onSubmit} noValidate>
        {errors.form ? (
          <SafeErrorState title="Registration failed" message={errors.form} />
        ) : null}
        {firstErrorField ? (
          <div role="alert" className="text-sm font-medium text-destructive">
            {errors.fields[firstErrorField]}
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="register-email">Email</Label>
          <Input
            id="register-email"
            ref={(element) => {
              fieldRefs.current.email = element;
            }}
            type="email"
            autoComplete="email"
            value={values.email}
            aria-invalid={Boolean(errors.fields.email)}
            aria-describedby={errors.fields.email ? "register-email-error" : undefined}
            onChange={(event) => updateValue("email", event.target.value)}
          />
          {errors.fields.email ? (
            <p id="register-email-error" className="text-sm text-destructive">
              {errors.fields.email}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-username">Username</Label>
          <Input
            id="register-username"
            ref={(element) => {
              fieldRefs.current.username = element;
            }}
            type="text"
            autoComplete="username"
            value={values.username}
            aria-invalid={Boolean(errors.fields.username)}
            aria-describedby={
              errors.fields.username ? "register-username-error" : undefined
            }
            onChange={(event) => updateValue("username", event.target.value)}
          />
          {errors.fields.username ? (
            <p id="register-username-error" className="text-sm text-destructive">
              {errors.fields.username}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-password">Password</Label>
          <Input
            id="register-password"
            ref={(element) => {
              fieldRefs.current.password = element;
            }}
            type="password"
            autoComplete="new-password"
            value={values.password}
            aria-invalid={Boolean(errors.fields.password)}
            aria-describedby={
              errors.fields.password ? "register-password-error" : undefined
            }
            onChange={(event) => updateValue("password", event.target.value)}
          />
          {errors.fields.password ? (
            <p id="register-password-error" className="text-sm text-destructive">
              {errors.fields.password}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account" : "Create account"}
          </Button>
          <Button asChild variant="link">
            <Link to="/login">Log in instead</Link>
          </Button>
        </div>
      </form>
    </PublicLayout>
  );
}
