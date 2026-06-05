import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getAuthContext: vi.fn(),
  createAdminClient: vi.fn(),
  sendEmail: vi.fn(),
  newMessageEmail: vi.fn(),
  dispatchWebhookAsync: vi.fn(),
  isEmailNotificationEnabled: vi.fn(),
}));

vi.mock("@/lib/auth/get-user", () => ({
  getAuthContext: mocks.getAuthContext,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createAdminClient,
}));

vi.mock("@/lib/email", () => ({
  sendEmail: mocks.sendEmail,
  newMessageEmail: mocks.newMessageEmail,
}));

vi.mock("@/lib/webhooks/dispatch", () => ({
  dispatchWebhookAsync: mocks.dispatchWebhookAsync,
}));

vi.mock("@/lib/notification-settings", () => ({
  isEmailNotificationEnabled: mocks.isEmailNotificationEnabled,
}));

import { POST } from "./route";

function makeRequest(body: string) {
  return new NextRequest("http://localhost/api/messages/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/messages/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for malformed JSON instead of a generic 500", async () => {
    mocks.getAuthContext.mockResolvedValue({
      user: { id: "sender-1" },
      supabase: {},
    });

    const response = await POST(makeRequest("{"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
  });
});
