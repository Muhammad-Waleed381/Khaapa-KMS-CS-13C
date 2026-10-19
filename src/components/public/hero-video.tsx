"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";

/**
 * The hero film: a short muted loop behind the name. `scripts/hero-video.sh <clip>`
 * writes the files below into public/hero; set this to null to fall back to the
 * plain ground colour.
 */
export const HERO_VIDEO: { mp4: string; mp4Small: string; webm: string; poster: string } | null = null;

/** How much of the ground colour sits over the film so the name stays readable (0–1). */
const TINT = 0.6;

const REDUCE = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mq = matchMedia(REDUCE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

// Motion only for visitors who haven't asked for reduced motion or data saving;
// everyone else (and the server render) gets the poster as a still.
function wantsMotion() {
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  return !!HERO_VIDEO && !matchMedia(REDUCE).matches && !saveData;
}

export function useHeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  const motion = useSyncExternalStore(subscribe, wantsMotion, () => false);
  const [paused, setPaused] = useState(false);
  const pausedByUser = useRef(false);

  // Plays only while on screen, so it isn't burning battery under the rate list.
  useEffect(() => {
    const v = ref.current;
    if (!motion || !v) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !pausedByUser.current) v.play().catch(() => setPaused(true));
      else v.pause();
    });
    io.observe(v);
    return () => io.disconnect();
  }, [motion]);

  function toggle() {
    const v = ref.current;
    if (!v) return;
    pausedByUser.current = !v.paused;
    if (v.paused) v.play().catch(() => undefined);
    else v.pause();
  }

  return { ref, motion, paused, setPaused, toggle };
}

/** The film itself, filling the hero behind everything else. Decorative, so hidden from screen readers. */
export function HeroVideo({
  videoRef,
  motion,
  onPausedChange,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  motion: boolean;
  onPausedChange: (paused: boolean) => void;
}) {
  if (!HERO_VIDEO) return null;
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <video
        key={motion ? "motion" : "still"}
        ref={videoRef}
        poster={HERO_VIDEO.poster}
        muted
        loop
        playsInline
        preload={motion ? "auto" : "none"}
        onPlay={() => onPausedChange(false)}
        onPause={() => onPausedChange(true)}
        className="size-full object-cover"
      >
        {motion && (
          <>
            <source src={HERO_VIDEO.mp4Small} type="video/mp4" media="(max-width: 767px)" />
            <source src={HERO_VIDEO.webm} type="video/webm" />
            <source src={HERO_VIDEO.mp4} type="video/mp4" />
          </>
        )}
      </video>
      <div className="absolute inset-0 bg-(--pub-ground)" style={{ opacity: TINT }} />
      {/* On wide screens the folders don't reach the edges; fade out before them so the film ends with the title. */}
      <div className="absolute inset-0 hidden bg-[linear-gradient(to_bottom,transparent_35%,var(--pub-ground)_58%)] md:block" />
    </div>
  );
}

/** Pause and play, for anyone who doesn't want the loop running (WCAG 2.2.2). */
export function HeroVideoToggle({ motion, paused, onToggle }: { motion: boolean; paused: boolean; onToggle: () => void }) {
  if (!HERO_VIDEO || !motion) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={paused ? "Play background video" : "Pause background video"}
      className="grid size-8 place-items-center rounded-full border border-current/30 transition-colors hover:bg-current/10"
    >
      {paused ? <PlayIcon className="size-3.5" /> : <PauseIcon className="size-3.5" />}
    </button>
  );
}
