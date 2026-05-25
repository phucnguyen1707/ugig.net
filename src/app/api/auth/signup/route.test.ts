// @ts-nocheck - route tests use small Supabase-shaped mocks
import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ allowed: true }),
  rateLimitExceeded: () => new Response("Rate limited", { status: 429 }),
  getRateLimitIdentifier: () => "test",
}));

vi.mock("@/lib/spam-check", () => ({
  checkSpam: () => ({ spam: false }),
  checkEmail: () => ({ spam: false }),
}));

vi.mock("@/lib/auth/did", () => ({
  generateAndStoreDid: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/account-type-detection", () => ({
  detectSuspiciousAccountType: () => ({ suspicious: false }),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
  signupConfirmationEmail: vi.fn((params: { confirmUrl: string }) => ({
    subject: "Confirm your ugig.net account",
    html: params.confirmUrl,
    text: params.confirmUrl,
  })),
}));

const mockGenerateLink = vi.fn();
const mockActivityInsert = vi.fn();
const mockCreateClient = vi.fn();
const mockCreateServiceClient = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => mockCreateClient(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => mockCreateServiceClient(),
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeEqChain(finalResult: unknown = {}) {
  const chain = {
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue(finalResult),
  };
  return chain;
}

function makeReferralUpdateChain() {
  const chain = {
    eq: vi.fn(() => chain),
  };
  return chain;
}

describe("POST /api/auth/signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGenerateLink.mockResolvedValue({
      data: {
        user: { id: "new-user-id" },
        properties: { hashed_token: "signup-token" },
      },
      error: null,
    });

    mockCreateClient.mockResolvedValue({
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        return {};
      }),
    });

    mockActivityInsert.mockResolvedValue({ data: null, error: null });

    mockCreateServiceClient.mockReturnValue({
      auth: {
        admin: {
          generateLink: mockGenerateLink,
        },
      },
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: "referrer-id" },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "referrals") {
          return {
            update: vi.fn(() => makeReferralUpdateChain()),
            select: vi.fn(() => makeEqChain({ data: null, error: null })),
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }

        if (table === "activities") {
          return {
            insert: mockActivityInsert,
          };
        }

        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    });
  });

  it("does not include referred email in public referral activity metadata", async () => {
    const res = await POST(
      makeRequest({
        email: "new-user@example.com",
        password: "Goodpass1",
        username: "newuser",
        account_type: "human",
        ref: "referrer",
      })
    );

    expect(res.status).toBe(200);
    expect(mockActivityInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        activity_type: "referral_signup",
        is_public: true,
        metadata: { referred_username: "newuser" },
      })
    );
    expect(mockActivityInsert.mock.calls[0][0].metadata).not.toHaveProperty("referred_email");
  });

  it("sends signup confirmation email through app mailer", async () => {
    const { sendEmail, signupConfirmationEmail } = await import("@/lib/email");

    const res = await POST(
      makeRequest({
        email: "new-user@example.com",
        password: "Goodpass1",
        username: "newuser",
        account_type: "human",
      })
    );

    expect(res.status).toBe(200);
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "signup",
        email: "new-user@example.com",
        password: "Goodpass1",
      })
    );
    expect(signupConfirmationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "newuser",
        confirmUrl: "https://ugig.net/auth/confirm?token_hash=signup-token&type=signup",
      })
    );
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "new-user@example.com",
        subject: "Confirm your ugig.net account",
      })
    );
  });
});
