import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  EmptyState,
  LiveRegion,
  LoadingState,
  SafeErrorState,
  StatusMessage,
} from "@/components/layout/feedback";

describe("feedback components", () => {
  it("renders loading state as a polite live status", () => {
    render(<LoadingState label="Loading submissions" />);

    expect(screen.getByRole("status")).toHaveTextContent("Loading submissions");
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("renders empty state with accessible heading and action", () => {
    render(
      <EmptyState
        title="No submissions"
        description="Create a submission to begin."
        action={<a href="/app/submissions/new">Create submission</a>}
      />,
    );

    expect(screen.getByRole("heading", { name: "No submissions" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create submission" })).toHaveAttribute(
      "href",
      "/app/submissions/new",
    );
  });

  it("renders safe errors without exposing unsafe backend detail", () => {
    render(
      <SafeErrorState
        title="Request failed"
        message="Traceback token=abc uploads/submissions/private.jpg"
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Something went wrong. Try again later.",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent("token=abc");
  });

  it("renders status messages and live regions with non-color-only text", () => {
    render(
      <>
        <StatusMessage label="Pending classification" tone="info" />
        <LiveRegion message="Status refreshed" />
      </>,
    );

    expect(screen.getByText("Pending classification")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Status update" })).toHaveTextContent(
      "Status refreshed",
    );
  });
});
