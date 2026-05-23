"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { QRCodeCanvas } from "@/components/funding/QRCode";
import { Copy, ExternalLink } from "lucide-react";

interface CryptoPaymentBoxProps {
  title?: string;
  paymentAddress: string;
  amountCrypto?: string | number | null;
  paymentCurrency?: string | null;
  expiresAt?: string | null;
  checkoutUrl?: string | null;
}

export function CryptoPaymentBox({
  title = "Payment details",
  paymentAddress,
  amountCrypto,
  paymentCurrency,
  expiresAt,
  checkoutUrl,
}: CryptoPaymentBoxProps) {
  const [copied, setCopied] = useState<"address" | "amount" | null>(null);
  const amountLabel =
    amountCrypto != null && amountCrypto !== ""
      ? `${amountCrypto} ${paymentCurrency || ""}`.trim()
      : paymentCurrency || null;

  const copy = async (value: string, key: "address" | "amount") => {
    await navigator.clipboard?.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1200);
  };

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        {checkoutUrl && (
          <a
            href={checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </a>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-[132px_1fr] sm:items-start">
        <div className="rounded bg-background p-2 w-fit">
          <QRCodeCanvas value={paymentAddress} size={112} />
        </div>

        <div className="min-w-0 space-y-2">
          {amountLabel && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{amountLabel}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => copy(String(amountCrypto), "amount")}
                disabled={amountCrypto == null || amountCrypto === ""}
              >
                <Copy className="h-3 w-3" />
                {copied === "amount" ? "Copied" : "Copy"}
              </Button>
            </div>
          )}

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Address</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={() => copy(paymentAddress, "address")}
              >
                <Copy className="h-3 w-3" />
                {copied === "address" ? "Copied" : "Copy"}
              </Button>
            </div>
            <code className="block break-all rounded bg-background px-2 py-1.5 text-xs">
              {paymentAddress}
            </code>
          </div>

          {expiresAt && (
            <p className="text-xs text-muted-foreground">
              Expires {new Date(expiresAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
