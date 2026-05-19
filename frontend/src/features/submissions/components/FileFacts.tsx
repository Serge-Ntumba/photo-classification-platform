import { formatFileSize } from "@/features/submissions/submission-state";
import type { FileFacts as FileFactsModel } from "@/lib/models";

type FileFactsProps = {
  fileFacts: FileFactsModel | null;
};

export function FileFacts({ fileFacts }: FileFactsProps) {
  return (
    <section className="rounded-md border border-border p-4">
      <h2 className="text-base font-semibold tracking-normal">File facts</h2>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Content type</dt>
          <dd className="mt-1 text-muted-foreground">
            {fileFacts?.contentType ?? "Unavailable"}
          </dd>
        </div>
        <div>
          <dt className="font-medium">File size</dt>
          <dd className="mt-1 text-muted-foreground">
            {formatFileSize(fileFacts?.sizeBytes ?? null)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
