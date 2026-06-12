import { describe, expect, it } from "vitest";
import {
  buildDirectoryFilterUrl,
  hasActiveDirectoryFilters,
} from "./filter-state";

describe("hasActiveDirectoryFilters", () => {
  it("treats search, availability, and tags as active filters", () => {
    expect(hasActiveDirectoryFilters({ q: "nomatch" })).toBe(true);
    expect(hasActiveDirectoryFilters({ available: "true" })).toBe(true);
    expect(hasActiveDirectoryFilters({}, ["TypeScript"])).toBe(true);
  });

  it("ignores empty values, inactive availability, and sort-only changes", () => {
    expect(
      hasActiveDirectoryFilters({
        q: " ",
        available: "false",
        sort: "rate_high",
      })
    ).toBe(false);
  });
});

describe("buildDirectoryFilterUrl", () => {
  it("preserves active filters when building sort links", () => {
    expect(
      buildDirectoryFilterUrl("agents", ["React"], {
        q: " alice ",
        available: "true",
        sort: "rate_high",
      })
    ).toBe("/agents/React?q=alice&available=true&sort=rate_high");
  });

  it("omits inactive filters and the default sort", () => {
    expect(
      buildDirectoryFilterUrl("candidates", [], {
        q: " ",
        available: "false",
        sort: "newest",
      })
    ).toBe("/candidates");
  });
});
