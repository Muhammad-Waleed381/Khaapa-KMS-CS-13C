"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { slotForShift, slotInstant, type DutySlot } from "@/lib/duty";
import { db } from "./db";
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

export async function endShift(s: LocalShift, opts: { endedAt?: string; auto?: boolean } = {}) {
  // Remember it so a stale /api/me (still showing it open) can't revive it.
  localStorage.setItem(ENDED_KEY, JSON.stringify([...endedIds(), s.id].slice(-20)));
  write(null);
  await queueShift("shift_end", { id: s.id, endedAt: opts.endedAt ?? new Date().toISOString(), auto: opts.auto });
}

let held = false;
let ending: string | null = null;

/** The counter holds the shift open while a sale is in the cart, so a handover never wipes it. */
export function holdShift(on: boolean) {
  held = on;
}

/**
 * Ends this device's shift when the person's duty slot ends, offline too.
 * Mirrors closeOverdueShifts on the server: the shift closes at the slot's end,
 * or at the last sale if the handover ran over.
 */
export function useShiftAutoEnd(userId: string, slots: DutySlot[], onEnded: (slotEnd: string) => void) {
  const shift = useLocalShift(userId);
  const ended = useRef(onEnded);
  useEffect(() => {
    ended.current = onEnded;
  });

  useEffect(() => {
    if (!shift) return;
    const slot = slotForShift(shift, slots);
    if (!slot) return;
    const end = slotInstant(slot.date, slot.end).getTime();
    let done = false;
    const check = async () => {
      if (done || held || Date.now() < end || ending === shift.id) return;
      done = true;
      ending = shift.id;
      const sales = await db.sales.filter((s) => s.shiftId === shift.id && s.status !== "cancelled").toArray();
      const last = Math.max(end, ...sales.map((s) => new Date(s.createdAt).getTime()));
      await endShift(shift, { endedAt: new Date(last).toISOString(), auto: true });
      ended.current(slot.end);
    };
    void check();
    const timer = setInterval(check, 15_000);
    return () => {
      done = true;
      clearInterval(timer);
    };
  }, [shift, slots]);
}

/** Adopt a shift the server knows about (started on another device). */
export function adoptShift(s: LocalShift) {
  if (endedIds().includes(s.id)) return;
  write(s);
}
