export type Item = {
  id: string;
  name: string;
  category: string;
  price: number;
  lowStockAt: number;
  preorder: boolean;
  active: boolean;
  hasImage: boolean;
  imageVersion: number;
  stock: number;
  owed: number;
  lastUnitCost: number | null;
  /** Cost of the units on the shelf. Older cached lists may not have it. */
  stockValue?: number;
};

export type StockStatus = "ok" | "low" | "out" | "oversold";

export function stockStatus(i: Item): StockStatus {
  if (i.owed > 0) return "oversold";
  if (i.stock <= 0) return "out";
  if (i.stock <= i.lowStockAt) return "low";
  return "ok";
}

export const STATUS_LABEL: Record<StockStatus, string> = {
  ok: "In stock",
  low: "Running low",
  out: "Out of stock",
  oversold: "Oversold",
};

export const imgSrc = (i: Pick<Item, "id" | "imageVersion">) => `/api/img/${i.id}?v=${i.imageVersion}`;

export const isLow = (i: Item) => i.active && i.stock <= i.lowStockAt;

/** Shrink a photo to fit 256px and encode as webp, so it stays small in the database. */
export async function compressImage(file: File, max = 256): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return canvas.toDataURL("image/webp", 0.8);
}
