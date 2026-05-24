import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/get-user";
import {
  createPayment,
  findCoinpayGlobalWallet,
  getCoinpayGlobalWalletTokens,
  preferredCoinToPaymentCurrency,
} from "@/lib/coinpayportal";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const PAYMENT_REQUEST_SECONDS = 15 * 60;
const COINPAY_WALLET_SETUP_INSTRUCTIONS = [
  "Connect your CoinPay account from ugig settings.",
  "Open CoinPayPortal and create or unlock your web wallet.",
  "Copy the receiving address for each coin you want to use.",
  "Paste those addresses into Settings > Global Wallet Addresses in CoinPay, then return here and refresh.",
];

type InvoiceContext =
  | { response: NextResponse }
  | {
      gigId: string;
      invoice: any;
      userId: string;
    };

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function activeExpiresAt(metadata: Record<string, unknown>): Date | null {
  const expiresAt = typeof metadata.expires_at === "string" ? metadata.expires_at : null;
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime()) || date <= new Date()) return null;
  return date;
}

async function loadInvoiceContext(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
): Promise<InvoiceContext> {
  const { id: gigId, invoiceId } = await params;
  const auth = await getAuthContext(request);
  if (!auth) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { user, supabase } = auth;
  const { data: invoice, error } = await (supabase as any)
    .from("gig_invoices")
    .select(
      `
          id,
          gig_id,
          application_id,
          worker_id,
          poster_id,
          amount_usd,
          currency,
          status,
          coinpay_invoice_id,
          pay_url,
          notes,
          metadata,
          gig:gigs(id, title, payment_coin)
        `
    )
    .eq("id", invoiceId)
    .eq("gig_id", gigId)
    .maybeSingle();

  if (error) {
    return { response: NextResponse.json({ error: error.message }, { status: 400 }) };
  }
  if (!invoice) {
    return { response: NextResponse.json({ error: "Invoice not found" }, { status: 404 }) };
  }
  if (invoice.poster_id !== user.id) {
    return {
      response: NextResponse.json({ error: "Only the poster can pay this invoice" }, { status: 403 }),
    };
  }
  if (invoice.status === "paid") {
    return { response: NextResponse.json({ error: "Invoice is already paid" }, { status: 400 }) };
  }
  if (invoice.status === "cancelled" || invoice.status === "draft") {
    return { response: NextResponse.json({ error: "Invoice is not payable" }, { status: 400 }) };
  }

  return { gigId, invoice, userId: user.id };
}

async function readPaymentSelection(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    return typeof request.json === "function" ? await request.json() : {};
  } catch {
    return {};
  }
}

async function getConnectedCoinpayAccessToken(userId: string): Promise<string | null> {
  const serviceSupabase = createServiceClient();
  const { data } = await (serviceSupabase as any)
    .from("oauth_identities")
    .select("metadata")
    .eq("user_id", userId)
    .eq("provider", "coinpay")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const metadata = metadataObject(data?.metadata);
  return typeof metadata.access_token === "string" && metadata.access_token.trim()
    ? metadata.access_token.trim()
    : null;
}

