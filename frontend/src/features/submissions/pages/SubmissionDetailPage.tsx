import { RefreshCw } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { useApiClient, useSession } from "@/app/providers";
import { AppShell } from "@/components/layout/AppShell";
import {
  EmptyState,
  LiveRegion,
  LoadingState,
  SafeErrorState,
  StatusMessage,
} from "@/components/layout/feedback";
import { Button } from "@/components/ui/button";
import { getSubmission } from "@/features/submissions/api";
import { ClassificationSummary } from "@/features/submissions/components/ClassificationSummary";
import { FileFacts } from "@/features/submissions/components/FileFacts";
import { UserSubmittedMetadata } from "@/features/submissions/components/UserSubmittedMetadata";
import { useSubmissionRefresh } from "@/features/submissions/hooks/useSubmissionRefresh";
import { formatLastChecked, statusTone } from "@/features/submissions/submission-state";
import { isApiError } from "@/lib/api-client";
import {
  defaultErrorMessage,
  formatDisplayDateTime,
  getStatusDisplay,
  safeDocumentTitle,
} from "@/lib/safe-display";

export function SubmissionDetailPage() {
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const { id } = useParams();
  const { session, signOut } = useSession();
  const submissionId = id ?? "";
  const load = useCallback(
    () => getSubmission(apiClient, submissionId),
    [apiClient, submissionId],
  );
  const { data, error, isLoading, isRefreshing, lastCheckedAt, refresh } =
    useSubmissionRefresh(load, `submission:${submissionId}`);

  useEffect(() => {
    document.title = safeDocumentTitle("Submission detail");
  }, []);

  function handleSignOut() {
    signOut();
    navigate("/login?signedOut=1", { replace: true });
  }

  function renderContent() {
    if (!submissionId) {
      return (
        <EmptyState
          title="Submission unavailable"
          description="The requested submission could not be found or cannot be accessed."
        />
      );
    }

    if (isLoading) {
      return <LoadingState label="Loading submission" />;
    }

    if (error) {
      if (isApiError(error) && error.scope === "not_found") {
        return (
          <EmptyState
            title="Submission unavailable"
            description="The requested submission could not be found or cannot be accessed."
          />
        );
      }

      return (
        <SafeErrorState
          title="Submission unavailable"
          message={
            isApiError(error) && error.scope === "service_unavailable"
              ? defaultErrorMessage("service_unavailable")
              : isApiError(error)
                ? error.message
                : "Something went wrong."
          }
        />
      );
    }

    if (!data) {
      return null;
    }

    const status = getStatusDisplay(data.status);
    const checkedAt = lastCheckedAt;

    return (
      <div className="space-y-6">
        <section className="rounded-md border border-border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-base font-semibold tracking-normal">
                Submission status
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">{status.guidance}</p>
            </div>
            <StatusMessage tone={statusTone(data.status)} label={status.label} />
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-medium">Created</dt>
              <dd className="mt-1 text-muted-foreground">
                {formatDisplayDateTime(data.createdAt)}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Updated</dt>
              <dd className="mt-1 text-muted-foreground">
                {formatDisplayDateTime(data.updatedAt)}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Last checked</dt>
              <dd className="mt-1 text-muted-foreground">
                {formatDisplayDateTime(checkedAt)}
              </dd>
            </div>
          </dl>
        </section>

        <ClassificationSummary classification={data.classification} />

        <UserSubmittedMetadata metadata={data.metadata} />

        <FileFacts fileFacts={data.fileFacts} />
      </div>
    );
  }

  return (
    <AppShell user={session.user} onSignOut={handleSignOut}>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">
              Submission detail
            </h1>
            <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">
              Review submitted metadata, current status, and the latest safe
              classification summary.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link to="/app/submissions">Return to submissions</Link>
            </Button>
            <Button
              type="button"
              onClick={() => void refresh("manual")}
              disabled={isLoading || isRefreshing}
              aria-label="Refresh status"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {isRefreshing ? "Refreshing" : "Refresh status"}
            </Button>
          </div>
        </div>

        {lastCheckedAt ? (
          <p className="text-sm text-muted-foreground">
            {formatLastChecked(lastCheckedAt)}
          </p>
        ) : null}

        {renderContent()}
        <LiveRegion
          message={
            isRefreshing
              ? "Refreshing submission status"
              : lastCheckedAt
                ? formatLastChecked(lastCheckedAt)
                : ""
          }
        />
      </section>
    </AppShell>
  );
}
