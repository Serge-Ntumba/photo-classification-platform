import { Link } from "react-router-dom";

import { StatusMessage } from "@/components/layout/feedback";
import { Button } from "@/components/ui/button";
import { ClassificationSummary } from "@/features/submissions/components/ClassificationSummary";
import {
  latestSummaryLabel,
  statusTone,
} from "@/features/submissions/submission-state";
import type { SubmissionSummary } from "@/lib/models";
import {
  formatDisplayDateTime,
  getStatusDisplay,
  safeUserSubmittedText,
} from "@/lib/safe-display";

type SubmissionListItemProps = {
  submission: SubmissionSummary;
};

export function SubmissionListItem({ submission }: SubmissionListItemProps) {
  const status = getStatusDisplay(submission.status);
  const classification = submission.classification;

  return (
    <article className="rounded-md border border-border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <h2 className="break-words text-base font-semibold tracking-normal">
            {safeUserSubmittedText(submission.name, "Submission")}
          </h2>
          <p className="text-sm text-muted-foreground">
            Created {formatDisplayDateTime(submission.createdAt)}
          </p>
          <StatusMessage tone={statusTone(submission.status)} label={status.label} />
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/app/submissions/${encodeURIComponent(submission.id)}`}>
            Open details
          </Link>
        </Button>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <p className="font-medium">Latest review summary</p>
        {classification ? (
          <ClassificationSummary classification={classification} compact />
        ) : (
          <p className="text-muted-foreground">{latestSummaryLabel(submission)}</p>
        )}
      </div>
    </article>
  );
}
