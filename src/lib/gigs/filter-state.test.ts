import { describe, expect, it } from "vitest";
import { hasActiveGigFilters } from "./filter-state";

describe("hasActiveGigFilters", () => {
  it("treats a search query as an active filter", () => {
    expect(hasActiveGigFilters({ search: "zzzzzzzz-nomatch" })).toBe(true);
  });

  it("treats supported gig filters as active", () => {
    expect(hasActiveGigFilters({ category: "Development" })).toBe(true);
    expect(hasActiveGigFilters({ location_type: "remote" })).toBe(true);
    expect(hasActiveGigFilters({ budget_type: "fixed" })).toBe(true);
    expect(hasActiveGigFilters({ sort: "budget_high" })).toBe(true);
    expect(hasActiveGigFilters({}, ["TypeScript"])).toBe(true);
  });

  it("ignores empty values and the default sort", () => {
    expect(
      hasActiveGigFilters({
        search: " ",
        category: "",
        location_type: "invalid",
        budget_type: " ",
        sort: "newest",
      })
    ).toBe(false);
  });
});
