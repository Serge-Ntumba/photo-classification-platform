import type { ClassificationSummary as ClassificationSummaryModel } from "@/lib/models";
import {
  formatDisplayDateTime,
  getCategoryLabel,
  getDecisionLabel,
} from "@/lib/safe-display";

type ClassificationSummaryProps = {
  classification: ClassificationSummaryModel | null;
  compact?: boolean;
};

const FALLBACK_REASON = "Review details are unavailable.";

function reasonsForDisplay(classification: ClassificationSummaryModel | null) {
  if (!classification || classification.reasons.length === 0) {
    return [FALLBACK_REASON];
  }

  return classification.reasons;
}

export function ClassificationSummary({
  classification,
  compact = false,
}: ClassificationSummaryProps) {
  const reasons = reasonsForDisplay(classification);

  if (compact) {
    if (!classification) {
      return <p className="text-muted-foreground">{FALLBACK_REASON}</p>;
    }

    return (
      <div
        className="space-y-1 text-muted-foreground"
        aria-label="Latest review summary"
      >
        <p>{getDecisionLabel(classification.reviewDecision)}</p>
        <p>{getCategoryLabel(classification.category)}</p>
        <p className="break-words [overflow-wrap:anywhere]">{reasons[0]}</p>
      </div>
    );
  }

  return (
    <section className="rounded-md border border-border p-4">
      <h2 className="text-base font-semibold tracking-normal">Latest review summary</h2>
      {!classification ? (
        <p className="mt-2 text-sm text-muted-foreground">{FALLBACK_REASON}</p>
      ) : (
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">Review decision</dt>
            <dd className="mt-1 text-muted-foreground">
              {getDecisionLabel(classification.reviewDecision)}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Category</dt>
            <dd className="mt-1 text-muted-foreground">
              {getCategoryLabel(classification.category)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium">Reasons</dt>
            <dd className="mt-1 space-y-1 text-muted-foreground">
              {reasons.map((reason, index) => (
                <p
                  key={`${reason}-${index}`}
                  className="break-words [overflow-wrap:anywhere]"
                >
                  {reason}
                </p>
              ))}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Classified time</dt>
            <dd className="mt-1 text-muted-foreground">
              {formatDisplayDateTime(classification.classifiedAt)}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
