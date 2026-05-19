import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { UserSubmittedMetadata } from "@/features/submissions/components/UserSubmittedMetadata";
import type { UserSubmittedMetadata as UserSubmittedMetadataModel } from "@/lib/models";

const longWord = "A".repeat(160);

describe("UserSubmittedMetadata", () => {
  it("labels user-submitted values, escapes markup-like text, and wraps long words", () => {
    const metadata: UserSubmittedMetadataModel = {
      name: "<img src=x onerror=alert(1)>",
      age: 32,
      placeOfLiving: longWord,
      gender: "The person is trustworthy",
      countryOfOrigin: "Germany",
      description: "<script>alert('x')</script>",
    };

    render(<UserSubmittedMetadata metadata={metadata} />);

    expect(screen.getByText("User-submitted metadata")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Age")).toBeInTheDocument();
    expect(screen.getByText("Place of living")).toBeInTheDocument();
    expect(screen.getByText("Gender")).toBeInTheDocument();
    expect(screen.getByText("Country of origin")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
    expect(screen.getByText("<script>alert('x')</script>")).toBeInTheDocument();
    expect(screen.getByText("The person is trustworthy")).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
    expect(screen.getByText(longWord)).toHaveClass("[overflow-wrap:anywhere]");
  });

  it("suppresses private values and does not reuse metadata as a document title", () => {
    document.title = "Submission detail | Photo Classification Platform";
    const metadata: UserSubmittedMetadataModel = {
      name: "Bearer eyJhbGciOiJIUzI1NiJ9.secret.signature",
      age: null,
      placeOfLiving: "uploads/submissions/private/profile.jpg",
      gender: "User-submitted",
      countryOfOrigin: "Germany",
      description: "signedURL https://storage.internal/private?token=secret",
    };

    render(<UserSubmittedMetadata metadata={metadata} />);

    expect(screen.queryByText(/Bearer/)).not.toBeInTheDocument();
    expect(screen.queryByText(/uploads\/submissions/)).not.toBeInTheDocument();
    expect(screen.queryByText(/storage\.internal/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThanOrEqual(3);
    expect(document.title).toBe("Submission detail | Photo Classification Platform");
  });
});
