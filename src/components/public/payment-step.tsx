"use client";

import { useState } from "react";
import { toast } from "@/components/toast";
import { Button, Card, Field, Input } from "@/components/ui";
import { api } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { compressImage } from "./compress";
import type { PaymentAccount } from "./types";

/** Pay the advance online into the order's account, then send the transaction reference (+ screenshot). */
export function PaymentStep({
  order,
  account,
  onDone,
}: {
  order: { id: string; code: string; total: number };
  account?: PaymentAccount | null;
  onDone: () => void;
}) {
  const [ref, setRef] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Account number copied");
    } catch {
      toast("Couldn't copy, select it instead", "bad");
    }
  }

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
        <div className="font-semibold">Pay in advance online</div>
        {account ? (
          <dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1">
            <dt className="text-ink-soft">Pay with</dt>
            <dd className="font-medium">{account.provider}</dd>
            <dt className="text-ink-soft">Account title</dt>
            <dd className="font-medium">{account.accountTitle}</dd>
            <dt className="text-ink-soft">Account no.</dt>
            <dd className="flex items-center gap-2">
              <span className="font-mono font-medium select-all">{account.accountNumber}</span>
              <button
                type="button"
                onClick={() => copy(account.accountNumber)}
                className="rounded px-1.5 py-0.5 text-xs font-medium text-ink-soft hover:bg-surface hover:text-ink"
              >
                Copy
              </button>
            </dd>
            <dt className="text-ink-soft">Amount</dt>
            <dd className="font-medium">{rs(order.total)}</dd>
          </dl>
        ) : (
          <p className="mt-1 text-ink-soft">Ask the shop which account to pay into.</p>
        )}
        <p className="mt-2 text-ink-soft">Put your order code {order.code} in the payment note.</p>
      </div>

      <div className="mt-5 space-y-3">
        <Field label="Transaction ID / reference" hint="From the payment receipt after you pay.">
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
