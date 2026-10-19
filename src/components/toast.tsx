"use client";

import { useSyncExternalStore } from "react";

type Toast = { id: number; text: string; tone: "good" | "bad" };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** toast("Saved") or toast("Couldn't save", "bad") from anywhere on the client. */
export function toast(text: string, tone: Toast["tone"] = "good") {
  const id = nextId++;
  toasts = [...toasts, { id, text, tone }];
  emit();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  }, 3200);
}

export function Toaster() {
  const list = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => toasts,
    () => toasts,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
      {list.map((t) => (
        <div
          key={t.id}
          className={`rise rounded-lg px-4 py-2 text-sm font-medium shadow-lg ${
            t.tone === "good" ? "bg-ink text-white" : "bg-red-600 text-white"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
