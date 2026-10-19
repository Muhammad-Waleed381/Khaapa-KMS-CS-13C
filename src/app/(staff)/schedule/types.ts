export type Slot = {
  id: string;
  userId: string;
  name: string;
  date: string;
  start: string;
  end: string;
  note: string | null;
};

export type Window = {
  id: string;
  userId: string;
  name: string;
  weekday: number;
  start: string;
  end: string;
  note: string | null;
};

export type Person = { id: string; name: string };

/** Mon..Sun dates of the week starting at `monday`. */
export const weekDates = (monday: string, addDays: (d: string, n: number) => string) =>
  Array.from({ length: 7 }, (_, i) => addDays(monday, i));
