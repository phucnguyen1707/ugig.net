interface InvoiceItem {
  id: string;
  description: string | null;
  amount_usd: number;
  position: number;
}

interface InvoiceChargesProps {
  amountUsd: number;
  currency: string;
  gigTitle: string | null;
  items?: InvoiceItem[] | null;
  metadata: {
    amount_crypto?: string | number | null;
    payment_currency?: string | null;
    expires_at?: string | null;
  } | null;
}

// Itemized view of what an invoice bills: the line items (or a single
// synthesized line for older invoices without items), the total, and the
// live crypto quote when a payment request exists.
export function InvoiceCharges({
  amountUsd,
  currency,
  gigTitle,
  items,
  metadata,
}: InvoiceChargesProps) {
  const crypto = metadata?.amount_crypto;
  const cryptoCurrency = metadata?.payment_currency;

  const lines =
    items && items.length > 0
      ? [...items]
          .sort((a, b) => a.position - b.position)
          .map((it) => ({
            label: it.description?.trim() || "Charge",
            amount: Number(it.amount_usd),
          }))
      : [
          {
            label: gigTitle ? `Work on “${gigTitle}”` : "Invoice amount",
            amount: amountUsd,
          },
        ];

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Charges
      </p>
      <div className="divide-y divide-border/60">
        {lines.map((line, i) => (
          <div key={i} className="flex items-start justify-between gap-3 py-1">
            <span className="text-foreground">{line.label}</span>
            <span className="whitespace-nowrap font-medium tabular-nums">
              ${line.amount.toFixed(2)}
            </span>
          </div>
        ))}
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
