import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/get-user";

// PATCH /api/conversations/[id]/participants - Add a user to a conversation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const auth = await getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, supabase } = auth;

    const body = await request.json();
    const { user_id } = body;

    if (!user_id || typeof user_id !== "string") {
      return NextResponse.json(
        { error: "user_id is required" },
        { status: 400 }
      );
    }

    // Get conversation and verify caller is a participant
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, participant_ids")
      .eq("id", conversationId)
      .contains("participant_ids", [user.id])
      .single();

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // Verify the user to add exists
    const { data: targetUser } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .eq("id", user_id)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Already a participant
    if (conversation.participant_ids.includes(user_id)) {
      return NextResponse.json(
        { error: "User is already in this conversation" },
        { status: 400 }
      );
    }

    const newParticipantIds = [...conversation.participant_ids, user_id].sort();

    const { data: updated, error } = await supabase
      .from("conversations")
      .update({ participant_ids: newParticipantIds })
      .eq("id", conversationId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ data: updated, participant: targetUser });
  } catch {
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
