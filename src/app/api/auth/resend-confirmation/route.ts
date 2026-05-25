import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, rateLimitExceeded, getRateLimitIdentifier } from "@/lib/rate-limit";
import { sendEmail, signupConfirmationEmail } from "@/lib/email";
import { safeParseBody } from "@/lib/sanitize";
import { z } from "zod";

const resendSchema = z.object({
  email: z.string().email("Invalid email address"),
});

async function findAuthUserByEmail(
  supabase: ReturnType<typeof createServiceClient>,
  email: string
) {
  const target = email.toLowerCase();
  let page = 1;

  while (page <= 100) {
    const {
      data: { users },
      error,
    } = await supabase.auth.admin.listUsers({ page, perPage: 100 });

    if (error) {
      console.error("Resend confirmation user lookup error:", error.message);
      return null;
    }

    const match = users.find((user) => user.email?.toLowerCase() === target);
    if (match) return match;
    if (users.length < 100) return null;
    page += 1;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const identifier = getRateLimitIdentifier(request);
    const rl = checkRateLimit(identifier, "auth");
    if (!rl.allowed) return rateLimitExceeded(rl);

    const body = await safeParseBody(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const validationResult = resendSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ugig.net";
    const { email } = validationResult.data;
    const supabase = createServiceClient();
    const existingUser = await findAuthUserByEmail(supabase, email);

    if (!existingUser || existingUser.email_confirmed_at) {
      return NextResponse.json({
        message: "If an account exists with that email, a confirmation link has been sent.",
      });
    }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: `${appUrl}/auth/confirm`,
      },
    });

    if (error) {
      console.error("Resend confirmation error:", error.message);
      // Don't leak whether the email exists
      return NextResponse.json({
        message: "If an account exists with that email, a confirmation link has been sent.",
      });
    }

    const tokenHash = data.properties?.hashed_token;
    if (tokenHash) {
      const confirmUrl = `${appUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink&next=/dashboard`;
      const metadata = existingUser.user_metadata || {};
      const name =
        typeof metadata.agent_name === "string"
          ? metadata.agent_name
          : typeof metadata.username === "string"
            ? metadata.username
            : typeof metadata.full_name === "string"
              ? metadata.full_name
              : "there";
      const confirmation = signupConfirmationEmail({ name, confirmUrl });
      const result = await sendEmail({
        to: email,
        subject: confirmation.subject,
        html: confirmation.html,
        text: confirmation.text,
      });

      if (!result.success || "skipped" in result) {
        console.error("Resend confirmation email delivery failed:", result);
      }
    }

    return NextResponse.json({
      message: "If an account exists with that email, a confirmation link has been sent.",
    });
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
