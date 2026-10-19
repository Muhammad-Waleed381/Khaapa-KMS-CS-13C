"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";
import { toast } from "@/components/toast";
import { Modal, Spinner } from "@/components/ui";
import { api } from "@/lib/client/api";
import { rs } from "@/lib/money";

// Types and small pieces shared by My shares and Manage shares.

export type Account = { id: string; label: string; provider: string; accountTitle: string; accountNumber: string };

export type PurchaseStatus = "pending" | "approved" | "rejected" | "cancelled";

export type Purchase = {
  id: string;
  shares: number;
  pricePerShare: number;
  total: number;
  paymentRef: string | null;
  hasProof: boolean;
  status: PurchaseStatus;
  note: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type Mine = {
  holdings: { id: string; shares: number; pricePerShare: number; boughtOn: string; fromRequest: boolean }[];
  totals: { shares: number; invested: number; estimatedProfit: number; payout: number };
  totalShares: number;
  profitPerShare: number;
  purchases: Purchase[];
  offer: { open: boolean; pricePerShare: number; maxPerPerson: number; remaining: number; account: Account | null };
};

export const STATUS_WORDS: Record<PurchaseStatus, string> = {
  pending: "Waiting for approval",
  approved: "Approved",
  rejected: "Not approved",
  cancelled: "Cancelled",
};

export const plural = (n: number, word: string) => `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;

/** Profit figures are estimates; whole rupees read better than "Rs 1,010.93". */
export const rsRound = (paisa: number) => rs(Math.round(paisa / 100) * 100);

/** Where to send the money: big and copyable, so nobody mistypes the number. */
export function AccountCard({ account, amount }: { account: Account; amount?: number }) {
  const copy = (text: string, what: string) =>
    navigator.clipboard.writeText(text).then(
      () => toast(`${what} copied`),
      () => toast("Couldn't copy", "bad"),
    );
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      {amount !== undefined && (
        <div className="mb-4 flex items-end justify-between gap-3 border-b border-line pb-4">
          <div>
            <div className="text-sm text-ink-soft">Send exactly</div>
            <div className="text-3xl font-semibold tracking-tight tabular-nums">{rs(amount)}</div>
          </div>
          <button
            type="button"
            onClick={() => copy(String(amount / 100), "Amount")}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-soft hover:bg-muted hover:text-ink"
          >
            Copy amount
          </button>
        </div>
      )}
      <div className="text-sm text-ink-soft">To this {account.provider} account</div>
      <div className="mt-1 text-lg font-semibold">{account.accountTitle}</div>
      <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-muted px-4 py-3">
        <span className="font-mono text-lg tracking-wide tabular-nums">{account.accountNumber}</span>
        <button
          type="button"
          onClick={() => copy(account.accountNumber, "Account number")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-background"
        >
          <Icon name="copy" /> Copy
        </button>
      </div>
    </div>
  );
}

/**
 * Loads a request's payment screenshot. Plain fetch on purpose: useApi would
 * keep a copy of every image in localStorage.
 */
export function useProof(id: string | null) {
  const [state, setState] = useState<{ id: string; proof: string | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let live = true;
    api<{ proof: string | null }>(`/api/share-purchases/${id}/proof`)
      .then((r) => live && setState({ id, proof: r.proof }))
      .catch(() => live && setState({ id, proof: null }));
    return () => {
      live = false;
    };
  }, [id]);
  return state && state.id === id ? state : null;
}

/** The payment screenshot attached to a share request. */
export function ProofModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const proof = useProof(id);
  return (
    <Modal open={!!id} onClose={onClose} title="Payment screenshot">
      {!proof ? (
        <div className="grid place-items-center py-10">
          <Spinner />
        </div>
      ) : proof.proof ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={proof.proof} alt="Payment screenshot" className="w-full rounded-xl border border-line" />
      ) : (
        <p className="text-sm text-ink-soft">No screenshot was attached.</p>
      )}
    </Modal>
  );
}
