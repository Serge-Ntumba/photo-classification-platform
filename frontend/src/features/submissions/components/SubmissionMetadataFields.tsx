import type { RefObject } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
  SubmissionFormErrors,
  SubmissionFormField,
  SubmissionFormValues,
} from "@/features/submissions/validation";

type FieldRefs = Partial<
  Record<Exclude<SubmissionFormField, "description">, RefObject<HTMLInputElement>>
> & {
  description?: RefObject<HTMLTextAreaElement>;
};

type SubmissionMetadataFieldsProps = {
  values: SubmissionFormValues;
  errors: SubmissionFormErrors["fields"];
  disabled?: boolean;
  fieldRefs?: FieldRefs & {
    description?: RefObject<HTMLTextAreaElement>;
  };
  onChange: (field: SubmissionFormField, value: string) => void;
};

type InputField = Exclude<SubmissionFormField, "description">;

const inputFields: Array<{
  field: InputField;
  label: string;
  autoComplete?: string;
  type?: string;
  maxLength: number;
}> = [
  { field: "name", label: "Name", maxLength: 255 },
  { field: "age", label: "Age", type: "number", maxLength: 3 },
  { field: "placeOfLiving", label: "Place of living", maxLength: 255 },
  { field: "gender", label: "Gender", maxLength: 100 },
  { field: "countryOfOrigin", label: "Country of origin", maxLength: 255 },
];

function fieldId(field: SubmissionFormField) {
  return `submission-${field}`;
}

export function SubmissionMetadataFields({
  values,
  errors,
  disabled = false,
  fieldRefs,
  onChange,
}: SubmissionMetadataFieldsProps) {
  return (
    <div className="grid min-w-0 gap-4 md:grid-cols-2">
      {inputFields.map(({ field, label, type = "text", maxLength }) => (
        <div key={field} className="min-w-0 space-y-2">
          <Label htmlFor={fieldId(field)}>{label}</Label>
          <Input
            id={fieldId(field)}
            ref={fieldRefs?.[field]}
            type={type}
            inputMode={field === "age" ? "numeric" : undefined}
            min={field === "age" ? 0 : undefined}
            max={field === "age" ? 120 : undefined}
            maxLength={maxLength}
            value={values[field]}
            aria-invalid={Boolean(errors[field])}
            aria-describedby={errors[field] ? `${fieldId(field)}-error` : undefined}
            disabled={disabled}
            onChange={(event) => onChange(field, event.target.value)}
          />
          {errors[field] ? (
            <p id={`${fieldId(field)}-error`} className="text-sm text-destructive">
              {errors[field]}
            </p>
          ) : null}
        </div>
      ))}

      <div className="min-w-0 space-y-2 md:col-span-2">
        <Label htmlFor={fieldId("description")}>Description</Label>
        <Textarea
          id={fieldId("description")}
          ref={fieldRefs?.description}
          maxLength={1000}
          value={values.description}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={
            errors.description ? `${fieldId("description")}-error` : undefined
          }
          disabled={disabled}
          onChange={(event) => onChange("description", event.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          Optional. Up to 1,000 characters.
        </p>
        {errors.description ? (
          <p
            id={`${fieldId("description")}-error`}
            className="text-sm text-destructive"
          >
            {errors.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
