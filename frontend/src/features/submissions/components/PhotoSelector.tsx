import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerProtectedStateCleanup } from "@/lib/auth-session";
import { validateImageDimensions, validateImageFile } from "@/lib/validation";
import {
  inspectImageDimensions,
  type ImageDimensionInspector,
  type PhotoSelectionValue,
} from "@/features/submissions/validation";

type PhotoSelectorProps = {
  value: PhotoSelectionValue | null;
  onPhotoChange: (value: PhotoSelectionValue | null) => void;
  error?: string | null;
  disabled?: boolean;
  inspectDimensions?: ImageDimensionInspector;
};

function previewUnavailable() {
  return "Preview unavailable";
}

export function PhotoSelector({
  onPhotoChange,
  error = null,
  disabled = false,
  inspectDimensions = inspectImageDimensions,
}: PhotoSelectorProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [internalError, setInternalError] = useState<string | null>(null);
  const [previewFailed, setPreviewFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const onPhotoChangeRef = useRef(onPhotoChange);

  useEffect(() => {
    onPhotoChangeRef.current = onPhotoChange;
  }, [onPhotoChange]);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  const clearSelection = useCallback(() => {
    revokePreview();
    setInternalError(null);
    setPreviewFailed(false);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    onPhotoChangeRef.current(null);
  }, [revokePreview]);

  useEffect(() => {
    return registerProtectedStateCleanup(clearSelection);
  }, [clearSelection]);

  useEffect(() => revokePreview, [revokePreview]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      clearSelection();
      return;
    }

    revokePreview();
    setInternalError(null);
    setPreviewFailed(false);
    onPhotoChange(null);

    const basicIssues = validateImageFile(file);
    if (basicIssues.length > 0) {
      setInternalError(basicIssues[0]?.message ?? "Correct the selected photo.");
      return;
    }

    try {
      const url = URL.createObjectURL(file);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    } catch {
      setPreviewFailed(true);
    }

    const dimensions = await inspectDimensions(file);
    if (!dimensions.ok) {
      setInternalError(dimensions.message);
      revokePreview();
      return;
    }

    const dimensionIssues = validateImageDimensions(
      dimensions.width,
      dimensions.height,
    );
    if (dimensionIssues.length > 0) {
      setInternalError(
        dimensionIssues[0]?.message ?? "Correct the selected photo dimensions.",
      );
      revokePreview();
      return;
    }

    onPhotoChange({
      file,
      width: dimensions.width,
      height: dimensions.height,
    });
  }

  const displayError = error ?? internalError;

  return (
    <section className="min-w-0 space-y-3 rounded-md border border-border p-4">
      <div className="space-y-2">
        <Label htmlFor="submission-photo">Photo</Label>
        <Input
          id="submission-photo"
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-invalid={Boolean(displayError)}
          aria-describedby="submission-photo-help submission-photo-error"
          disabled={disabled}
          onChange={handleFileChange}
        />
        <p
          id="submission-photo-help"
          className="content-safe-wrap text-sm text-muted-foreground"
        >
          JPEG, PNG, or WebP. Maximum 5 MB. Dimensions from 300x300 through 5000x5000
          pixels.
        </p>
      </div>

      <div className="rounded-md border border-dashed border-border p-3">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Selected photo preview"
            className="aspect-square max-h-64 w-full rounded-md object-contain"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No photo selected</p>
        )}
      </div>

      {previewUrl ? (
        <p className="text-sm font-medium text-foreground">Photo selected</p>
      ) : null}
      {previewFailed ? (
        <p className="text-sm text-muted-foreground">{previewUnavailable()}</p>
      ) : null}
      {displayError ? (
        <p
          id="submission-photo-error"
          role="alert"
          className="text-sm text-destructive"
        >
          {displayError}
        </p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full sm:w-auto"
        disabled={disabled}
        onClick={clearSelection}
      >
        Clear selected photo
      </Button>
    </section>
  );
}
