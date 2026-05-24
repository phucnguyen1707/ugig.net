import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/coinpayportal", () => ({
  createPayment: vi.fn(),
  findCoinpayGlobalWallet: vi.fn((wallets, currency, address) =>
    wallets.find((wallet: any) => wallet.currency === currency && wallet.address === address) || null
  ),
  getCoinpayGlobalWalletTokens: vi.fn(),
  preferredCoinToPaymentCurrency: vi.fn((value: string | null) => value?.toLowerCase() || null),
}));

vi.mock("@/lib/auth/get-user", () => ({
  getAuthContext: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(),
}));

import { GET, POST } from "./route";
import { createPayment, getCoinpayGlobalWalletTokens } from "@/lib/coinpayportal";
import { getAuthContext } from "@/lib/auth/get-user";
import { createServiceClient } from "@/lib/supabase/service";

const GIG_ID = "8489a861-0999-4107-afca-2592021ac338";
const INVOICE_ID = "f53e4a56-3cf7-42f9-9a33-bc1cb770c4f6";
const APP_ID = "d2317730-c56a-49e9-a6e4-dc469b7605f7";
const POSTER_ID = "4f16c625-c37a-4654-82db-e391067cbb13";
const WORKER_ID = "666cbaba-c6ea-4756-ad44-d6a5b4248f8f";

const params = { params: Promise.resolve({ id: GIG_ID, invoiceId: INVOICE_ID }) };

function invoiceQuery(invoice: any) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: invoice, error: null }),
  };
}

function updateQuery(updated: any, onUpdate?: (row: any) => void) {
  return {
    update: vi.fn((row: any) => {
      onUpdate?.(row);
      return {
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: updated, error: null }),
          }),
        }),
      };
    }),
  };
}

function coinpayIdentityQuery(accessToken: string | null = "coinpay-access-token") {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: accessToken ? { metadata: { access_token: accessToken } } : null,
      error: null,
    }),
  };
}

function serviceClient(updated: any, onUpdate?: (row: any) => void, accessToken: string | null = "coinpay-access-token") {
  return {
    from: vi.fn((table: string) =>
      table === "oauth_identities"
        ? coinpayIdentityQuery(accessToken)
        : updateQuery(updated, onUpdate)
    ),
  };
}

describe("POST /api/gigs/[id]/invoice/[invoiceId]/payment-request", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a short-lived CoinPay request at pay time", async () => {
    const invoice = {
      id: INVOICE_ID,
      gig_id: GIG_ID,
      application_id: APP_ID,
      worker_id: WORKER_ID,
      poster_id: POSTER_ID,
      amount_usd: 125,
      currency: "USD",
      status: "sent",
      coinpay_invoice_id: null,
      pay_url: null,
      notes: "Milestone 1",
      metadata: {},
      gig: { id: GIG_ID, title: "Build thing", payment_coin: "SOL" },
    };
    const updated = {
      id: INVOICE_ID,
      metadata: {
        payment_address: "So11111111111111111111111111111111111111112",
        amount_crypto: "0.42",
        payment_currency: "sol",
        expires_at: "2030-01-01T00:00:00Z",
      },
    };
    let updatePayload: any = null;

    const authSupabase = {
      from: vi.fn(() => invoiceQuery(invoice)),
    };
    const serviceSupabase = serviceClient(updated, (row) => {
      updatePayload = row;
    });

    (getAuthContext as any).mockResolvedValue({
      user: { id: POSTER_ID },
      supabase: authSupabase,
    });
    (createServiceClient as any).mockReturnValue(serviceSupabase);
    (getCoinpayGlobalWalletTokens as any).mockResolvedValue([
      {
        currency: "sol",
        cryptocurrency: "SOL",
        label: "Solana wallet",
        address: "So11111111111111111111111111111111111111112",
        network: "SOL",
      },
    ]);
    (createPayment as any).mockResolvedValue({
      payment_id: "cp-pay-now",
      address: "So11111111111111111111111111111111111111112",
      amount_crypto: "0.42",
      currency: "sol",
      expires_at: "2030-01-01T00:00:00Z",
      payment: { id: "cp-pay-now" },
    });

    const res = await POST(
      {
        json: async () => ({
          currency: "sol",
          address: "So11111111111111111111111111111111111111112",
        }),
      } as any,
      params
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.coinpay_invoice_id).toBe("cp-pay-now");
    expect(body.data.payment_address).toBe("So11111111111111111111111111111111111111112");
    expect(createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_usd: 125,
        currency: "sol",
        merchant_wallet_address: "So11111111111111111111111111111111111111112",
        expires_in: 900,
        metadata: expect.objectContaining({
          type: "gig_invoice",
          invoice_id: INVOICE_ID,
          merchant_wallet_address: "So11111111111111111111111111111111111111112",
        }),
      })
    );
    expect(updatePayload).toMatchObject({
      status: "sent",
      coinpay_invoice_id: "cp-pay-now",
      pay_url: null,
      metadata: expect.objectContaining({
        payment_address: "So11111111111111111111111111111111111111112",
        amount_crypto: "0.42",
        payment_currency: "sol",
        merchant_wallet_address: "So11111111111111111111111111111111111111112",
      }),
    });
  });

  it("prompts setup when CoinPay global wallets are empty", async () => {
    const invoice = {
      id: INVOICE_ID,
      gig_id: GIG_ID,
      application_id: APP_ID,
      worker_id: WORKER_ID,
      poster_id: POSTER_ID,
      amount_usd: 125,
      currency: "USD",
      status: "sent",
      coinpay_invoice_id: null,
      pay_url: null,
      notes: null,
      metadata: {},
      gig: { id: GIG_ID, title: "Build thing", payment_coin: "SOL" },
    };

    (getAuthContext as any).mockResolvedValue({
      user: { id: POSTER_ID },
      supabase: { from: vi.fn(() => invoiceQuery(invoice)) },
    });
    (createServiceClient as any).mockReturnValue(serviceClient({ id: INVOICE_ID }));
    (getCoinpayGlobalWalletTokens as any).mockResolvedValue([]);

    const res = await POST(
      { json: async () => ({ currency: "sol", address: "So11111111111111111111111111111111111111112" }) } as any,
      params
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.setup_required).toBe(true);
    expect(body.setup_instructions).toEqual(expect.arrayContaining([expect.stringContaining("CoinPayPortal")]));
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("returns wallet options for the poster", async () => {
    const invoice = {
      id: INVOICE_ID,
      gig_id: GIG_ID,
      application_id: APP_ID,
      worker_id: WORKER_ID,
      poster_id: POSTER_ID,
      amount_usd: 125,
      currency: "USD",
      status: "sent",
      coinpay_invoice_id: null,
      pay_url: null,
      notes: null,
      metadata: {},
      gig: { id: GIG_ID, title: "Build thing", payment_coin: "SOL" },
    };
    const wallets = [
      {
        currency: "sol",
        cryptocurrency: "SOL",
        label: "Solana wallet",
        address: "So11111111111111111111111111111111111111112",
        network: "SOL",
      },
    ];

    (getAuthContext as any).mockResolvedValue({
      user: { id: POSTER_ID },
      supabase: { from: vi.fn(() => invoiceQuery(invoice)) },
    });
    (createServiceClient as any).mockReturnValue(serviceClient({ id: INVOICE_ID }));
    (getCoinpayGlobalWalletTokens as any).mockResolvedValue(wallets);

    const res = await GET({} as any, params);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.wallets).toEqual(wallets);
    expect(body.data.setup_required).toBe(false);
  });
});
