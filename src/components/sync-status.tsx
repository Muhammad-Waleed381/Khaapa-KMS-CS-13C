"use client";

import { cx } from "@/components/ui";
import { retryFailed, syncNow, useSyncState } from "@/lib/client/offline/sync";

/** Online / pending-sync pill for the shell. Click to sync now (or retry rejected ops). */
export function SyncStatus() {
  const s = useSyncState();

  let label: string;
  let tone: string;
  if (s.failed) {
    label = `${s.failed} rejected · retry`;
    tone = "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";
  } else if (!s.online) {
    label = s.pending ? `Offline · ${s.pending} pending` : "Offline";
    tone = "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  } else if (s.syncing) {
    label = "Syncing…";
    tone = "bg-muted text-ink-soft";
  } else if (s.pending) {
    label = `${s.pending} pending`;
    tone = "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  } else {
    label = "Synced";
    tone = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  }

  return (
    <button
      onClick={() => (s.failed ? retryFailed() : syncNow())}
      title={s.lastError ?? (s.lastSyncAt ? `Last synced ${new Date(s.lastSyncAt).toLocaleTimeString()}` : "Sync now")}
      className={cx("inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-1 text-xs font-medium transition hover:opacity-80", tone)}
    >
      <span
        className={cx(
          "size-1.5 rounded-full bg-current",
          s.syncing && "animate-pulse",
        )}
      />
      {label}
    </button>
  );
}
