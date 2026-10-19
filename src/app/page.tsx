import { HomeClient } from "@/components/public/home";
import { PublicHeader } from "@/components/public/header";

export default function Home() {
  return (
    <div className="min-h-dvh">
      <PublicHeader active="menu" />
      <section className="mx-auto max-w-5xl px-4 pt-8 pb-6 sm:pt-12">
        <p className="text-sm font-medium text-accent">Student-run since day one</p>
        <h1 className="mt-1 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
          Tuck shop at K2 Block, NUST H-12
        </h1>
        <p className="mt-2 max-w-xl text-ink-soft">
          Snacks and drinks between classes. Live prices and stock, and pre-orders for today or tomorrow.
        </p>
      </section>
      <HomeClient />
    </div>
  );
}
