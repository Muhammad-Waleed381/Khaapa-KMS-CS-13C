import Link from "next/link";

export function PublicHeader({ active }: { active?: "menu" | "preorder" }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Khaapa<span className="text-accent">.</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {active !== "menu" && (
            <Link href="/" className="rounded-md px-3 py-1.5 font-medium text-ink-soft hover:bg-muted hover:text-ink">
              Menu
            </Link>
          )}
          {active !== "preorder" && (
            <Link href="/preorder" className="rounded-md bg-accent px-3 py-1.5 font-medium text-white hover:bg-accent/90">
              Pre-order
            </Link>
          )}
          <Link href="/login" className="rounded-md px-2.5 py-1.5 text-xs text-ink-faint hover:bg-muted hover:text-ink">
            Staff
          </Link>
        </nav>
      </div>
    </header>
  );
}
