import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { App } from "@/app/App";
import { AppProviders } from "@/app/providers";
import { AppRoutes } from "@/app/router";

describe("app providers and router", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("bootstraps the public application entry", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Photo Classification Platform" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("blocks protected routes for anonymous visitors", () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={["/app/submissions"]}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(
      screen.getByRole("heading", { name: "Sign in to continue" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your session is required/)).toBeInTheDocument();
  });

  it("renders a neutral not-found route", () => {
    render(
      <AppProviders>
        <MemoryRouter initialEntries={["/unknown/path"]}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Return to the workspace" }),
    ).toHaveAttribute("href", "/app");
  });
});
