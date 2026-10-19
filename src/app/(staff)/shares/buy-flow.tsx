"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { Steps } from "@/components/kit";
import { compressImage } from "@/components/public/compress";
import { toast } from "@/components/toast";
import { Button, cx } from "@/components/ui";
import { api } from "@/lib/client/api";
import { rs } from "@/lib/money";
import { AccountCard, plural, type Mine } from "./shared";

const STEPS = [
  { title: "Choose", description: "How many shares" },
  { title: "Pay", description: "Send the money" },
  { title: "Screenshot", description: "Show you paid" },
  { title: "Approval", description: "An admin checks it" },
];

/** Buying shares, one small step at a time. */
export function BuyFlow({ offer, onDone }: { offer: Mine["offer"]; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [count, setCount] = useState(1);
  const [proof, setProof] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const n = Math.min(Math.max(1, count), Math.max(1, offer.remaining));
  const amount = n * offer.pricePerShare;

  const submit = async () => {
    if (!proof) return;
    setBusy(true);
    try {
      await api("/api/share-purchases", { body: { shares: n, proof } });
      // Reload the page's data only when they press Done, so this confirmation
      // stays on screen even if they've now reached their limit.
      setStep(3);
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setStep(0);
    setCount(1);
    setProof(null);
    onDone();
  };

  return (
    <div className="space-y-6 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <Steps steps={STEPS} current={step} className="hidden sm:grid" />
      {/* Phones: a compact progress line instead of four stacked steps. */}
      <div className="sm:hidden">
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <span key={i} className={cx("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
          ))}
        </div>
        <div className="mt-2 text-sm">
          <span className="text-ink-faint">
            Step {step + 1} of {STEPS.length} ·{" "}
          </span>
          <span className="font-medium">{STEPS[step].title}</span>
        </div>
      </div>

      {step === 0 && (
        <div className="space-y-5">
          <div className="text-center">
            <div className="text-sm text-ink-soft">How many shares do you want?</div>
            <div className="mt-4 flex items-center justify-center gap-5">
              <StepperButton label="One fewer" onClick={() => setCount(n - 1)} disabled={n <= 1}>
                <Icon name="minus" className="size-6" />
              </StepperButton>
              <div className="w-20 text-6xl font-semibold tabular-nums">{n}</div>
              <StepperButton label="One more" onClick={() => setCount(n + 1)} disabled={n >= offer.remaining}>
                <Icon name="plus" className="size-6" />
              </StepperButton>
            </div>
            <div className="mt-3 text-sm text-ink-soft">
              You can buy up to{" "}
              <b className="text-ink">
                {plural(offer.remaining, offer.remaining < offer.maxPerPerson ? "more share" : "share")}
              </b>
            </div>
          </div>
          <div className="rounded-xl bg-muted/60 px-4 py-3 text-center">
            <div className="text-sm text-ink-soft">
              {plural(n, "share")} × {rs(offer.pricePerShare)}
            </div>
            <div className="text-2xl font-semibold tabular-nums">{rs(amount)}</div>
          </div>
          <Button variant="primary" size="lg" className="w-full" onClick={() => setStep(1)}>
            Continue to payment
          </Button>
        </div>
      )}

      {step === 1 && offer.account && (
        <div className="space-y-5">
          <AccountCard account={offer.account} amount={amount} />
          <p className="text-center text-sm text-ink-soft">
            Pay from your phone, then take a screenshot of the confirmation screen.
          </p>
          <div className="flex gap-3">
            <Button size="lg" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={() => setStep(2)}>
              I&apos;ve paid {rs(amount)}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <ScreenshotDrop value={proof} onChange={setProof} />
          <div className="flex gap-3">
            <Button size="lg" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button variant="primary" size="lg" className="flex-1" onClick={submit} disabled={!proof || busy}>
              {busy ? "Sending…" : "Send for approval"}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-primary-soft text-primary">
            <Icon name="check" className="size-7" />
          </div>
          <div>
            <div className="text-lg font-semibold">Request sent</div>
            <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">
              An admin will check your payment of {rs(amount)}. Your {plural(n, "share")} will show up here once it&apos;s
              approved.
            </p>
          </div>
          <Button onClick={restart}>Done</Button>
        </div>
      )}
    </div>
  );
}

function StepperButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-14 place-items-center rounded-full border border-line bg-surface text-ink shadow-sm transition hover:bg-muted active:scale-95 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** Tap to pick, or drop an image. Shrunk on the phone before upload. */
function ScreenshotDrop({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [working, setWorking] = useState(false);

  const take = async (file: File | undefined) => {
    if (!file) return;
    setWorking(true);
    try {
      onChange(await compressImage(file));
    } catch (e) {
      toast((e as Error).message, "bad");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => take(e.target.files?.[0])}
      />
      {value ? (
        <div className="space-y-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Your payment screenshot" className="mx-auto max-h-72 rounded-xl border border-line" />
          <Button size="sm" onClick={() => input.current?.click()}>
            Use a different screenshot
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            take(e.dataTransfer.files?.[0]);
          }}
          className={cx(
            "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
            dragging ? "border-primary bg-primary-soft/50" : "border-line hover:border-primary/50 hover:bg-muted/40",
          )}
        >
          <span className="grid size-12 place-items-center rounded-full bg-muted text-ink-soft">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="font-medium">{working ? "Preparing…" : "Add your payment screenshot"}</span>
          <span className="text-sm text-ink-soft">Tap to choose a photo, or drop it here</span>
        </button>
      )}
    </div>
  );
}
