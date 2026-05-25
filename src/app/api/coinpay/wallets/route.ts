import { NextRequest, NextResponse } from "next/server";
import { getAuthContext } from "@/lib/auth/get-user";
import { getConnectedCoinpayAccessToken } from "@/lib/coinpay-oauth";
import { getCoinpayGlobalWalletTokens } from "@/lib/coinpayportal";

const SETUP_INSTRUCTIONS = [
  "Connect your CoinPay account from OAuth Connections.",
  "Open CoinPayPortal and create or unlock your web wallet.",
  "Copy the receiving address for each coin you want to use.",
  "Paste those addresses into Settings > Global Wallet Addresses in CoinPay, then refresh this form.",
];

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = await getConnectedCoinpayAccessToken(auth.user.id);
    if (!accessToken) {
      return NextResponse.json({
        data: {
          wallets: [],
          oauth_required: true,
          setup_required: true,
          setup_instructions: SETUP_INSTRUCTIONS,
        },
      });
    }

    const wallets = await getCoinpayGlobalWalletTokens({ access_token: accessToken });
    return NextResponse.json({
      data: {
        wallets,
        oauth_required: false,
        setup_required: wallets.length === 0,
        setup_instructions: wallets.length === 0 ? SETUP_INSTRUCTIONS : [],
      },
    });
  } catch (err) {
    console.error("[coinpay wallets] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load CoinPay wallets" },
      { status: 500 }
    );
  }
}
