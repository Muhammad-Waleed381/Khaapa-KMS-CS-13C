"use client";

import Dexie, { type EntityTable } from "dexie";

// Device-local store for the counter. The server stays the source of truth;
// this holds what the counter needs to keep selling without a connection.

export type CachedItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  lowStockAt: number;
  preorder: boolean;
  active: boolean;
  hasImage: boolean;
  imageVersion: string | number | null;
  stock: number;
  owed: number;
};

export type SaleLine = { itemId: string; name: string; qty: number; unitPrice: number };

export type SalePayload = {
  id: string;
  createdAt: string;
  method: "cash" | "online";
  cashReceived: number | null;
  shiftId: string | null;
  lines: SaleLine[];
};

export type ShiftPayload = { id: string; startedAt?: string; endedAt?: string };

export type OutboxOp =
  | { seq?: number; id: string; type: "sale"; payload: SalePayload; createdAt: string; tries: number; failed: boolean; lastError: string | null }
  | { seq?: number; id: string; type: "shift_start" | "shift_end"; payload: ShiftPayload; createdAt: string; tries: number; failed: boolean; lastError: string | null };

/** This device's own sales, kept for the "recent sales" panel and day totals. */
export type LocalSale = SalePayload & {
  total: number;
  change: number | null;
  status: "pending" | "synced" | "failed" | "cancelled";
  error: string | null;
  syncedAt: string | null;
};

export type Meta = { key: string; value: unknown };

export const db = new Dexie("khaapa") as Dexie & {
  items: EntityTable<CachedItem, "id">;
  outbox: EntityTable<OutboxOp, "seq">;
  sales: EntityTable<LocalSale, "id">;
  meta: EntityTable<Meta, "key">;
};

db.version(1).stores({
  items: "id, category",
  outbox: "++seq, &id, type",
  sales: "id, createdAt, status",
  meta: "key",
});

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value });
}
