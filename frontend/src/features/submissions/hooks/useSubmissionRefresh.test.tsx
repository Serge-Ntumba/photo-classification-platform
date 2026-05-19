import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";

import { useSubmissionRefresh } from "@/features/submissions/hooks/useSubmissionRefresh";

function RefreshProbe({ load }: { load: () => Promise<string> }) {
  const { data, isLoading, lastCheckedAt } = useSubmissionRefresh(load, "strict");

  return (
    <div>
      <p>{isLoading ? "Loading" : "Loaded"}</p>
      <p>{data ?? "No data"}</p>
      <p>{lastCheckedAt ? "Checked" : "Not checked"}</p>
    </div>
  );
}

describe("useSubmissionRefresh", () => {
  it("applies the latest successful load while mounted under React StrictMode", async () => {
    const load = vi.fn().mockResolvedValue("Submission data loaded");

    render(
      <React.StrictMode>
        <RefreshProbe load={load} />
      </React.StrictMode>,
    );

    expect(await screen.findByText("Submission data loaded")).toBeInTheDocument();
    expect(screen.getByText("Loaded")).toBeInTheDocument();
    expect(screen.getByText("Checked")).toBeInTheDocument();
  });
});
