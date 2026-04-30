export type PublishMarketplaceId =
  | "ugig"
  | "clawhub"
  | "skills-sh"
  | "lobehub"
  | "goose"
  | "kilo"
  | "skillstore"
  | "freemygent"
  | "clawmart"
  | "manus"
  | "vscode-agent-skills"
  | "moltbook";

export type PublishEverywhereListing = {
  slug: string;
  title?: string | null;
  source_url?: string | null;
  skill_file_url?: string | null;
  website_url?: string | null;
  clawhub_url?: string | null;
  status?: string | null;
};

export type PublishEverywhereRequest = {
  dry_run?: boolean;
  all?: boolean;
  marketplaces?: string[];
  credentials?: Record<string, unknown>;
};

export type PublishEverywhereResult = {
  marketplace: PublishMarketplaceId;
  name: string;
  status: "published" | "ready" | "manual" | "auth_required" | "skipped";
  url?: string;
  command?: string;
  note?: string;
};

const MARKETPLACES: Array<{ id: PublishMarketplaceId; name: string }> = [
  { id: "ugig", name: "uGig" },
  { id: "clawhub", name: "ClawHub" },
  { id: "skills-sh", name: "skills.sh" },
  { id: "lobehub", name: "LobeHub Skills" },
  { id: "goose", name: "Goose Skills" },
  { id: "kilo", name: "Kilo Marketplace" },
  { id: "skillstore", name: "Skillstore" },
  { id: "freemygent", name: "FreeMyGent" },
  { id: "clawmart", name: "ClawMart" },
  { id: "manus", name: "Manus Agent Skills" },
  { id: "vscode-agent-skills", name: "VS Code Agent Skills" },
  { id: "moltbook", name: "Moltbook / NormieClaw" },
];

function shellQuote(value: string): string {
  return JSON.stringify(value);
}

function installUrl(listing: PublishEverywhereListing): string {
  return listing.skill_file_url || listing.source_url || listing.website_url || `https://ugig.net/skills/${listing.slug}`;
}

function hasCredential(credentials: Record<string, unknown> | undefined, id: PublishMarketplaceId): boolean {
  return Boolean(credentials && Object.prototype.hasOwnProperty.call(credentials, id));
}

export function normalizeMarketplaces(input?: string[]): PublishMarketplaceId[] {
  const allowed = new Set(MARKETPLACES.map((m) => m.id));
  const values = input?.flatMap((m) => m.split(",")).map((m) => m.trim()).filter(Boolean) || MARKETPLACES.map((m) => m.id);
  return values.filter((m): m is PublishMarketplaceId => allowed.has(m as PublishMarketplaceId));
}

export function buildPublishEverywherePlan(
  listing: PublishEverywhereListing,
  request: PublishEverywhereRequest = {},
): PublishEverywhereResult[] {
  const selected = new Set(normalizeMarketplaces(request.marketplaces));
  const source = installUrl(listing);
  const results: PublishEverywhereResult[] = [];

  for (const marketplace of MARKETPLACES) {
    if (!selected.has(marketplace.id)) continue;
    switch (marketplace.id) {
      case "ugig":
        results.push({
          marketplace: marketplace.id,
          name: marketplace.name,
          status: listing.status === "active" ? "published" : "ready",
          url: `https://ugig.net/skills/${listing.slug}`,
          note: listing.status === "active" ? "Already active on uGig." : "Set status active after a passing scan.",
        });
        break;
      case "clawhub":
        results.push({
          marketplace: marketplace.id,
          name: marketplace.name,
          status: listing.clawhub_url ? "published" : hasCredential(request.credentials, marketplace.id) ? "ready" : "auth_required",
          url: listing.clawhub_url || undefined,
          command: `clawhub publish . --slug ${shellQuote(listing.slug)} --version 1.0.0`,
          note: listing.clawhub_url ? "ClawHub URL already attached." : "Requires ClawHub login/API support; credentials are accepted per request and not stored.",
        });
        break;
      case "skills-sh":
        results.push({
          marketplace: marketplace.id,
          name: marketplace.name,
          status: listing.source_url || listing.skill_file_url ? "ready" : "manual",
          note: "Auto-indexed from a public GitHub repo containing SKILL.md. Prefer a repo URL over a gist for fastest discovery.",
        });
        break;
      case "lobehub":
        results.push({ marketplace: marketplace.id, name: marketplace.name, status: "manual", command: `npx @lobehub/cli skill install ${listing.slug}`, note: "Submit through LobeHub's skill process; install command shown for users." });
        break;
      case "goose":
        results.push({ marketplace: marketplace.id, name: marketplace.name, status: "ready", command: `goose skill add ${source}`, note: "Use the raw SKILL.md URL or submit a PR if Goose requires directory inclusion." });
        break;
      case "kilo":
        results.push({ marketplace: marketplace.id, name: marketplace.name, status: "manual", command: `kilo skill install ${listing.slug}`, note: "Fork/PR flow is usually required." });
        break;
      case "skillstore":
        results.push({ marketplace: marketplace.id, name: marketplace.name, status: "manual", note: "Submit public GitHub repo or raw SKILL.md URL for analysis." });
        break;
      case "freemygent":
        results.push({ marketplace: marketplace.id, name: marketplace.name, status: hasCredential(request.credentials, marketplace.id) ? "ready" : "auth_required", note: "Upload skill.md, set price, and connect wallet/account." });
        break;
      case "clawmart":
        results.push({ marketplace: marketplace.id, name: marketplace.name, status: hasCredential(request.credentials, marketplace.id) ? "ready" : "auth_required", command: `clawmart publish . --name ${shellQuote(listing.slug)}`, note: "Requires ClawMart API credentials." });
        break;
      case "manus":
        results.push({ marketplace: marketplace.id, name: marketplace.name, status: hasCredential(request.credentials, marketplace.id) ? "ready" : "auth_required", note: "Free account required; submit through Manus account UI/API when available." });
        break;
      case "vscode-agent-skills":
        results.push({ marketplace: marketplace.id, name: marketplace.name, status: "ready", note: "Publish via public GitHub repo/PR for extension indexing." });
        break;
      case "moltbook":
        results.push({ marketplace: marketplace.id, name: marketplace.name, status: "manual", note: "Submit, set price, and pass quality check." });
        break;
    }
  }

  return results;
}
