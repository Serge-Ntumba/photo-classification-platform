import type { SubmissionStatus } from "@/lib/models";
import { Label } from "@/components/ui/label";
import {
  ALL_STATUS_FILTER_VALUE,
  getStatusFilterLabel,
  statusFilterOptions,
} from "@/features/submissions/submission-state";

type SubmissionFiltersProps = {
  status: SubmissionStatus | null;
  disabled?: boolean;
  onStatusChange: (status: SubmissionStatus | null) => void;
};

export function SubmissionFilters({
  status,
  disabled = false,
  onStatusChange,
}: SubmissionFiltersProps) {
  return (
    <div className="grid max-w-xs gap-2">
      <Label htmlFor="submission-status-filter">Status filter</Label>
      <select
        id="submission-status-filter"
        aria-label="Status filter"
        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        value={status ?? ALL_STATUS_FILTER_VALUE}
        onChange={(event) => {
          const value = event.currentTarget.value;
          onStatusChange(
            value === ALL_STATUS_FILTER_VALUE ? null : (value as SubmissionStatus),
          );
        }}
      >
        <option value={ALL_STATUS_FILTER_VALUE}>All statuses</option>
        {statusFilterOptions().map((option) => (
          <option key={option.value} value={option.value}>
            {getStatusFilterLabel(option.value)}
          </option>
        ))}
      </select>
    </div>
  );
}
