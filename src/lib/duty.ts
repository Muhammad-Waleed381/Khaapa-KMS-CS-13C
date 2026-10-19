import { pkDate, pkTime } from "./time";

// Duty slots are the planned schedule: a person, a PKT date and an HH:MM
// window. Used on both the server and the device, so it stays pure.

export type DutySlot = { userId: string; date: string; start: string; end: string };

/** The UTC instant a slot's HH:MM falls on. */
export const slotInstant = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+05:00`);

/**
 * The slot a counter shift belongs to: the person's first slot that day that
 * hadn't ended yet when the shift started. Null means the shift isn't tied to
 * the schedule, so it only ends by hand.
 */
export function slotForShift<S extends DutySlot>(shift: { userId: string; startedAt: Date | string }, slots: S[]) {
  const date = pkDate(shift.startedAt);
  const time = pkTime(shift.startedAt);
  return (
    slots
      .filter((s) => s.userId === shift.userId && s.date === date && s.end > time)
      .sort((a, b) => a.start.localeCompare(b.start))[0] ?? null
  );
}

/** Who should be at the counter at `now`, and who reports next today. */
export function dutyAt<S extends DutySlot>(slots: S[], now: Date | number = Date.now()) {
  const date = pkDate(now);
  const time = pkTime(now);
  const today = slots.filter((s) => s.date === date).sort((a, b) => a.start.localeCompare(b.start));
  const current = today.filter((s) => s.start <= time && time < s.end);
  const upcoming = today.filter((s) => s.start > time);
  const next = upcoming.filter((s) => s.start === upcoming[0]?.start);
  return { current, next };
}
