import type { UserSubmittedMetadata as UserSubmittedMetadataModel } from "@/lib/models";
import { safeUserSubmittedText } from "@/lib/safe-display";

type UserSubmittedMetadataProps = {
  metadata: UserSubmittedMetadataModel;
};

type TextFieldProps = {
  label: string;
  value: unknown;
  fallback?: string;
  className?: string;
};

function TextField({
  label,
  value,
  fallback = "Unavailable",
  className,
}: TextFieldProps) {
  return (
    <div className={className}>
      <dt className="font-medium">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-muted-foreground">
        {safeUserSubmittedText(value, fallback)}
      </dd>
    </div>
  );
}

export function UserSubmittedMetadata({ metadata }: UserSubmittedMetadataProps) {
  return (
    <section className="rounded-md border border-border p-4">
      <h2 className="text-base font-semibold tracking-normal">
        User-submitted metadata
      </h2>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <TextField label="Name" value={metadata.name} />
        <div>
          <dt className="font-medium">Age</dt>
          <dd className="mt-1 text-muted-foreground">
            {metadata.age ?? "Unavailable"}
          </dd>
        </div>
        <TextField label="Place of living" value={metadata.placeOfLiving} />
        <TextField label="Gender" value={metadata.gender} />
        <TextField label="Country of origin" value={metadata.countryOfOrigin} />
        <TextField
          label="Description"
          value={metadata.description}
          fallback="No description provided."
          className="sm:col-span-2"
        />
      </dl>
    </section>
  );
}
