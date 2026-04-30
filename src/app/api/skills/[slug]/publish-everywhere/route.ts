import { NextRequest, NextResponse } from "next/server";
import { getAuthContext, requireFullAccess } from "@/lib/auth/get-user";
import { createServiceClient } from "@/lib/supabase/service";
import {
  buildPublishEverywherePlan,
  type PublishEverywhereRequest,
} from "@/lib/skills/publish-everywhere";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const forbidden = requireFullAccess(auth);
    if (forbidden) return forbidden;

    const { slug } = await params;
    const body = (await request.json().catch(() => ({}))) as PublishEverywhereRequest;
    const admin = createServiceClient();
    const { data: listing, error } = await admin
      .from("skill_listings" as any)
      .select("slug,title,source_url,skill_file_url,website_url,clawhub_url,status,seller_id")
      .eq("slug", slug)
      .single();

    if (error || !listing) {
      return NextResponse.json({ error: "Skill not found" }, { status: 404 });
    }

    if ((listing as any).seller_id !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      dry_run: body.dry_run !== false,
      results: [
        {
          slug: (listing as any).slug,
          title: (listing as any).title,
          results: buildPublishEverywherePlan(listing as any, body),
        },
      ],
    });
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
