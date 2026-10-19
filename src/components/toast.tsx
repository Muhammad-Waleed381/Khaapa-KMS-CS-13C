"use client";

import { toast as sonner } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";

/** toast("Saved") or toast("Couldn't save", "bad") from anywhere on the client. */
export function toast(text: string, tone: "good" | "bad" = "good") {
  if (tone === "bad") sonner.error(text);
  else sonner.success(text);
}

export function Toaster() {
  return <Sonner position="bottom-center" offset={{ bottom: 88 }} mobileOffset={{ bottom: 96 }} />;
}
