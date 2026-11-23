// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let pathname = "/dashboard";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
const { SiteNav } = await import("@/components/site-nav");

afterEach(cleanup);

describe("site navigation", () => {
  it("shows Admin only to administrators", () => {
    render(<SiteNav isAdmin={false} />);
    expect(screen.queryByRole("link", { name: "Admin" })).toBeNull();
    cleanup();
    render(<SiteNav isAdmin />);
    expect(screen.getByRole("link", { name: "Admin" }).getAttribute("href")).toBe("/admin");
  });
  it("marks the current area, counting a show's page as Events", () => {
    pathname = "/events/123";
    render(<SiteNav isAdmin={false} />);
    expect(screen.getByRole("link", { name: "Events" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Budget" }).getAttribute("aria-current")).toBeNull();
    cleanup();
    pathname = "/scoring";
    render(<SiteNav isAdmin={false} />);
    expect(screen.getByRole("link", { name: "How scoring works" }).getAttribute("aria-current")).toBe("page");
  });
});
