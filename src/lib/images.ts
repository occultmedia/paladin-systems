"use client";

/*
 * Shrinks an uploaded image in the browser before it is stored, so a 6 MB
 * phone photo becomes a ~30 KB square. Photos are cropped to fill the
 * square (JPEG); logos are fitted inside it with transparency kept (PNG).
 */

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export async function resizeImage(file: File, { size = 256, mode }: { size?: number; mode: "cover" | "contain" }): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file (JPG, PNG or WebP).");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("That image is over 8 MB. Please choose a smaller one.");

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("We couldn't read that image. Try a JPG or PNG."));
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't process the image.");
    ctx.imageSmoothingQuality = "high";

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (mode === "cover") {
      const s = Math.min(w, h);
      ctx.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size);
      return canvas.toDataURL("image/jpeg", 0.86);
    }
    const scale = Math.min(size / w, size / h);
    const dw = w * scale;
    const dh = h * scale;
    ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = /data:(.*?);/.exec(head)?.[1] ?? "image/png";
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** A listing photo: cropped to fill width x height (JPEG), so it stays well under the 1 MB storage limit. */
export async function resizeCover(file: File, width = 1440, height = 960): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file (JPG, PNG or WebP).");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("That image is over 8 MB. Please choose a smaller one.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("We couldn't read that image. Try a JPG or PNG."));
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser couldn't process the image.");
    ctx.imageSmoothingQuality = "high";
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const scale = Math.max(width / w, height / h);
    const sw = width / scale;
    const sh = height / scale;
    ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
