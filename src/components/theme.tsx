"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { ThemeProvider as NextThemes, useTheme } from "next-themes";
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { cn } from "@/lib/utils";

// Browser chrome colour per theme (matches the viewport themeColor in the root layout).
const CHROME = { light: "#ffffff", dark: "#000000" } as const;

/** Light/dark for the whole app: follows the device until someone picks, then remembers. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem storageKey="khaapa:theme">
      <ChromeColour />
      {children}
    </NextThemes>
  );
}

// The theme-color metas are keyed to the device setting; when someone picks the
// other theme by hand, point both at the chosen colour so the browser bar matches.
function ChromeColour() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'))
      m.content = CHROME[resolvedTheme];
  }, [resolvedTheme]);
  return null;
}

const noop = () => () => {};

/**
 * The sun/moon switch. The new theme ripples out from the button (View
 * Transitions); browsers without them just swap instantly.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // The theme is only known in the browser; render a same-size blank until then.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const box = cn("grid size-8 shrink-0 place-items-center rounded-md [&_svg]:size-4", className);
  if (!mounted) return <span aria-hidden className={box} />;
  return (
    <AnimatedThemeToggler
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      onThemeChange={setTheme}
      duration={450}
      title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(box, "transition-colors")}
    />
  );
}
