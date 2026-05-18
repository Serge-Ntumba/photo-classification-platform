import * as React from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { safeErrorMessage } from "@/lib/safe-display";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: React.ReactNode;
};

type SafeErrorStateProps = {
  title?: string;
  message: string;
  className?: string;
};

type StatusTone = "info" | "success" | "warning" | "error" | "neutral";

const toneClasses: Record<StatusTone, string> = {
  info: "border-blue-200 bg-blue-50 text-blue-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-950",
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  neutral: "border-border bg-muted text-foreground",
};

export function LoadingState({ label = "Loading" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground"
    >
      {label}
    </div>
  );
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <section className="rounded-md border border-dashed border-border p-6">
      <h2 className="text-lg font-semibold tracking-normal">{title}</h2>
      <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

export function SafeErrorState({
  title = "Request failed",
  message,
  className,
}: SafeErrorStateProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{safeErrorMessage(message)}</AlertDescription>
    </Alert>
  );
}

export function StatusMessage({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full whitespace-normal break-words",
        toneClasses[tone],
        className,
      )}
    >
      {label}
    </Badge>
  );
}

export function LiveRegion({
  message,
  politeness = "polite",
}: {
  message: string;
  politeness?: "polite" | "assertive";
}) {
  return (
    <div
      role="status"
      aria-label="Status update"
      aria-live={politeness}
      className="sr-only"
    >
      {message}
    </div>
  );
}
