import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireFullAccess } from "@/lib/auth/get-user";
import { createServiceClient } from "@/lib/supabase/service";
import { buildPublishEverywherePlan, type PublishEverywhereRequest } from "@/lib/skills/publish-everywhere";

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const forbidden = requireFullAccess(auth);
    if (forbidden) return forbidden;

    const body = (await request.json().catch(() => ({}))) as PublishEverywhereRequest;
    const admin = createServiceClient();
    const { data: listings, error } = await admin
      .from("skill_listings" as any)
      .select("slug,title,source_url,skill_file_url,website_url,clawhub_url,status,seller_id")
      .eq("seller_id", auth.user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const results = (listings || []).map((listing: any) => ({
      slug: listing.slug,
      title: listing.title,
      results: buildPublishEverywherePlan(listing, body),
    }));

    return NextResponse.json({ dry_run: body.dry_run !== false, results });
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
