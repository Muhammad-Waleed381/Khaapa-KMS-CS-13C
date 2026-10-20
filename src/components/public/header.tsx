import Link from "next/link";
import { ThemeToggle } from "@/components/theme";
import { StaffLink } from "@/components/staff-link";

export function PublicHeader({ active }: { active?: "menu" | "preorder" | "contribution" }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Khaapa<span className="text-primary">.</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {active !== "menu" && (
            <Link href="/" className="rounded-md px-3 py-1.5 font-medium text-ink-soft hover:bg-muted hover:text-ink">
              Menu
            </Link>
          )}
          {active !== "contribution" && (
            <Link href="/contribution" className="rounded-md px-3 py-1.5 font-medium text-ink-soft hover:bg-muted hover:text-ink">
              Contribution
            </Link>
          )}
          {active !== "preorder" && (
            <Link href="/preorder" className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground hover:bg-primary/90">
              Pre-order
            </Link>
          )}
          <StaffLink className="rounded-md px-2.5 py-1.5 text-xs text-ink-faint hover:bg-muted hover:text-ink">
            Staff
          </StaffLink>
          <ThemeToggle className="text-ink-soft hover:bg-muted hover:text-ink" />
        </nav>
      </div>
    </header>
  );
}