async function walletOptionsResponse(userId: string) {
  const accessToken = await getConnectedCoinpayAccessToken(userId);
  if (!accessToken) {
    return NextResponse.json({
      data: {
        wallets: [],
        setup_required: true,
        oauth_required: true,
        setup_instructions: COINPAY_WALLET_SETUP_INSTRUCTIONS,
      },
    });
  }

  const wallets = await getCoinpayGlobalWalletTokens({ access_token: accessToken });
  return NextResponse.json({
    data: {
      wallets,
      setup_required: wallets.length === 0,
      oauth_required: false,
      setup_instructions: wallets.length === 0 ? COINPAY_WALLET_SETUP_INSTRUCTIONS : [],
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
): Promise<NextResponse> {
  try {
    const context = await loadInvoiceContext(request, { params });
    if ("response" in context) return context.response;

    return walletOptionsResponse(context.userId);
  } catch (err) {
    console.error("[invoice payment wallets] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load CoinPay wallets" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; invoiceId: string }> }
): Promise<NextResponse> {
  try {
    const context = await loadInvoiceContext(request, { params });
    if ("response" in context) return context.response;

    const { gigId, invoice, userId } = context;

    const metadata = metadataObject(invoice.metadata);
    if (invoice.coinpay_invoice_id && metadata.payment_address && activeExpiresAt(metadata)) {
      return NextResponse.json({
        data: {
          invoice_id: invoice.id,
          coinpay_invoice_id: invoice.coinpay_invoice_id,
          pay_url: invoice.pay_url || null,
          payment_address: metadata.payment_address || null,
          amount_crypto: metadata.amount_crypto || null,
          payment_currency: metadata.payment_currency || null,
          expires_at: metadata.expires_at || null,
          metadata,
        },
      });
    }

    const gig = Array.isArray(invoice.gig) ? invoice.gig[0] : invoice.gig;
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://ugig.net";
    const businessId = process.env.COINPAY_MERCHANT_ID;
    const selection = await readPaymentSelection(request);
    const selectedCurrency = preferredCoinToPaymentCurrency(
      typeof selection.currency === "string" ? selection.currency : null
    );
    const selectedAddress =
      typeof selection.address === "string" ? selection.address.trim() : "";

    if (!selectedCurrency || !selectedAddress) {
      return NextResponse.json(
        { error: "Select a CoinPay wallet before creating the invoice payment request" },
        { status: 400 }
      );
    }

    const accessToken = await getConnectedCoinpayAccessToken(userId);
    if (!accessToken) {
      return NextResponse.json(
        {
          error: "Connect your CoinPay account before creating an invoice payment request",
          setup_required: true,
          oauth_required: true,
          setup_instructions: COINPAY_WALLET_SETUP_INSTRUCTIONS,
        },
        { status: 409 }
      );
    }

    const wallets = await getCoinpayGlobalWalletTokens({ access_token: accessToken });
    if (wallets.length === 0) {
      return NextResponse.json(
        {
          error: "No CoinPay global wallet addresses are configured",
          setup_required: true,
          oauth_required: false,
          setup_instructions: COINPAY_WALLET_SETUP_INSTRUCTIONS,
        },
        { status: 409 }
      );
    }

    const selectedWallet = findCoinpayGlobalWallet(wallets, selectedCurrency, selectedAddress);
    if (!selectedWallet) {
      return NextResponse.json(
        { error: "Selected receiving address is not a valid CoinPay wallet for that coin" },
        { status: 400 }
      );
    }

    const paymentCurrency = selectedWallet.currency;

    const paymentResult = await createPayment({
      amount_usd: Number(invoice.amount_usd),
      currency: paymentCurrency,
      description: invoice.notes || `Invoice for gig: ${gig?.title || invoice.gig_id}`,
      business_id: businessId,
      merchant_wallet_address: selectedWallet.address,
      redirect_url: `${appUrl}/dashboard/invoices?tab=received`,
      expires_in: PAYMENT_REQUEST_SECONDS,
      metadata: {
        type: "gig_invoice",
        gig_id: gigId,
        invoice_id: invoice.id,
        application_id: invoice.application_id,
        worker_id: invoice.worker_id,
        poster_id: invoice.poster_id,
        invoice_currency: invoice.currency,
        payment_currency: paymentCurrency,
        merchant_wallet_address: selectedWallet.address,
        merchant_wallet_label: selectedWallet.label,
        platform: "ugig.net",
      },
    });

    const cpPayment = paymentResult.payment || paymentResult;
    const paymentId = paymentResult.payment_id || (cpPayment as any).id;
    const paymentAddress = (cpPayment as any).payment_address || paymentResult.address || null;
    const checkoutUrl = paymentResult.checkout_url || (cpPayment as any).checkout_url || null;
    const amountCrypto =
      paymentResult.amount_crypto ||
      (cpPayment as any).amount_crypto ||
      (cpPayment as any).crypto_amount ||
      null;
    const expiresAt =
      paymentResult.expires_at ||
      (cpPayment as any).expires_at ||
      new Date(Date.now() + PAYMENT_REQUEST_SECONDS * 1000).toISOString();
    const responseCurrency = paymentResult.currency || (cpPayment as any).currency || paymentCurrency;

    if (!paymentId) {
      return NextResponse.json({ error: "CoinPay did not return a payment id" }, { status: 502 });
    }
    if (!paymentAddress) {
      return NextResponse.json(
        { error: "CoinPay did not return an in-app payment address" },
        { status: 502 }
      );
    }

    const previousPaymentIds = Array.isArray(metadata.previous_coinpay_invoice_ids)
      ? metadata.previous_coinpay_invoice_ids
      : [];
    const nextMetadata = {
      ...metadata,
      previous_coinpay_invoice_ids: invoice.coinpay_invoice_id
        ? [...previousPaymentIds, invoice.coinpay_invoice_id]
        : previousPaymentIds,
      payment_address: paymentAddress,
      amount_crypto: amountCrypto,
      payment_currency: responseCurrency,
      merchant_wallet_address: selectedWallet.address,
      merchant_wallet_label: selectedWallet.label,
      checkout_url: checkoutUrl,
      expires_at: expiresAt,
      payment_request_created_at: new Date().toISOString(),
      coinpay_status: "pending",
    };

    const serviceSupabase = createServiceClient();
    const { data: updated, error: updateError } = await ((serviceSupabase as any).from("gig_invoices") as any)
      .update({
        status: "sent",
        coinpay_invoice_id: paymentId,
        pay_url: null,
        metadata: nextMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id)
      .select()
      .single();

    if (updateError) {
      console.error("[invoice payment request] update failed:", updateError);
      return NextResponse.json({ error: "Failed to save payment request" }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        invoice_id: updated.id,
        coinpay_invoice_id: paymentId,
        pay_url: null,
        payment_address: paymentAddress,
        amount_crypto: amountCrypto,
        payment_currency: responseCurrency,
        expires_at: expiresAt,
        metadata: updated.metadata,
      },
    });
  } catch (err) {
    console.error("[invoice payment request] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create payment request" },
      { status: 500 }
    );
  }
}
