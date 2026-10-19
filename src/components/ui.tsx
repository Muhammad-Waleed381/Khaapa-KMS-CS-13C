"use client";

// The app's component kit. Same API the pages have always used, now built on
// shadcn/ui (src/components/ui/*) so every screen shares one look.

import { useSyncExternalStore, type ComponentProps, type ReactNode } from "react";
import { Loader2Icon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge as UiBadge } from "@/components/ui/badge";
import { Button as UiButton } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input as UiInput } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea as UiTextarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const cx = cn;

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT = { primary: "default", secondary: "outline", ghost: "ghost", danger: "destructive" } as const;
const SIZE = { sm: "sm", md: "default", lg: "lg" } as const;

export function Button({
  variant = "secondary",
  size = "md",
  ...p
}: ComponentProps<"button"> & { variant?: ButtonVariant; size?: "sm" | "md" | "lg" }) {
  return <UiButton variant={VARIANT[variant]} size={SIZE[size]} {...p} />;
}

export function Input({ className, ...p }: ComponentProps<"input">) {
  return <UiInput className={cn("h-9 bg-card", className)} {...p} />;
}

export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <UiTextarea className={cn("min-h-20 bg-card", className)} {...p} />;
}

/** Native select, styled like the inputs (keeps the simple value/onChange API). */
export function Select({ className, ...p }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-input bg-card px-2.5 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...p}
    />
  );
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <Label className="flex flex-col items-stretch gap-1.5 font-normal">
      <span className="text-[0.8125rem] font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs font-normal text-ink-faint">{hint}</span>}
    </Label>
  );
}

/** A surface one tone lighter than the page. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl bg-card text-card-foreground", className)}>{children}</div>;
}

export type Tone = "neutral" | "good" | "warn" | "bad" | "accent";

const TONE: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground",
  good: "bg-primary-soft text-primary",
  warn: "bg-warn/12 text-warn",
  bad: "bg-destructive/10 text-destructive",
  accent: "bg-foreground text-background",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <UiBadge variant="secondary" className={cn("h-5 rounded-sm px-1.5 text-[0.75rem] font-semibold", TONE[tone])}>
      {children}
    </UiBadge>
  );
}

const PHONE = "(max-width: 639px)";

function useIsPhone() {
  return useSyncExternalStore(
    (l) => {
      const m = window.matchMedia(PHONE);
      m.addEventListener("change", l);
      return () => m.removeEventListener("change", l);
    },
    () => window.matchMedia(PHONE).matches,
    () => false,
  );
}

/** Bottom sheet (drawer) on phones, centred dialog on larger screens. Esc and the overlay close it. */
export function Modal({
  open,
  onClose,
  title,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  wide?: boolean;
  children: ReactNode;
}) {
  const phone = useIsPhone();
  const onOpenChange = (o: boolean) => !o && onClose();
  if (phone)
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[92dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-display text-2xl">{title}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">{children}</div>
        </DrawerContent>
      </Drawer>
    );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[90dvh] overflow-y-auto", wide ? "sm:max-w-2xl" : "sm:max-w-md")}>
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Page heading with optional actions on the right. */
export function PageHeader({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-4xl md:text-5xl">{title}</h1>
        {sub && <p className="mt-1.5 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-muted/60 px-6 py-10 text-center text-sm text-muted-foreground">{children}</div>;
}

export function Spinner() {
  return <Loader2Icon aria-label="Loading" className="size-5 animate-spin text-primary" />;
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-[0.8125rem] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-3xl tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-faint">{sub}</div>}
    </Card>
  );
}

/** Shows when a useApi page is displaying cached data because the network failed. */
export function StaleNote({ stale }: { stale: boolean }) {
  if (!stale) return null;
  return (
    <Alert className="mb-4 border-0 bg-warn/12 text-warn">
      <AlertDescription className="text-warn">Offline: showing the last saved copy.</AlertDescription>
    </Alert>
  );
}
