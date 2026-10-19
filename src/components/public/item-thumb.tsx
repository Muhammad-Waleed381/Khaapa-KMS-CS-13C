import { cx } from "@/components/ui";

/** Item image, or a coloured initial when there is none. */
export function ItemThumb({ name, image, className }: { name: string; image: string | null; className?: string }) {
  if (image)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" loading="lazy" className={cx("rounded-lg bg-muted object-cover", className)} />;
  return (
    <div
      aria-hidden
      className={cx("grid place-items-center rounded-lg bg-accent-soft font-semibold text-accent", className)}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
