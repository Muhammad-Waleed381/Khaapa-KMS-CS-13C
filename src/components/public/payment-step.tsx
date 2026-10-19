"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, ImageUpIcon } from "lucide-react";
import { toast } from "@/components/toast";
import { Button, cx } from "@/components/ui";
import { api } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { compressImage } from "./compress";
import type { PaymentAccount } from "./types";

/** Pay the advance online into the order's account, then attach a screenshot of the payment. */
export function PaymentStep({
  order,
  account,
  onDone,
}: {
  order: { id: string; code: string; total: number };
  account?: PaymentAccount | null;
  /** `sent` is true when the screenshot was sent, false for "pay later". */
  onDone: (sent: boolean) => void;
}) {
  const [proof, setProof] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text.replace(/\s+/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
    if (!proof) return;
    setBusy(true);
    try {
      await api(`/api/public/preorders/${order.id}/proof`, { body: { code: order.code, proof } });
      toast("Screenshot sent. We'll confirm your payment shortly.");
      onDone(true);
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-ink-soft">Your order code</div>
          <div className="font-mono text-2xl font-bold tracking-widest">{order.code}</div>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-ink-soft">Amount to pay</div>
          <div className="font-display text-4xl tabular-nums">{rs(order.total)}</div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">1</span>
          Send the money to this account
        </div>
        {account ? (
          <div className="rounded-2xl border-2 border-primary/30 bg-primary-soft/50 p-4">
            <div className="text-xs font-medium tracking-wide text-ink-soft uppercase">{account.provider}</div>
            <div className="mt-0.5 text-sm text-ink">{account.accountTitle}</div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="font-mono text-xl font-semibold tracking-wide select-all sm:text-2xl">{account.accountNumber}</span>
              <button
                type="button"
                onClick={() => copy(account.accountNumber)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-sm font-medium shadow-sm hover:bg-muted"
              >
                {copied ? <CheckIcon className="size-4 text-primary" /> : <CopyIcon className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              Write <b className="font-mono text-ink">{order.code}</b> in the payment note so we can match it.
            </p>
          </div>
        ) : (
          <p className="rounded-2xl bg-muted p-4 text-sm text-ink-soft">Ask the shop which account to pay into.</p>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-6 place-items-center rounded-full bg-primary text-xs text-primary-foreground">2</span>
          Attach a screenshot of the payment
        </div>
        <label
          className={cx(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center text-sm transition",
            proof ? "border-primary/40 bg-primary-soft/30" : "border-line hover:border-ink-faint hover:bg-muted/50",
          )}
        >
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          {proof ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proof} alt="Payment screenshot" className="max-h-56 rounded-lg" />
              <span className="text-xs text-ink-soft">Tap to choose a different screenshot</span>
            </>
          ) : (
            <>
              <ImageUpIcon className="size-7 text-ink-faint" />
              <span className="font-medium text-ink">Choose screenshot</span>
              <span className="text-xs text-ink-faint">From your gallery, after you pay</span>
            </>
          )}
        </label>
      </div>

      <div className="space-y-2">
        <Button variant="primary" size="lg" className="h-12 w-full text-base" disabled={busy || !proof} onClick={send}>
          {busy ? "Sending…" : "I've paid, send screenshot"}
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => onDone(false)}>
          I&apos;ll pay later
        </Button>
        <p className="text-center text-xs text-ink-faint">Your order is confirmed once staff check the payment.</p>
      </div>
    </div>
  );
}
