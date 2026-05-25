import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const { mockGenerateLink, mockSendEmail } = vi.hoisted(() => ({
  mockGenerateLink: vi.fn(),
  mockSendEmail: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    auth: {
      admin: {
        generateLink: mockGenerateLink,
      },
    },
  }),
}));

vi.mock("@/lib/email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email")>();
  return {
    ...actual,
    sendEmail: mockSendEmail,
  };
});

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeRawRequest(body: string) {
  return new NextRequest("http://localhost/api/auth/forgot-password", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_APP_URL;
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: "reset-token" } },
      error: null,
    });
    mockSendEmail.mockResolvedValue({ success: true, data: { id: "email_123" } });
  });

  it("sends a reset link through the app mailer for a valid email", async () => {
    const res = await POST(makeRequest({ email: "test@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toContain("password reset link");
    expect(mockGenerateLink).toHaveBeenCalledWith({
      type: "recovery",
      email: "test@example.com",
      options: { redirectTo: "https://ugig.net/auth/confirm" },
    });
    expect(mockSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "test@example.com",
        subject: "Reset your ugig.net password",
        html: expect.stringContaining(
          "https://ugig.net/auth/confirm?token_hash=reset-token&amp;type=recovery&amp;next=%2Freset-password"
        ),
        text: expect.stringContaining(
          "https://ugig.net/auth/confirm?token_hash=reset-token&type=recovery&next=%2Freset-password"
        ),
      })
    );
  });

  it("returns 400 for invalid email", async () => {
    const res = await POST(makeRequest({ email: "invalid" }));
    expect(res.status).toBe(400);
    expect(mockGenerateLink).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON without sending a reset link", async () => {
    const res = await POST(makeRawRequest("{"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid request body");
    expect(mockGenerateLink).not.toHaveBeenCalled();
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns generic success without sending email when reset link generation fails", async () => {
    mockGenerateLink.mockResolvedValue({
      data: {},
      error: { message: "User not found", status: 422, code: "user_not_found" },
    });

    const res = await POST(makeRequest({ email: "missing@example.com" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toContain("password reset link");
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
