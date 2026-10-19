// Money is kept in paisa everywhere; these helpers are the only place that
// converts to and from rupees.

export const toPaisa = (rupees: number) => Math.round(rupees * 100);
export const toRupees = (paisa: number) => paisa / 100;

/** "Rs 1,200" — shows decimals only when there are any (e.g. FIFO unit costs). */
export function rs(paisa: number | null | undefined): string {
  const v = (paisa ?? 0) / 100;
  const whole = Number.isInteger(v);
  const s = Math.abs(v).toLocaleString("en-PK", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
  return `${v < 0 ? "−" : ""}Rs ${s}`;
}
