import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/get-user";
import { createServiceClient } from "@/lib/supabase/service";
import { slugify } from "@/lib/skills/validation";
import { importSkillFromUrl } from "@/lib/skills/url-import";
import { discoverSkillsInRepo, type RepoSkillPreview } from "@/lib/skills/repo-import";

/**
 * GET /api/skills/import-repo?repo_url=...
 * Preview skills discovered in a GitHub repo directory.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const repoUrl = request.nextUrl.searchParams.get("repo_url");
    if (!repoUrl) {
      return NextResponse.json({ error: "repo_url query param required" }, { status: 400 });
    }

    const result = await discoverSkillsInRepo(repoUrl);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to discover skills";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

interface ImportSkillInput extends RepoSkillPreview {
  price_sats: number;
  category?: string;
}

/**
 * POST /api/skills/import-repo
 * Bulk-create skill listings from a repo preview.
 *
 * Body: { skills: ImportSkillInput[] }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { skills } = body as { skills: ImportSkillInput[] };

    if (!Array.isArray(skills) || skills.length === 0) {
      return NextResponse.json({ error: "No skills provided" }, { status: 400 });
    }

    if (skills.length > 50) {
      return NextResponse.json({ error: "Maximum 50 skills per import" }, { status: 400 });
    }

    const admin = createServiceClient();

    const results = await Promise.allSettled(
      skills.map((skill) => importOneSkill(skill, auth.user.id, admin))
    );

    const summary = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return {
        dirName: skills[i].dirName,
        title: skills[i].title,
        slug: null,
        status: "error" as const,
        error: r.reason instanceof Error ? r.reason.message : "Unknown error",
      };
    });

    const created = summary.filter((s) => s.status !== "error").length;
    return NextResponse.json({ results: summary, created }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}

async function importOneSkill(
  skill: ImportSkillInput,
  sellerId: string,
  admin: ReturnType<typeof createServiceClient>
) {
  let slug = slugify(skill.title);
  if (!slug) slug = slugify(skill.dirName) || "skill";

  // Handle slug collision
  const { data: existing } = await admin
    .from("skill_listings" as any)
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const { data: listing, error } = await admin
    .from("skill_listings" as any)
    .insert({
      seller_id: sellerId,
      slug,
      title: skill.title,
      tagline: skill.tagline || null,
      description: skill.description,
      price_sats: skill.price_sats ?? 0,
      category: skill.category || null,
      tags: skill.tags || [],
      status: "active",
      skill_file_url: skill.skillFileUrl,
      website_url: null,
      source_url: skill.sourceUrl,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const l = listing as any;

  // Import and scan the skill file
  let scanStatus = "not_scanned";
  try {
    const importResult = await importSkillFromUrl({
      skillFileUrl: skill.skillFileUrl,
      sellerId,
      listingSlug: l.slug,
      listingId: l.id,
    });

    scanStatus = importResult.scanResult?.status || "not_scanned";

    // Downgrade to draft only on explicit malicious/suspicious findings
    if (
      importResult.scanResult?.status === "suspicious" ||
      importResult.scanResult?.status === "malicious"
    ) {
      await admin
        .from("skill_listings" as any)
        .update({ status: "draft" })
        .eq("id", l.id);
      l.status = "draft";
    }
  } catch {
    // Non-fatal — listing created, scan can be retried
  }

  return {
    dirName: skill.dirName,
    title: l.title,
    slug: l.slug,
    status: l.status as string,
    scanStatus,
    error: null,
  };
}
