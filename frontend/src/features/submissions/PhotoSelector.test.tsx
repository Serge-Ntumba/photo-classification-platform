import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PhotoSelector } from "@/features/submissions/components/PhotoSelector";
import type { PhotoSelectionValue } from "@/features/submissions/validation";

function photoFile(name = "local-secret-name.jpg") {
  return new File(["photo"], name, { type: "image/jpeg" });
}

function renderSelector(
  props: Partial<React.ComponentProps<typeof PhotoSelector>> = {},
) {
  const onPhotoChange = vi.fn();
  const view = render(
    <PhotoSelector
      value={null}
      onPhotoChange={onPhotoChange}
      error={null}
      inspectDimensions={async () => ({
        ok: true,
        width: 320,
        height: 320,
      })}
      {...props}
    />,
  );

  return { ...view, onPhotoChange };
}

describe("PhotoSelector", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURL = vi
      .fn()
      .mockReturnValueOnce("blob:first")
      .mockReturnValueOnce("blob:second");
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a local preview without rendering the original filename", async () => {
    const actor = userEvent.setup();
    const { onPhotoChange } = renderSelector();

    await actor.upload(screen.getByLabelText("Photo"), photoFile());

    expect(await screen.findByAltText("Selected photo preview")).toHaveAttribute(
      "src",
      "blob:first",
    );
    expect(screen.getByText("Photo selected")).toBeInTheDocument();
    expect(screen.queryByText("local-secret-name.jpg")).not.toBeInTheDocument();
    expect(onPhotoChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        file: expect.any(File),
        width: 320,
        height: 320,
      }) satisfies Partial<PhotoSelectionValue>,
    );
  });

  it("revokes the old object URL when the selected photo is replaced", async () => {
    const actor = userEvent.setup();
    renderSelector();
    const input = screen.getByLabelText("Photo");

    await actor.upload(input, photoFile("first.jpg"));
    await actor.upload(input, photoFile("second.jpg"));

    await waitFor(() => {
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");
    });
    expect(screen.getByAltText("Selected photo preview")).toHaveAttribute(
      "src",
      "blob:second",
    );
  });

  it("handles cancellation and explicit clearing by removing selected state", async () => {
    const actor = userEvent.setup();
    const { onPhotoChange } = renderSelector();
    const input = screen.getByLabelText("Photo");

    await actor.upload(input, photoFile());
    fireEvent.change(input, { target: { files: [] } });

    expect(await screen.findByText("No photo selected")).toBeInTheDocument();
    expect(onPhotoChange).toHaveBeenLastCalledWith(null);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");
  });

  it("shows preview failure without losing the valid selected file", async () => {
    createObjectURL.mockReset();
    createObjectURL.mockImplementationOnce(() => {
      throw new Error("preview blocked");
    });
    const actor = userEvent.setup();
    const { onPhotoChange } = renderSelector();

    await actor.upload(screen.getByLabelText("Photo"), photoFile());

    expect(await screen.findByText("Preview unavailable")).toBeInTheDocument();
    expect(onPhotoChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ file: expect.any(File), width: 320, height: 320 }),
    );
  });

  it("revokes object URLs on unmount", async () => {
    const actor = userEvent.setup();
    const { unmount } = renderSelector();

    await actor.upload(screen.getByLabelText("Photo"), photoFile());
    unmount();

    expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");
  });
});
