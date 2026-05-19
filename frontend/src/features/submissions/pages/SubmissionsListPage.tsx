import { RefreshCw } from "lucide-react";
import { useCallback, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { useApiClient, useSession } from "@/app/providers";
import { AppShell } from "@/components/layout/AppShell";
import {
  EmptyState,
  LiveRegion,
  LoadingState,
  SafeErrorState,
} from "@/components/layout/feedback";
import { Button } from "@/components/ui/button";
import { listSubmissions } from "@/features/submissions/api";
import { SubmissionFilters } from "@/features/submissions/components/SubmissionFilters";
import { SubmissionListItem } from "@/features/submissions/components/SubmissionListItem";
import { useSubmissionRefresh } from "@/features/submissions/hooks/useSubmissionRefresh";
import {
  buildSubmissionsPath,
  emptyListDescription,
  emptyListTitle,
  formatLastChecked,
  pageRangeLabel,
  parsePageParam,
  parseStatusFilter,
} from "@/features/submissions/submission-state";
import { isApiError } from "@/lib/api-client";
import { defaultErrorMessage, safeDocumentTitle } from "@/lib/safe-display";

export function SubmissionsListPage() {
  const apiClient = useApiClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, signOut } = useSession();
  const page = parsePageParam(searchParams.get("page"));
  const status = parseStatusFilter(searchParams.get("status"));
  const load = useCallback(
    () => listSubmissions(apiClient, { page, status }),
    [apiClient, page, status],
  );
  const { data, error, isLoading, isRefreshing, lastCheckedAt, refresh } =
    useSubmissionRefresh(load, `submissions:${page}:${status ?? "all"}`);

  useEffect(() => {
    document.title = safeDocumentTitle("Submissions");
  }, []);

  function handleSignOut() {
    signOut();
    navigate("/login?signedOut=1", { replace: true });
  }

  function handleStatusChange(nextStatus: typeof status) {
    navigate(buildSubmissionsPath({ page: 1, status: nextStatus }));
  }

  function renderContent() {
    if (isLoading) {
      return <LoadingState label="Loading submissions" />;
    }

    if (error) {
      if (isApiError(error) && error.scope === "not_found") {
        return (
          <EmptyState
            title="Page unavailable"
            description="That submissions page is unavailable."
            action={
              <Button asChild variant="outline">
                <Link to="/app/submissions">Return to first page</Link>
              </Button>
            }
          />
        );
      }

      return (
        <SafeErrorState
          title="Submissions unavailable"
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

    if (data.results.length === 0) {
      return (
        <EmptyState
          title={emptyListTitle(status)}
          description={emptyListDescription(status)}
          action={
            status ? (
              <Button asChild variant="outline">
                <Link to="/app/submissions">Clear filter</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link to="/app/submissions/new">Create a submission</Link>
              </Button>
            )
          }
        />
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>{pageRangeLabel(data)}</p>
          <div className="flex flex-wrap gap-2">
            {data.hasPreviousPage && data.previousPage ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  aria-label="Go to previous page"
                  to={buildSubmissionsPath({
                    page: data.previousPage,
                    status: data.statusFilter,
                  })}
                >
                  Previous
                </Link>
              </Button>
            ) : null}
            {data.hasNextPage && data.nextPage ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  aria-label="Go to next page"
                  to={buildSubmissionsPath({
                    page: data.nextPage,
                    status: data.statusFilter,
                  })}
                >
                  Next
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
        <div className="grid gap-4">
          {data.results.map((submission) => (
            <SubmissionListItem key={submission.id} submission={submission} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <AppShell user={session.user} onSignOut={handleSignOut}>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">Submissions</h1>
            <p className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">
              Review your own submissions and refresh asynchronous classification
              status.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refresh("manual")}
            disabled={isLoading || isRefreshing}
            aria-label="Refresh submissions"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {isRefreshing ? "Refreshing" : "Refresh submissions"}
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <SubmissionFilters
            status={status}
            disabled={isLoading || isRefreshing}
            onStatusChange={handleStatusChange}
          />
          {lastCheckedAt ? (
            <p className="text-sm text-muted-foreground">
              {formatLastChecked(lastCheckedAt)}
            </p>
          ) : null}
        </div>

        {renderContent()}
        <LiveRegion
          message={
            isRefreshing
              ? "Refreshing submissions"
              : lastCheckedAt
                ? formatLastChecked(lastCheckedAt)
                : ""
          }
        />
      </section>
    </AppShell>
  );
}
