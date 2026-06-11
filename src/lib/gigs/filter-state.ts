export interface GigFilterSearchParams {
  search?: string;
  category?: string;
  location_type?: string;
  budget_type?: string;
  sort?: string;
  skill?: string;
}

const LOCATION_FILTERS = new Set(["remote", "onsite", "hybrid"]);
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
    hasText(queryParams.budget_type) ||
    LOCATION_FILTERS.has(queryParams.location_type || "") ||
    (hasText(queryParams.sort) && queryParams.sort !== DEFAULT_SORT)
  );
}
