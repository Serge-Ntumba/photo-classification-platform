import { useId } from "react";

import { Button } from "@/components/ui/button";
import { getDjangoAdminUrl } from "@/lib/config";

type StaffReviewEntryProps = {
  adminUrl?: string;
};

export function StaffReviewEntry({
  adminUrl = getDjangoAdminUrl(),
}: StaffReviewEntryProps) {
  const descriptionId = useId();

  return (
    <div className="flex min-w-0 flex-col gap-1 sm:max-w-56">
      <Button asChild variant="secondary" size="sm" className="w-full sm:w-auto">
        <a href={adminUrl} aria-describedby={descriptionId}>
          Staff review
        </a>
      </Button>
      <span
        id={descriptionId}
        className="content-safe-wrap text-xs leading-5 text-muted-foreground"
      >
        Django Admin may require a separate admin login.
      </span>
    </div>
  );
}
