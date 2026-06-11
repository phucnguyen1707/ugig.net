export interface GigFilterSearchParams {
  search?: string;
  category?: string;
  location_type?: string;
  budget_type?: string;
  sort?: string;
  skill?: string;
}

const LOCATION_FILTERS = new Set(["remote", "onsite", "hybrid"]);
const BUDGET_FILTERS = new Set([
  "fixed",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "per_task",
  "per_unit",
  "revenue_share",
  "bounty",
]);
const DEFAULT_SORT = "newest";

const hasText = (value?: string) => Boolean(value?.trim());

export function hasActiveGigFilters(
  queryParams: GigFilterSearchParams,
  tags: string[] = []
) {
  return (
    tags.some(hasText) ||
    hasText(queryParams.skill) ||
    hasText(queryParams.search) ||
    hasText(queryParams.category) ||
    BUDGET_FILTERS.has(queryParams.budget_type || "") ||
    LOCATION_FILTERS.has(queryParams.location_type || "") ||
    (hasText(queryParams.sort) && queryParams.sort !== DEFAULT_SORT)
  );
}
