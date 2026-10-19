"use client";

import { createContext, useContext } from "react";

export type Me = {
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    role: "admin" | "member";
    status: "pending" | "active" | "disabled";
  };
  shift: { id: string; userId: string; startedAt: string; endedAt: string | null } | null;
  onCounter: { userId: string; name: string; startedAt: string }[];
};

export const MeContext = createContext<{ me: Me; reload: () => Promise<void> } | null>(null);

/** The signed-in staff member. Only usable inside the (staff) layout. */
export function useMe() {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error("useMe outside staff layout");
  return { ...ctx.me, isAdmin: ctx.me.user.role === "admin", reload: ctx.reload };
}
