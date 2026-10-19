/** Shrink a photo to a JPEG data URL of at most `maxBytes` (roughly). */
export async function compressImage(file: File, maxBytes = 300_000, maxSide = 1200): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file isn't an image"));
      el.src = url;
    });
    let side = maxSide;
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, side / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const q of [0.75, 0.6, 0.45]) {
        const data = canvas.toDataURL("image/jpeg", q);
        // base64 is ~4/3 of the byte size
        if ((data.length * 3) / 4 <= maxBytes) return data;
      }
      side = Math.round(side * 0.7);
    }
    throw new Error("Couldn't shrink that image enough");
  } finally {
    URL.revokeObjectURL(url);
  }
}
