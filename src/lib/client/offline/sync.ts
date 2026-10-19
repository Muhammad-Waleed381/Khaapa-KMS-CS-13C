"use client";

import { liveQuery } from "dexie";
import { useEffect, useState, useSyncExternalStore } from "react";
import { api, ApiError } from "../api";
import { db, setMeta, type CachedItem, type LocalSale, type OutboxOp, type SalePayload, type ShiftPayload } from "./db";

// Outbox sync: every counter write is queued in IndexedDB first, then
// uploaded in order to POST /api/sync. Ops are idempotent on their id, so a
// resend after a dropped connection can never double-record a sale.

export type SyncState = {
  online: boolean;
  syncing: boolean;
  pending: number;
  failed: number;
  lastSyncAt: string | null;
  lastError: string | null;
};

let state: SyncState = {
  online: true,
  syncing: false,
  pending: 0,
  failed: 0,
  lastSyncAt: null,
  lastError: null,
};
const listeners = new Set<() => void>();

function set(patch: Partial<SyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

async function recount() {
  const ops = await db.outbox.toArray();
  set({ pending: ops.filter((o) => !o.failed).length, failed: ops.filter((o) => o.failed).length });
}

type OpResult = { id: string; ok: boolean; duplicate?: boolean; error?: string; permanent?: boolean };

let running: Promise<void> | null = null;
let again = false;

/** Upload queued ops, then refresh the item cache. Safe to call any time. */
export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await flushOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

async function flushOnce() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    set({ online: false });
    await recount();
    return;
  }
  set({ syncing: true });
  try {
    for (;;) {
      const batch = (await db.outbox.orderBy("seq").toArray()).filter((o) => !o.failed).slice(0, 50);
      if (!batch.length) break;
      const { results } = await api<{ results: OpResult[] }>("/api/sync", {
        body: { ops: batch.map(({ id, type, payload }) => ({ id, type, payload })) },
      });
      const byId = new Map(results.map((r) => [r.id, r]));
      const now = new Date().toISOString();
      let retryLater = false;
      await db.transaction("rw", db.outbox, db.sales, async () => {
        for (const op of batch) {
          const r = byId.get(op.id);
          if (r?.ok) {
            await db.outbox.delete(op.seq!);
            if (op.type === "sale") await db.sales.update(op.payload.id, { status: "synced", syncedAt: now, error: null });
          } else if (r?.permanent) {
            await db.outbox.update(op.seq!, { failed: true, tries: op.tries + 1, lastError: r.error ?? "Rejected" });
            if (op.type === "sale") await db.sales.update(op.payload.id, { status: "failed", error: r.error ?? "Rejected" });
          } else {
            await db.outbox.update(op.seq!, { tries: op.tries + 1, lastError: r?.error ?? "No response" });
            retryLater = true;
          }
        }
      });
      if (retryLater) break;
    }
    set({ online: true, lastError: null, lastSyncAt: new Date().toISOString() });
    await setMeta("lastSyncAt", state.lastSyncAt);
    await refreshItems();
  } catch (e) {
    const offline = e instanceof ApiError && e.status === 0;
    set({
      online: !offline,
      lastError: e instanceof ApiError && e.status === 401 ? "Signed out — sign in to sync" : (e as Error).message,
    });
  } finally {
    set({ syncing: false });
    await recount();
  }
}

/** Replace the cached menu with the server's (prices and stock). */
export async function refreshItems() {
  const { items } = await api<{ items: CachedItem[] }>("/api/items");
  await db.transaction("rw", db.items, db.meta, async () => {
    await db.items.clear();
    await db.items.bulkPut(items);
    await db.meta.put({ key: "itemsFetchedAt", value: new Date().toISOString() });
  });
}

async function enqueue(op: Omit<OutboxOp, "seq" | "createdAt" | "tries" | "failed" | "lastError">) {
  await db.outbox.add({ ...op, createdAt: new Date().toISOString(), tries: 0, failed: false, lastError: null } as OutboxOp);
  await recount();
  void syncNow();
}

export async function queueSale(sale: SalePayload) {
  const total = sale.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const local: LocalSale = {
    ...sale,
    total,
    change: sale.method === "cash" ? (sale.cashReceived ?? total) - total : null,
    status: "pending",
    error: null,
    syncedAt: null,
  };
  await db.sales.put(local);
  await enqueue({ id: crypto.randomUUID(), type: "sale", payload: sale });
  void pruneSales();
}

export async function queueShift(type: "shift_start" | "shift_end", payload: ShiftPayload) {
  await enqueue({ id: crypto.randomUUID(), type, payload });
}

/** Drop a sale that hasn't reached the server yet (rung up by mistake). */
export async function cancelPendingSale(saleId: string) {
  await db.transaction("rw", db.outbox, db.sales, async () => {
    const ops = await db.outbox.where("type").equals("sale").toArray();
    const op = ops.find((o) => o.type === "sale" && o.payload.id === saleId);
    if (op) await db.outbox.delete(op.seq!);
    await db.sales.update(saleId, { status: "cancelled" });
  });
  await recount();
}

/** Put a rejected op back in the queue. */
export async function retryFailed() {
  await db.transaction("rw", db.outbox, db.sales, async () => {
    const failed = (await db.outbox.toArray()).filter((o) => o.failed);
    for (const op of failed) {
      await db.outbox.update(op.seq!, { failed: false });
      if (op.type === "sale") await db.sales.update(op.payload.id, { status: "pending", error: null });
    }
  });
  await recount();
  void syncNow();
}

async function pruneSales() {
  const cutoff = new Date(Date.now() - 3 * 86_400_000).toISOString();
  await db.sales.where("createdAt").below(cutoff).and((s) => s.status !== "pending").delete();
}

let started = false;

/** Start background syncing once per page load (called by the hooks). */
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  set({ online: navigator.onLine });
  window.addEventListener("online", () => {
    set({ online: true });
    void syncNow();
  });
  window.addEventListener("offline", () => set({ online: false }));
  setInterval(() => void syncNow(), 20_000);
  void recount().then(() => syncNow());
}

const serverSnapshot: SyncState = { ...state };

export function useSyncState(): SyncState {
  useEffect(startSync, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => serverSnapshot,
  );
}

/** Subscribe to a Dexie query; re-runs whenever the tables it reads change. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({ next: setValue, error: (e) => console.error(e) });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

/**
 * Items as the counter should see them: server stock minus units this
 * device has sold that the cached snapshot doesn't include yet.
 */
export function useCounterItems(): CachedItem[] | null {
  return useLive<CachedItem[] | null>(
    async () => {
      const [items, sales, fetchedAt] = await Promise.all([
        db.items.toArray(),
        db.sales.toArray(),
        db.meta.get("itemsFetchedAt"),
      ]);
      // Never fetched on this device: nothing to show yet.
      if (!fetchedAt) return null;
      const since = fetchedAt.value as string;
      const sold = new Map<string, number>();
      for (const s of sales) {
        const unseen = s.status === "pending" || (s.status === "synced" && (s.syncedAt ?? "") > since);
        if (!unseen) continue;
        for (const l of s.lines) sold.set(l.itemId, (sold.get(l.itemId) ?? 0) + l.qty);
      }
      return items.map((i) => ({ ...i, stock: i.stock - (sold.get(i.id) ?? 0) }));
    },
    [],
    null,
  );
}
