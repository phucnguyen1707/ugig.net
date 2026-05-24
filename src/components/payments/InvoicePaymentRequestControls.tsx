"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { DollarSign, LinkIcon, Loader2, RefreshCw } from "lucide-react";

export interface InvoicePaymentRequestData {
  pay_url?: string | null;
  payment_address?: string | null;
  amount_crypto?: string | number | null;
  payment_currency?: string | null;
  expires_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface CoinPayWalletOption {
  currency: string;
  cryptocurrency?: string | null;
  label?: string | null;
  address: string;
  network?: string | null;
}

interface InvoicePaymentRequestControlsProps {
  gigId: string;
  invoiceId: string;
  buttonLabel?: string;
  onCreated: (data: InvoicePaymentRequestData) => void;
  onStatusMessage?: (message: string | null) => void;
}

const shortAddress = (value: string) =>
  value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;

function walletKey(wallet: CoinPayWalletOption) {
  return `${wallet.currency}:${wallet.address}`;
}

function walletLabel(wallet: CoinPayWalletOption) {
  const coin = wallet.cryptocurrency || wallet.currency;
  const label = wallet.label ? `${wallet.label} - ` : "";
  return `${label}${coin.toUpperCase()} (${shortAddress(wallet.address)})`;
}

export function InvoicePaymentRequestControls({
  gigId,
  invoiceId,
  buttonLabel = "Pay now",
  onCreated,
  onStatusMessage,
}: InvoicePaymentRequestControlsProps) {
  const [wallets, setWallets] = useState<CoinPayWalletOption[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [setupInstructions, setSetupInstructions] = useState<string[]>([]);
  const [oauthRequired, setOauthRequired] = useState(false);
  const [loadingWallets, setLoadingWallets] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedWallet = useMemo(
    () => wallets.find((wallet) => walletKey(wallet) === selectedKey) || null,
    [selectedKey, wallets]
  );

  const loadWallets = useCallback(async () => {
    setLoadingWallets(true);
    setError(null);

    try {
      const res = await fetch(`/api/gigs/${gigId}/invoice/${invoiceId}/payment-request`, {
        cache: "no-store",
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to load CoinPay wallets");
        return;
      }

      const nextWallets = Array.isArray(json.data?.wallets) ? json.data.wallets : [];
      setWallets(nextWallets);
      setSetupInstructions(
        Array.isArray(json.data?.setup_instructions) ? json.data.setup_instructions : []
      );
      setOauthRequired(Boolean(json.data?.oauth_required));
      setSelectedKey(nextWallets[0] ? walletKey(nextWallets[0]) : "");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoadingWallets(false);
    }
  }, [gigId, invoiceId]);

  useEffect(() => {
    void loadWallets();
  }, [loadWallets]);

  const createPaymentRequest = async () => {
    if (!selectedWallet) {
      setError("Select a CoinPay wallet first.");
      return;
    }

    setSubmitting(true);
    setError(null);
    onStatusMessage?.(null);

    try {
      const res = await fetch(`/api/gigs/${gigId}/invoice/${invoiceId}/payment-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency: selectedWallet.currency,
          address: selectedWallet.address,
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to create payment request");
        if (Array.isArray(json.setup_instructions)) {
          setSetupInstructions(json.setup_instructions);
        }
        setOauthRequired(Boolean(json.oauth_required));
        return;
      }

      onCreated(json.data || {});
      onStatusMessage?.("Payment request created at the current market rate.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingWallets) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading CoinPay wallets...
      </div>
    );
  }

  if (wallets.length === 0) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-border bg-background p-3">
          <p className="text-sm font-medium text-foreground">CoinPay wallet setup required</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {(setupInstructions.length > 0
              ? setupInstructions
              : [
                  "Connect your CoinPay account from ugig settings.",
                  "Open CoinPayPortal and create or unlock your web wallet.",
                  "Copy your receiving addresses into CoinPay global wallet settings.",
                  "Return here and refresh the wallet list.",
                ]
            ).map((instruction) => (
              <li key={instruction}>{instruction}</li>
            ))}
          </ol>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          {oauthRequired && (
            <Link href="/settings/connections" className={buttonVariants({ size: "sm", className: "gap-2" })}>
              <LinkIcon className="h-4 w-4" />
              Connect CoinPay
            </Link>
          )}
          <Button type="button" size="sm" variant="outline" onClick={loadWallets} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh wallets
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">CoinPay wallet</label>
        <select
          value={selectedKey}
          onChange={(event) => setSelectedKey(event.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          {wallets.map((wallet) => (
            <option key={walletKey(wallet)} value={walletKey(wallet)}>
              {walletLabel(wallet)}
            </option>
          ))}
        </select>
      </div>

      {selectedWallet && (
        <p className="break-all text-xs text-muted-foreground">
          {selectedWallet.currency.toUpperCase()} receiving address: {selectedWallet.address}
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        type="button"
        size="sm"
        onClick={createPaymentRequest}
        disabled={submitting || !selectedWallet}
        className="gap-2"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <DollarSign className="h-4 w-4" />
        )}
        {buttonLabel}
      </Button>
    </div>
  );
}
