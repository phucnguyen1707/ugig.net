import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth/get-user", () => ({
  getAuthContext: vi.fn(),
  requireFullAccess: vi.fn(() => null),
}));

vi.mock("@/lib/coinpayportal", () => ({
  createPayment: vi.fn(),
}));

import { POST } from "./route";
import { getAuthContext, requireFullAccess } from "@/lib/auth/get-user";
import { createPayment } from "@/lib/coinpayportal";

const USER_ID = "666cbaba-c6ea-4756-ad44-d6a5b4248f8f";
const GIG_ID = "8489a861-0999-4107-afca-2592021ac338";

function req(body?: unknown) {
  return { json: () => Promise.resolve(body) } as any;
}

describe("POST /api/payments/coinpayportal/create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 if not authenticated", async () => {
    (getAuthContext as any).mockResolvedValue(null);

    const res = await POST(req({ type: "subscription", currency: "btc" }));

    expect(res.status).toBe(401);
  });

  it("rejects restricted public API keys", async () => {
    (getAuthContext as any).mockResolvedValue({
      user: { id: USER_ID, authMethod: "api_key", scope: "public" },
      supabase: {},
    });
    (requireFullAccess as any).mockReturnValueOnce(
      Response.json({ error: "full access required" }, { status: 403 }) as any
    );

    const res = await POST(req({ type: "subscription", currency: "btc" }));

    expect(res.status).toBe(403);
  });

  it("rejects direct gig payments so gigs go through invoices", async () => {
    (getAuthContext as any).mockResolvedValue({
      user: { id: USER_ID, authMethod: "api_key", scope: "full" },
      supabase: {},
    });

    const res = await POST(
      req({
        type: "gig_payment",
        currency: "btc",
        amount_usd: 2,
        gig_id: GIG_ID,
      })
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Gig payments must be paid through invoices");
    expect(createPayment).not.toHaveBeenCalled();
  });
});
