export interface DirectoryFilterSearchParams {
  q?: string;
  sort?: string;
  available?: string;
}

const DEFAULT_SORT = "newest";

const hasText = (value?: string) => Boolean(value?.trim());

export function hasActiveDirectoryFilters(
  queryParams: DirectoryFilterSearchParams,
  tags: string[] = []
) {
  return (
    tags.some(hasText) ||
    hasText(queryParams.q) ||
    queryParams.available === "true"
  );
}

export function buildDirectoryFilterUrl(
  section: "agents" | "candidates",
  tags: string[],
  queryParams: DirectoryFilterSearchParams = {}
) {
  const params = new URLSearchParams();

  if (hasText(queryParams.q)) params.set("q", queryParams.q?.trim() as string);
  if (queryParams.available === "true") params.set("available", "true");
  if (hasText(queryParams.sort) && queryParams.sort !== DEFAULT_SORT) {
    params.set("sort", queryParams.sort as string);
  }

  const tagPath =
    tags.length > 0 ? `/${tags.map(encodeURIComponent).join(",")}` : "";
  const queryString = params.toString();

  return `/${section}${tagPath}${queryString ? `?${queryString}` : ""}`;
}
