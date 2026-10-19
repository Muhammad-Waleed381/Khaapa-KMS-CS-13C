"use client";

import { useState } from "react";
import { toast } from "@/components/toast";
import { Button, Card, Field, Input } from "@/components/ui";
import { api } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { compressImage } from "./compress";
import type { ShopSettings } from "./types";

/** Pay the advance on NayaPay, then send the transaction reference (+ screenshot). */
export function PaymentStep({
  order,
  shop,
  onDone,
}: {
  order: { id: string; code: string; total: number };
  shop?: ShopSettings;
  onDone: () => void;
}) {
  const [ref, setRef] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const np = shop?.nayapay;

  async function pick(file?: File) {
    if (!file) return;
    try {
      setProof(await compressImage(file));
    } catch (e) {
      toast((e as Error).message, "bad");
    }
  }

  async function send() {
    setBusy(true);
    try {
      await api(`/api/public/preorders/${order.id}/proof`, {
        body: { code: order.code, paymentRef: ref, proof: proof ?? undefined },
      });
      toast("Payment sent. We'll confirm it shortly.");
      onDone();
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-ink-soft">Order code</div>
          <div className="font-mono text-2xl font-bold tracking-widest">{order.code}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-ink-soft">Pay now</div>
          <div className="text-2xl font-bold tabular-nums">{rs(order.total)}</div>
        </div>
      </div>

      <div className="mt-5 rounded-lg bg-muted p-4 text-sm">
        <div className="font-semibold">Pay in advance on NayaPay</div>
        {np?.handle ? (
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {np.name && (
              <>
                <dt className="text-ink-soft">Account</dt>
                <dd className="font-medium">{np.name}</dd>
              </>
            )}
            <dt className="text-ink-soft">NayaPay</dt>
            <dd className="font-mono font-medium select-all">{np.handle}</dd>
            <dt className="text-ink-soft">Amount</dt>
            <dd className="font-medium">{rs(order.total)}</dd>
          </dl>
        ) : (
          <p className="mt-1 text-ink-soft">Ask the shop for the NayaPay account to pay to.</p>
        )}
        <p className="mt-2 text-ink-soft">
          {np?.instructions || `Put your order code ${order.code} in the payment note.`}
        </p>
      </div>

      <div className="mt-5 space-y-3">
        <Field label="Transaction ID / reference" hint="From the NayaPay receipt after you pay.">
          <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. 1234567890" />
        </Field>
        <Field label="Screenshot (optional)">
          <Input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0])} className="py-1 file:mr-3 file:rounded file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs" />
        </Field>
        {proof && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proof} alt="Payment screenshot" className="max-h-48 rounded-md border border-line" />
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button variant="primary" disabled={busy || ref.trim().length < 3} onClick={send}>
            {busy ? "Sending…" : "I've paid"}
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Pay later
          </Button>
        </div>
        <p className="text-xs text-ink-faint">Your order is confirmed once staff verify the payment.</p>
      </div>
    </Card>
  );
}
