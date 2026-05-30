interface InvoiceChargesProps {
  amountUsd: number;
  currency: string;
  gigTitle: string | null;
  metadata: {
    amount_crypto?: string | number | null;
    payment_currency?: string | null;
    expires_at?: string | null;
  } | null;
}

// Itemized view of what an invoice bills. Invoices are a single amount today
// (no separate line-items table), so this shows the one charge, the total, and
// the live crypto quote when a payment request exists.
export function InvoiceCharges({
  amountUsd,
  currency,
  gigTitle,
  metadata,
}: InvoiceChargesProps) {
  const lineLabel = gigTitle ? `Work on “${gigTitle}”` : "Invoice amount";
  const crypto = metadata?.amount_crypto;
  const cryptoCurrency = metadata?.payment_currency;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Charges
      </p>
      <div className="flex items-start justify-between gap-3 py-1">
        <span className="text-foreground">{lineLabel}</span>
        <span className="whitespace-nowrap font-medium tabular-nums">
          ${amountUsd.toFixed(2)}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 border-t border-border pt-2">
        <span className="font-medium">Total</span>
        <span className="font-semibold tabular-nums">
          ${amountUsd.toFixed(2)}{" "}
          <span className="text-xs font-normal text-muted-foreground">
            {currency}
          </span>
        </span>
      </div>
      {crypto != null && cryptoCurrency && (
        <p className="mt-2 text-xs text-muted-foreground">
          ≈ {String(crypto)} {String(cryptoCurrency).toUpperCase()} at the
          current market rate
          {metadata?.expires_at
            ? ` · quote expires ${new Date(metadata.expires_at).toLocaleString()}`
            : ""}
        </p>
      )}
    </div>
  );
}
