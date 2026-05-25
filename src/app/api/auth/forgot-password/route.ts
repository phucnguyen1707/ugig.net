import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { passwordResetEmail, sendEmail } from "@/lib/email";
import { safeParseBody } from "@/lib/sanitize";
import { forgotPasswordSchema } from "@/lib/validations";

const SUCCESS_MESSAGE =
  "If an account exists with this email, you will receive a password reset link";

export async function POST(request: NextRequest) {
  try {
    const body = await safeParseBody(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const validationResult = forgotPasswordSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = validationResult.data;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ugig.net";
    const supabase = createServiceClient();

    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${appUrl}/auth/confirm`,
      },
    });

    if (error) {
      console.error("[password-reset] Failed to generate reset link:", {
        email,
        message: error.message,
        status: error.status,
        code: error.code,
      });
      return NextResponse.json({ message: SUCCESS_MESSAGE });
    }

    const tokenHash = data.properties?.hashed_token;
    if (!tokenHash) {
      console.error("[password-reset] Reset link generation returned no token:", { email });
      return NextResponse.json({ message: SUCCESS_MESSAGE });
    }

    const resetUrl = `${appUrl}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery&next=%2Freset-password`;
    const emailContent = passwordResetEmail({ resetUrl });

    console.log("[password-reset] Sending password reset email:", { email });
    const result = await sendEmail({
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text,
    });

    if (!result.success || "skipped" in result) {
      console.error("[password-reset] Password reset email failed:", { email, result });
      return NextResponse.json({ message: SUCCESS_MESSAGE });
    }

    console.log("[password-reset] Password reset email sent:", { email });

    // Always return success to prevent email enumeration
    return NextResponse.json({
      message: SUCCESS_MESSAGE,
    });
  } catch {
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
