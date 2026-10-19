import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pre-order",
  description: "Pre-order snacks and drinks from Khaapa for today or tomorrow. Pay in advance online.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
