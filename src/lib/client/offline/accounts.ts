"use client";

import { api } from "../api";
import { db, getMeta, setMeta, type CachedAccount } from "./db";
import { useLive } from "./sync";

// The counter's copy of the payment accounts and which one is current, so
// online sales keep recording the right account while offline.

const ACCOUNTS = "accounts";
const CURRENT = "currentAccountId";

/** "Shop main (NayaPay ••1234)" */
export const describeAccount = (a: CachedAccount) =>
  `${a.label} (${a.provider} ••${a.accountNumber.replace(/\s+/g, "").slice(-4)})`;

/** Pull the active accounts and the current one. A switch still waiting to upload wins over the server's value. */
export async function refreshAccounts() {
  const { accounts, currentId } = await api<{ accounts: (CachedAccount & { active: boolean })[]; currentId: string | null }>(
    "/api/accounts?active=1",
  );
  const pendingSwitch = await db.outbox.where("type").equals("account_switch").count();
  await setMeta(
    ACCOUNTS,
    accounts.map(({ id, label, provider, accountTitle, accountNumber }) => ({ id, label, provider, accountTitle, accountNumber })),
  );
  if (!pendingSwitch) await setMeta(CURRENT, currentId);
}

export async function setLocalCurrent(accountId: string) {
  await setMeta(CURRENT, accountId);
}

/** The account online sales on this device go to right now (null: none set up). */
export async function localCurrentAccount(): Promise<CachedAccount | null> {
  const [accounts, id] = await Promise.all([getMeta<CachedAccount[]>(ACCOUNTS), getMeta<string | null>(CURRENT)]);
  return accounts?.find((a) => a.id === id) ?? null;
}

export function useAccounts(): { accounts: CachedAccount[]; current: CachedAccount | null } {
  return useLive(
    async () => {
      const [accounts, id] = await Promise.all([getMeta<CachedAccount[]>(ACCOUNTS), getMeta<string | null>(CURRENT)]);
      const list = accounts ?? [];
      return { accounts: list, current: list.find((a) => a.id === id) ?? null };
    },
    [],
    { accounts: [], current: null },
  );
}
