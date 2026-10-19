"use client";

import { useSyncExternalStore } from "react";
import { queueShift } from "./sync";

// The counter's current shift lives on the device so it can start and end
// offline; the server learns about it through the outbox.

export type LocalShift = { id: string; userId: string; startedAt: string };

const KEY = "khaapa:shift";
const ENDED_KEY = "khaapa:ended-shifts";
const listeners = new Set<() => void>();
let cache: LocalShift | null | undefined;

function read(): LocalShift | null {
  if (cache !== undefined) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    cache = null;
  }
  return cache ?? null;
}

function write(s: LocalShift | null) {
  cache = s;
  if (s) localStorage.setItem(KEY, JSON.stringify(s));
  else localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

/** The shift open on this device for `userId`, or null. */
export function useLocalShift(userId: string): LocalShift | null {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => null,
  );
  return s && s.userId === userId ? s : null;
}

export async function startShift(userId: string) {
  const s = { id: crypto.randomUUID(), userId, startedAt: new Date().toISOString() };
  write(s);
  await queueShift("shift_start", { id: s.id, startedAt: s.startedAt });
  return s;
}

function endedIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(ENDED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export async function endShift(s: LocalShift) {
  // Remember it so a stale /api/me (still showing it open) can't revive it.
  localStorage.setItem(ENDED_KEY, JSON.stringify([...endedIds(), s.id].slice(-20)));
  write(null);
  await queueShift("shift_end", { id: s.id, endedAt: new Date().toISOString() });
}

/** Adopt a shift the server knows about (started on another device). */
export function adoptShift(s: LocalShift) {
  if (endedIds().includes(s.id)) return;
  write(s);
}
